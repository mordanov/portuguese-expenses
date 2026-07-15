# Architecture Review: Multi-Project Support (Feature 002)

**Reviewer**: software-architect
**Date**: 2026-07-15
**Scope**: T004 (migration 010) and T009–T014 (backend plumbing)
**Artifacts reviewed**: spec.md, plan.md, data-model.md, research.md, contracts/api.md, tasks.md;
current source: `backend/app/models/`, `backend/app/routers/auth.py`,
`backend/app/services/auth_service.py`, `backend/app/dependencies.py`,
`backend/app/repositories/`, `backend/app/main.py`

---

## Summary

The design is sound. Nine actionable findings are recorded below — two HIGH, three MEDIUM, four
LOW. All are solvable without scope change. No finding blocks the design from proceeding;
HIGH findings must be resolved before backend implementation begins.

---

## Findings

### HIGH-1 — Migration step ordering: `project_members` FK references `family_members` without ON DELETE restriction

**Where**: `data-model.md` step 11; `tasks.md` T004

**Issue**: The `project_members` join table defines `ON DELETE CASCADE` on the
`projects.id` FK, which is correct — deleting a project cascades to its membership rows.
However, the `member_id` FK referencing `family_members.id` has no explicit `ON DELETE`
clause. The existing codebase uses soft-delete (`is_active = FALSE`) for family members,
so hard-deletes of family members should be impossible. But the DDL should still declare
`ON DELETE RESTRICT` explicitly to document the invariant and prevent accidental future
migrations from dropping the protection silently.

**Required action**: In migration step 11, add `ON DELETE RESTRICT` to the `member_id`
FK:
```sql
member_id UUID REFERENCES family_members(id) ON DELETE RESTRICT
```

---

### HIGH-2 — `main.py` lifespan seeds an "Other" category without `project_id`; must be removed or updated

**Where**: `backend/app/main.py` lines 16–33

**Issue**: The lifespan hook seeds a global "Other" category into `categories` at startup
if none exists. After migration 010, `categories.project_id` is `NOT NULL`. If the
lifespan hook runs after the migration column has been applied but the `Category` ORM model
has not yet been updated to include `project_id`, the INSERT will fail with a NOT NULL
violation and crash startup. Even after the model is updated, the seeder inserts a
project-less category which is now semantically incorrect (categories are project-scoped;
default categories are seeded per-project on creation by `ProjectService.create()`).

**Required action**:
- Remove the lifespan category seeder from `main.py` entirely. Default categories are
  now the responsibility of `ProjectService.create()` (per plan step 5, T018).
- Ensure `project_service.create_project()` seeds the six default categories including
  "Other" with `project_id` set.
- The Portugal-2026 backfill migration (steps 6–7) covers existing categories; no
  orphan categories will remain after migration 010 runs.

---

### MEDIUM-1 — `auth_service.create_access_token` signature change must propagate to all callers

**Where**: `backend/app/services/auth_service.py`; `backend/app/routers/auth.py`

**Issue**: T011 extends the JWT payload to include `project_id` (str UUID or `None`) and
`role`. The current `create_access_token(username: str, role: str = "admin") -> str`
signature must gain a `project_id: str | None = None` parameter. The existing caller in
`auth.py` calls `create_access_token(user.username, user.role)`. The new
`POST /auth/switch-project` endpoint (T028) is a second caller. The login endpoint also
needs updating (T029).

**Required action**: When implementing T011:
1. Update `create_access_token(username, role, project_id=None)` to embed
   `"project_id": project_id` in the JWT payload.
2. Update `decode_access_token` to return `project_id` (may be `None` for admins before
   selection) from the payload — avoid KeyError if the claim is absent.
3. Update `POST /auth/login` to:
   - For `user` role: read `app_users.project_id` from DB and embed in token.
   - For `admin` role: use `request.project_id` if provided, else `None` (admin can select later).
4. Ensure `auth_repository.get_user_by_username` returns the full `AppUser` row (currently
   it does — no change needed, but verify `project_id` is accessible after T006 adds the FK).

---

### MEDIUM-2 — `get_current_project_id` must handle admin tokens with `project_id = null`

**Where**: `backend/app/dependencies.py`; `tasks.md` T012

**Issue**: The data model explicitly states that admin users may carry `project_id = null`
in their token (before or instead of project selection). The `get_current_project_id`
dependency must differentiate between:
- `project_id` missing or null → admin has not selected a project yet → raise 401 with
  `"No active project. Use POST /auth/switch-project."` rather than a generic 401.
- `project_id` present and valid UUID → proceed normally.

A plain `uuid.UUID(payload["project_id"])` will raise `KeyError` or `ValueError` if the
claim is absent or null.

**Required action**: In `get_current_project_id`, raise **403** (not 401) when
`project_id` is absent or null — security-architect (B4) is correct: the token is
otherwise valid; the issue is insufficient privileges/context, not unauthenticated.
401 is correct only for an expired or invalid token signature.
```python
raw_pid = payload.get("project_id")
if raw_pid is None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No active project. Use POST /auth/switch-project to select one."
    )
try:
    return uuid.UUID(raw_pid)
except ValueError:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid project_id in token")
```

---

### MEDIUM-3 — `require_open_project` must verify project exists before checking status

**Where**: `tasks.md` T012; plan.md Step 6

**Issue**: `require_open_project(project_id, db) -> Project` should:
1. Fetch the project by `project_id`.
2. If not found → 404 (not 403, which is reserved for "closed").
3. If `status == 'closed'` → 403 `"Project is closed"`.

The task description only says "returning 403 if project status is closed", omitting the
404 path. An incorrectly implemented guard that returns 403 for a non-existent project will
mislead callers and obscure data integrity problems.

**Required action**: Document this two-branch behaviour explicitly in the dependency
implementation. The contracts/api.md error table should also add `404: Project not found`
as a possible response on write endpoints that inject `require_open_project`.

---

### LOW-0 (added post-security-review) — Hex colour inputs must be validated with regex

**Where**: `backend/app/schemas/project.py`; T009; security-architect finding B3

**Issue**: Security architect independently flagged that `bg_color`, `text_color`, and
`accent_color` fields in `ProjectCreate`, `ProjectUpdate`, and `ColorSuggestResponse` must
be validated as `^#[0-9A-Fa-f]{6}$`. Without this, a malformed colour string (e.g.
`" onmouseover=..."`) could be stored and later reflected into CSS, creating a stored XSS
vector via the CSS custom property injection in `ProjectContext.tsx`.

**Required action**: In `backend/app/schemas/project.py` (T009), apply a Pydantic
`field_validator` or `Annotated` `pattern` constraint:
```python
from pydantic import field_validator
import re

HEX_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')

@field_validator('bg_color', 'text_color', 'accent_color')
@classmethod
def validate_hex_color(cls, v: str) -> str:
    if not HEX_COLOR_RE.match(v):
        raise ValueError('Color must be a 6-digit hex string, e.g. #3A7D44')
    return v
```
This must also cover the `ColorSuggestResponse` schema so the LLM output is sanitised
before being returned to the client.

---

### LOW-1 — `CategoryRepository.list_all` uses `BaseRepository.list` without project filter; must be overridden

**Where**: `backend/app/repositories/category_repository.py`; `tasks.md` T013

**Issue**: `CategoryRepository.list_all()` delegates to `BaseRepository.list()` which has
no `project_id` parameter. After T007 adds `Category.project_id`, the query will still
return categories from all projects unless the method is explicitly filtered.

**Required action**: T013 must override `CategoryRepository.list_all` to accept and apply
`project_id: uuid.UUID`. The `BaseRepository.list(**filters)` kwarg mechanism supports
this:
```python
async def list_all(self, project_id: uuid.UUID, page: int = 1, page_size: int = 20):
    return await self.list(project_id=project_id, page=page, page_size=page_size)
```
Alternatively, if the `BaseRepository.list` filter mechanism is not used, implement a
direct SQLAlchemy `where` clause. Either approach is acceptable; the important constraint
is that `project_id` is always required, not optional.

---

### LOW-2 — `BalanceRepository` and `ReportRepository` join path to `project_id` requires explicit filter

**Where**: `backend/app/repositories/balance_repository.py`; `backend/app/repositories/report_repository.py`; `tasks.md` T013

**Issue**: Both repositories build queries joining `Ticket → Item → Allocation`. After
migration 010, `Ticket.project_id` is available. T013 requires adding
`WHERE tickets.project_id = :active_project_id` to these queries, but neither repository
currently has a `project_id` parameter in any of their public methods.

Adding the filter at the outermost query level is the correct approach:
```python
stmt = stmt.where(Ticket.project_id == project_id)
```
This must be done for every select statement that touches `Ticket` in these repositories
(both the main query and any subqueries that are based on `Ticket`).

**Required action**: T013 must add `project_id: uuid.UUID` to all public methods in
`BalanceRepository` and `ReportRepository` and apply the filter. Test coverage (T050)
must assert cross-project data is absent.

---

### LOW-3 — `MemberRepository.list_active` needs a project-scoped variant for allocation selectors

**Where**: `backend/app/repositories/member_repository.py`; `tasks.md` T040

**Issue**: T040 requires updating `member_repository.py` to add a
`get_members_for_project(project_id)` query. The current `list_active()` method returns
all globally active members. After multi-project support, the allocation chip selector on
the ticket entry form must show only members linked to the active project via
`project_members`. The new method needs a JOIN:
```sql
SELECT family_members.*
FROM family_members
JOIN project_members ON project_members.member_id = family_members.id
WHERE project_members.project_id = :project_id
  AND family_members.is_active = TRUE
```

**Required action**: Confirm T040 implements this join (it is described in the task but
the join SQL is not shown). The existing `list_active()` should remain for admin-side
operations (e.g., listing all members when adding them to a project), with the new
project-scoped variant used exclusively in the allocation selector endpoint.

---

### LOW-4 — `main.py` `include_router` must add projects router; import list is currently closed

**Where**: `backend/app/main.py`; `tasks.md` T001

**Issue**: T001 registers the new `projects` router in `main.py`. The current import block
imports 11 routers by name. After T001, the import must include `from app.routers import
... projects` and `app.include_router(projects.router)` must be appended. This is already
in T001's scope, but it is worth noting that the `include_router` call order affects
route matching for `GET /projects/public-list` (no auth) vs `GET /projects` (admin auth).
FastAPI matches in registration order; the public-list endpoint is at a distinct path so
no conflict exists — but the projects router must be included **before** any middleware or
exception handler that might intercept unauthenticated requests at the router level.

**Required action**: Confirm T001 implementation registers the router. No reordering of
existing routers is needed; append `projects.router` after the existing set.

---

## Checklist: Gate A (Design Readiness)

| Gate | Status |
|------|--------|
| Goals, non-goals, constraints, assumptions documented | ✅ |
| Relevant diagrams exist for decision scope | ⚠️ No sequence diagram for project switch flow (acceptable for this scope) |
| Major decisions have ADRs with alternatives | ✅ research.md covers all 10 decisions |
| Contracts and data models are coherent and versionable | ✅ with HIGH-1/HIGH-2 resolved |
| Well-architected review has no unowned blocker risk | ✅ all HIGH/MEDIUM findings are assigned |

## Checklist: Gate B (Security Readiness)

| Gate | Status |
|------|--------|
| Trust boundaries defined | ✅ JWT carries project scope; no cross-project leakage by design |
| Admin-only endpoints protected | ✅ `require_admin` dependency already exists |
| `require_open_project` on all write endpoints | ✅ T012+T014 — see MEDIUM-3 for 404 vs 403 nuance |
| LLM endpoint cannot be exploited to exfiltrate data | ✅ `suggest-colors` takes a query string, returns only hex values |
| Public endpoint (`public-list`) returns minimal data | ✅ id, name, bg_color, status only |
| No new secrets introduced | ✅ reuses `OPENAI_API_KEY` |

## Resolution Required Before Implementation Starts

| Finding | Assignee | Action |
|---------|----------|--------|
| HIGH-1 | backend | Add `ON DELETE RESTRICT` to `member_id` FK in migration step 11 |
| HIGH-2 | backend | Remove lifespan category seeder from `main.py`; move to `ProjectService.create()` |
| MEDIUM-1 | backend | Thread `project_id` through `create_access_token` and all callers |
| MEDIUM-2 | backend | Handle null/missing `project_id` claim in `get_current_project_id` |
| MEDIUM-3 | backend | Implement 404 vs 403 branching in `require_open_project` |

LOW findings are implementation notes that T013, T040, and T001 should incorporate; they
do not require design changes before work begins.

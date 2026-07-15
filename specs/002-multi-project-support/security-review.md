# Security Review: Multi-Project Support (Feature 002)

**Branch**: `002-multi-project-support` | **Date**: 2026-07-15
**Reviewer**: Security Architect Agent
**Tasks**: T008-equivalent (threat model) + security acceptance criteria
**Status**: APPROVED WITH RISKS — no blockers in design; implementation controls required.

---

## Security Review Result

### Scope Reviewed

- Role-based authorization (admin vs user) and RBAC enforcement
- Project-scoped JWT tokens: new `role` + `project_id` claims
- `POST /auth/switch-project` endpoint security
- `GET /projects/public-list` unauthenticated endpoint
- `POST /projects/suggest-colors` LLM integration (untrusted output, API key handling)
- Project isolation: all queries scoped by `project_id` from JWT
- `require_open_project` dependency (closed-project write guard)
- Data migration: Portugal-2026 backfill, role assignment
- Admin route guarding (Projects settings page — admin only)
- JWT payload changes: `project_id` + `role` claims

### Decision

**APPROVED WITH RISKS**

No blocker-severity design vulnerabilities. The multi-project model is sound. Required
implementation controls are listed below; failure to implement them would create blocker issues.
Residual risks are documented with owners and due dates.

---

## Threat Model: Multi-Project Support

### Scope

Adding Project entities with admin/user role separation. Admins can see all projects and
switch between them; non-admin users are hard-scoped to one project via a JWT claim. A new
`switch-project` endpoint re-issues tokens. Project creation uses LLM-assisted colour
suggestions. All existing data queries are now filtered by `project_id`.

---

### Assets

| Asset | Sensitivity | Location |
|---|---|---|
| JWT tokens (with `role` + `project_id` claims) | Critical | Client localStorage → Bearer header |
| Other-project ticket and financial data | High | PostgreSQL, scoped by project_id |
| Admin privilege bit | Critical | JWT `role` claim + `app_users.role` column |
| OpenAI API key | High | `OPENAI_API_KEY` env var |
| Project colour palettes | Low | PostgreSQL `projects` table |
| Project metadata (names, languages) | Low | PostgreSQL `projects` table — `public-list` exposes name + bg_color |

---

### Actors

| Actor | Trust Level | Entry Points |
|---|---|---|
| Admin user | Trusted (post-login, admin claim verified) | All endpoints; project chooser; switch-project |
| Non-admin (user-role) user | Trusted to own project only | JWT-protected endpoints scoped to assigned project |
| Unauthenticated caller | Untrusted | `POST /auth/login`, `GET /projects/public-list` |
| OpenAI API (colour suggestion response) | External/Untrusted output | `POST /projects/suggest-colors` |
| Existing JWT (pre-migration, missing `role`/`project_id`) | Partially trusted | Token decode must be backward-safe or tokens forced-expired |

---

### Trust Boundaries

```
[Browser / Client]
    │ HTTPS + Bearer JWT (role + project_id claims)
    ▼
[FastAPI Backend]
    │
    ├── PostgreSQL — all queries: WHERE project_id = :jwt_project_id
    ├── OpenAI API — colour suggestion only (admin action)
    └── env vars (JWT keys, OpenAI key, seed credentials)
```

New boundary: **JWT claim → project scope**. The project isolation guarantee lives entirely
in whether every repository method correctly enforces `WHERE project_id = :project_id`.

---

### Entry Points

| Entry Point | Auth Required | Notes |
|---|---|---|
| `POST /auth/login` | No | Returns token with role + project_id |
| `POST /auth/switch-project` | Yes (admin only) | Issues fresh token; validates project existence |
| `GET /projects/public-list` | No | Exposes project names and bg_color |
| `GET /projects` | Yes (admin) | Full project details |
| `POST /projects` | Yes (admin) | Creates project + seeds categories |
| `PUT /projects/{id}` | Yes (admin) | Updates colour, language, name |
| `POST /projects/{id}/close` | Yes (admin) | Sets project read-only |
| `POST /projects/{id}/reopen` | Yes (admin) | Lifts read-only |
| `POST /projects/suggest-colors` | Yes (admin) | Calls OpenAI; response must be sanitized |
| `GET /projects/{id}/members` | Yes (admin) | Member list |
| `POST /projects/{id}/members` | Yes (admin + open) | Adds member to project |
| `DELETE /projects/{id}/members/{id}` | Yes (admin + open) | Removes member |
| All existing endpoints | Yes (any role) | Now filtered by `project_id` from JWT |

---

### Threats and Abuse Cases

| ID | STRIDE | Threat | Impact | Likelihood | Controls Required |
|---|---|---|---|---|---|
| T1 | Elevation | Non-admin user crafts/replays a token with `role: "admin"` | Full admin access to all projects | Low (RS256 signature) | Server-side role verification from JWT; admin role must be validated server-side, not trusted from client state alone |
| T2 | Elevation | Non-admin user calls `POST /auth/switch-project` | Cross-project data access | Medium | `require_admin` dependency on switch-project; returns 403 |
| T3 | Info Disclosure | Non-admin user passes an arbitrary `project_id` in login body | Token contains wrong project scope | Low if ignored | Spec says `project_id` is ignored for role=user; must be enforced: always set from `app_users.project_id` column |
| T4 | Info Disclosure | User-role JWT has `project_id = X`; data query lacks WHERE filter | Cross-project data leak | High if missed | Every repository method must apply `WHERE project_id = :project_id`; missing one silently leaks all-project data |
| T5 | Info Disclosure | Admin switches to a project via JWT; old JWT still valid | Old token scoped to different project still works | Medium | JWT short expiry; switch-project invalidates by issuing new token (old one expires naturally); no server-side revocation needed given short TTL |
| T6 | Spoofing | Pre-migration tokens missing `role`/`project_id` claims accepted | User operates without project scope; bypass filter | Medium | `get_current_project_id()` must handle missing claim safely: return 401 or default to 403, not silently pass through |
| T7 | Tampering | Admin injects LLM-returned hex string as a CSS value with XSS payload | Stored XSS via project colours | Low | Validate hex values server-side: must match `^#[0-9A-Fa-f]{6}$`; reject anything else before persistence |
| T8 | Tampering | LLM colour suggestion returns a non-hex value; stored as-is | UI breakage; potential injection vector | Medium (LLM hallucination) | Backend validates `bg_color`, `text_color`, `accent_color` against hex regex before returning to client; fallback to neutral palette if invalid |
| T9 | Info Disclosure | `GET /projects/public-list` exposes project names to unauthenticated callers | Reveals trip names (e.g., "France-2026") | Low (family app) | Acceptable for login UX; document as residual risk; no credentials exposed |
| T10 | Elevation | Admin closes a project but existing open tickets can still be updated via a cached JWT | Closed-project write bypass | Medium | `require_open_project` dependency must re-query project status from DB on every write request (not cache it in JWT) |
| T11 | Elevation | Colour suggestion endpoint used by non-admin to trigger OpenAI API calls | Wasted API cost / DoS on OpenAI quota | Low | `require_admin` on `suggest-colors` endpoint |
| T12 | Info Disclosure | A user-role account has no project assigned (e.g. after migration bug); `get_current_project_id` returns NULL; query runs unscoped | All-project data leak | Low if migration correct | If `project_id` is NULL in JWT, all project-filtered queries must fail 403, not return unscoped results |
| T13 | Denial of Service | Attacker submits `POST /projects/suggest-colors` with very long `query` string | OpenAI API abuse, cost spike | Low (admin only) | Validate `query` length server-side: max 200 characters |
| T14 | Tampering | Migration backfills `user` role accounts but `admin` accounts get `project_id = NULL` accidentally | Admin loses project context | Low (explicit migration logic) | Migration must only update rows WHERE `role = 'user'`; validate in `test_migration.py` |

---

### Required Mitigations

#### Blocker (must implement before release)

**B1 — Role claim enforcement**: `require_admin` dependency must be injected on ALL admin-only
endpoints. Do not rely on client-side role checks alone. Already exists in `dependencies.py`;
verify it is wired to every new project endpoint and `switch-project`.

**B2 — Project scope on every write**: `require_open_project` must re-query project status
from DB on every POST/PUT/DELETE handler in existing routers (tickets, categories, members).
Closed-project check must not rely on a cached/stale project object.

**B3 — Hex validation before persistence**: Any colour value accepted from a client request
(`bg_color`, `text_color`, `accent_color`) OR returned from the LLM suggestion endpoint
MUST be validated against `^#[0-9A-Fa-f]{6}$` before being stored. Use a Pydantic validator
in `ProjectCreate`, `ProjectUpdate`, and `ColorSuggestResponse`.

**B4 — No unscoped queries when project_id is null**: If the JWT's `project_id` claim is
absent or null (old tokens, migration edge cases), all project-scoped repository methods
must return 403, not silently return unscoped results. `get_current_project_id()` must raise
HTTP 403 if the claim is missing.

**B5 — User-role project_id immutability**: On `POST /auth/login`, when `role = "user"`,
always set `project_id` from the DB column `app_users.project_id`, never from the request
body. The request `project_id` field must be silently ignored for non-admin accounts.

#### High (must fix or formally accept before release)

**H1 — Pre-migration token handling**: Old JWTs (issued before this migration) lack
`role` and `project_id` claims. Document the expected TTL flush window. If short expiry
(60 min) is acceptable, this self-resolves. If any long-lived tokens exist, document a
forced re-login procedure.

**H2 — `project_id` NULL for admin accounts**: Admin tokens carry `project_id` of the
selected project. Before a project is selected (fresh login, no chooser interaction), admin
`project_id` may be null. Any attempt to use project-scoped endpoints without a project
selection must return 400 or 403 with a clear message, not silently use an unscoped query.

#### Medium

**M1 — LLM response validation**: The colour suggestion endpoint passes user input to
OpenAI and returns a JSON payload. Before returning to the client, validate all three hex
fields. If validation fails, return 503 with a fallback message rather than a malformed
response.

**M2 — Query length cap on suggest-colors**: Limit `query` to 200 characters server-side
to prevent prompt stuffing / excessive API usage.

**M3 — `GET /projects/public-list` rate limiting**: No auth required; susceptible to
enumeration/scraping. Low risk for a family app, but document as residual and consider
basic rate-limiting if the deployment is public.

---

### Security Acceptance Criteria

#### Authentication and Role Enforcement

- [ ] `POST /auth/switch-project` returns 403 for a user-role JWT.
- [ ] `GET /projects`, `POST /projects`, `PUT /projects/{id}`, `POST /projects/{id}/close`,
  `POST /projects/{id}/reopen`, `POST /projects/suggest-colors`,
  `GET /projects/{id}/members`, `POST /projects/{id}/members`,
  `DELETE /projects/{id}/members/{id}` all return 403 for a user-role JWT.
- [ ] `POST /auth/login` with `project_id` in body for a user-role account ignores the
  field; the returned token contains the user's assigned `project_id` from the DB, not the
  one from the request.
- [ ] `GET /projects/public-list` returns 200 without any Authorization header.
- [ ] A valid user JWT with no `project_id` claim (simulated legacy token) returns 403 on
  any project-scoped endpoint.

#### Project Isolation

- [ ] A user-role JWT scoped to project A cannot retrieve tickets from project B via
  `GET /tickets` (project B tickets absent from response).
- [ ] A user-role JWT scoped to project A cannot retrieve categories from project B via
  `GET /categories`.
- [ ] Balance and report endpoints return only data from the active project.
- [ ] `GET /members` returns only members linked to the active project via `project_members`.
- [ ] Creating a ticket while scoped to project A associates the ticket with project A.
- [ ] Switching projects (via `switch-project`) and then querying tickets returns only the
  new project's data.

#### Closed Project Controls

- [ ] `POST /tickets/...` (any write) on a closed project returns 403.
- [ ] `POST /categories` on a closed project returns 403.
- [ ] `POST /projects/{id}/members` on a closed project returns 403.
- [ ] `DELETE /projects/{id}/members/{id}` on a closed project returns 403.
- [ ] `GET /tickets` on a closed project returns 200 (reads allowed).
- [ ] `GET /balances` on a closed project returns 200.

#### Colour Validation

- [ ] `POST /projects` with `bg_color: "javascript:alert(1)"` returns 422.
- [ ] `POST /projects` with `bg_color: "#GGGGGG"` (invalid hex) returns 422.
- [ ] `POST /projects` with `bg_color: "#00660"` (5-digit hex) returns 422.
- [ ] `POST /projects/suggest-colors` with `query` longer than 200 characters returns 422.
- [ ] LLM suggestion returning a non-hex colour value is not persisted or returned to the
  client without validation failure.

#### Migration Integrity

- [ ] After migration, `SELECT COUNT(*) FROM tickets WHERE project_id IS NULL` = 0.
- [ ] After migration, `SELECT COUNT(*) FROM categories WHERE project_id IS NULL` = 0.
- [ ] After migration, all user-role `app_users` rows have `project_id` = Portugal-2026 UUID.
- [ ] After migration, all admin `app_users` rows have `project_id` IS NULL.
- [ ] After migration, all `family_members` appear in `project_members` for Portugal-2026.
- [ ] Down-migration + up-migration leaves database in the same schema state.

#### Negative Tests (additions to existing suite)

- [ ] Non-admin calling `POST /auth/switch-project` → 403.
- [ ] Admin calling `POST /auth/switch-project` with unknown `project_id` → 404.
- [ ] User-role login where `app_users.project_id` is NULL (migration bug simulation) → 403
  on subsequent project-scoped requests (not 500 or unscoped response).
- [ ] `POST /projects/suggest-colors` with empty `query` → 422.
- [ ] Cross-project member assignment attempt (user-scoped to A trying to add a member to B)
  → 403 (admin-only endpoint, not just project check).

---

### Residual Risks

| ID | Risk | Severity | Owner | Mitigation | Due |
|---|---|---|---|---|---|
| R1 | `GET /projects/public-list` exposes project names to unauthenticated callers | Low | Product Manager | Acceptable for login UX; family-private deployment; document in deployment notes | Ongoing |
| R2 | No server-side session revocation; old JWT (different project) usable until natural expiry | Low | Software Architect | Mitigated by short TTL (60 min); admin must switch projects to refresh scope | Post-MVP |
| R3 | LLM colour suggestions could be prompted to return inappropriate values (prompt injection via project name) | Low | Backend Developer | Hex validation catches structural injection; semantic content in name field is admin-controlled | Post-MVP |
| R4 | Pre-migration tokens (lacking `role`/`project_id`) will silently fail on new dependencies | Informational | Backend Developer | 60-min TTL means they flush within 1 hour of deployment; deploy during low-usage window | Deploy day |

---

### Follow-Up Items

- Verify `require_admin` is injected on ALL new project router endpoints before code review
  gate (backend developer + code reviewer).
- Verify `require_open_project` dependency re-queries DB (not stale context) on every write
  handler in all existing routers (backend developer).
- Confirm Pydantic hex validators are in `ProjectCreate`, `ProjectUpdate`, and applied to
  `ColorSuggestResponse` return values (backend developer).
- Confirm `get_current_project_id()` in `dependencies.py` raises 403 (not 500 or None
  passthrough) when `project_id` claim is absent (backend developer).
- Security negative tests (auth role bypass, cross-project queries, hex injection, closed
  project writes) must be added to `test_projects.py` and `test_auth.py` (autotester).

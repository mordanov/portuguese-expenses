# Research: Multi-Project Support

**Branch**: `002-multi-project-support` | **Date**: 2026-07-15

---

## Decision 1: Project Context Propagation — JWT Claim vs. Request Header

**Decision**: Embed `project_id` in the JWT payload at login time. The token carries
`sub` (user id), `role`, and `project_id`. All backend queries extract `project_id` from
the decoded token via the existing `dependencies.py` auth dependency.

**Rationale**: Stateless — no server-side session needed. A single `get_current_project_id`
dependency slot into every router with no per-endpoint changes. Admin re-selection is
handled by a `POST /auth/switch-project` endpoint that issues a new token.

**Alternatives considered**:
- `X-Project-ID` header on every request — requires clients to track and send an extra
  header; more surface for bugs; cannot be enforced by the auth middleware transparently.
- Server-side session map — contradicts the existing stateless JWT architecture.

---

## Decision 2: Family Member Global Scope + `project_members` Join Table

**Decision**: `family_members` table remains unchanged (global). A new
`project_members (project_id, member_id, joined_at)` join table establishes membership.
Members are filtered to the active project's member list in every allocation selector query.

**Rationale**: Matches the clarified requirement (one member in multiple projects). Avoids
duplicating member records across projects. The existing `FamilyMember` model needs no
columns added; only a new relationship is introduced.

**Alternatives considered**:
- Adding a `project_id` column directly to `family_members` — simple but wrong given the
  many-to-many requirement confirmed in clarification Q3.
- Separate `family_members` rows per project — ruled out; creates maintenance burden when
  the same real person participates in multiple trips.

---

## Decision 3: LLM Color Suggestion — Reuse OpenAI Client, Dedicated Endpoint

**Decision**: Add `POST /projects/suggest-colors` which calls the existing OpenAI client
(`gpt-4o`, JSON mode) with a structured prompt. Returns `{ bg_color, text_color,
accent_color }` as hex strings. Contrast ratio warning is computed client-side using
WCAG 2.1 formula.

**Rationale**: Reuses the already-configured OpenAI SDK and `openai_api_key` env var.
No new dependencies needed. JSON mode guarantees parseable output.

**Alternatives considered**:
- A separate AI provider for color suggestions — unnecessary complexity; same OpenAI key
  already required for OCR.
- Hardcoded country-to-palette lookup table — cannot cover arbitrary project names;
  LLM is far more flexible.

---

## Decision 4: OCR Language Hint Integration

**Decision**: The `process_upload` method signature gains a `language: str` parameter
(IETF tag, e.g. `"pt"`, `"fr"`). The `_SYSTEM_PROMPT_TEMPLATE` gains a line:
`"The receipt is written in {language}."` injected before the rules block. The ticket
router reads `project.default_language` from the DB when calling `OCRService`.

**Rationale**: Minimal change to an already-working service. Language hint improves
extraction accuracy on non-Latin scripts and reduces misparses on locale-specific
number formats (e.g., French `1 234,56` vs Portuguese `1.234,56`).

**Alternatives considered**:
- Per-request language override sent by the client — rejected; language belongs to the
  project configuration, not the end user's discretion.

---

## Decision 5: Categories Are Project-Scoped; Name Uniqueness Is Per-Project

**Decision**: `categories` gains a `project_id FK NOT NULL`. The existing `UNIQUE (name)`
constraint is replaced with `UNIQUE (name, project_id)`. Default categories are seeded
per-project on project creation (via the project service, not a migration).

**Rationale**: Categories like "Wine" or "Meals" are meaningful in every trip context.
Scoping them to a project lets each trip have its own colour assignments and additions
without polluting other projects.

**Alternatives considered**:
- Global categories shared across projects — simpler but causes cross-project naming
  collisions and prevents per-project category customisation.

---

## Decision 6: Project Close/Reopen — `status` Enum Column, Middleware Guard

**Decision**: `projects.status` is `VARCHAR(10)` with CHECK (`open`, `closed`). A FastAPI
dependency `require_open_project()` is injected on all write endpoints (POST/PUT/DELETE
for tickets, items, members within a project). Read endpoints (GET, reports, balances)
bypass this guard — closed projects remain fully queryable.

**Rationale**: Single column, single dependency. The guard is opt-in per router so
reporting and read paths are unaffected. Admins are excluded from the guard on the
projects management router itself (they still need to call reopen).

**Alternatives considered**:
- Application-level check in every service method — more verbose, easier to forget.
- Separate `closed_at` timestamp + NULL-as-open pattern — adds a nullable column that
  makes queries slightly harder to read; a status enum is more explicit.

---

## Decision 7: Alembic Migration Numbering

**Decision**: Single migration file `010_multi_project_support.py`. Steps in order:
1. Create `projects` table.
2. Insert `Portugal-2026` with a stable hardcoded UUID, `status='open'`, `default_language='pt'`.
3. Add nullable `project_id` FK to `tickets`, `categories`, `app_users`.
4. Backfill all rows with the Portugal-2026 UUID.
5. Set `project_id` NOT NULL on `tickets` and `categories`.
6. Leave `app_users.project_id` nullable (NULL for admin accounts is valid).
7. Create `project_members` join table.
8. Insert all existing `family_members` into `project_members` for Portugal-2026.
9. Drop `UNIQUE (categories.name)`, add `UNIQUE (categories.name, categories.project_id)`.

**Rationale**: All steps in one migration keep the atomic boundary clear — either the
entire upgrade succeeds or the DB rolls back to the pre-multi-project state.

**Alternatives considered**:
- Multiple separate migrations per step — cleaner to read individually, but rolling back
  mid-sequence leaves the DB in a partially migrated state.

---

## Decision 8: Frontend Color Theming — CSS Custom Properties on `:root`

**Decision**: On project context change (login, project switch), the frontend writes three
CSS custom properties (`--project-bg`, `--project-text`, `--project-accent`) to `:root`
via JavaScript. Tailwind classes like `bg-[var(--project-bg)]` or a thin `theme.ts` helper
apply these to the Layout shell (navbar, header). Other pages are unaffected.

**Rationale**: No Tailwind config rebuild needed. React context holds the active project
object; a `useEffect` in `Layout.tsx` syncs the CSS vars whenever the project changes.
Works with SSR if ever adopted.

**Alternatives considered**:
- Tailwind arbitrary values hardcoded per project — requires knowing colours at build time.
- Inline `style` props on every component — verbose, hard to maintain.

---

## Decision 9: Project Chooser UI on Login — Pre-Auth Fetch

**Decision**: `LoginPage.tsx` calls `GET /projects/public-list` (no auth required) to
populate the chooser dropdown **before** the user logs in. The list returns `{ id, name,
bg_color, status }` only. The selected `project_id` is sent in the login body as an
optional field (admin only). The backend ignores it for `user` role accounts.

**Rationale**: Admins need to pick a project before receiving a JWT, so the list must be
public. The endpoint returns minimal fields — no sensitive data. Non-admin users never
see the chooser (the dropdown is hidden if exactly one project is auto-selected).

**Alternatives considered**:
- POST /auth/login first, then project chooser — creates a two-step login flow and
  requires an intermediate "no project" token state.

---

## Decision 10: Constitution Principle V Conflict — Colour Scheme

**Finding**: Constitution §V states "The colour scheme MUST follow the Portuguese flag
palette … No other primary brand colours are permitted." This directly conflicts with
per-project dynamic theming.

**Resolution**: The Portuguese flag palette is adopted as the **default** for the
`Portugal-2026` project (seed values). The constitution principle §V is superseded for
this feature by the explicit product requirement (FR-009). A Complexity Tracking entry
in the plan documents this justified violation.

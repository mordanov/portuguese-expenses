# Implementation Plan: Multi-Project Support

**Branch**: `002-multi-project-support` | **Date**: 2026-07-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-multi-project-support/spec.md`

## Summary

Evolve the single-trip Portuguese Drunk Sailors app into a multi-project expense tracker.
Introduce a `Project` entity; scope all existing data entities (tickets, categories, members
via join table) to projects; add admin-only project management UI with LLM colour suggestions;
thread project context through JWT tokens; update OCR to accept a per-project language hint;
and deliver a single Alembic migration that backfills all existing data to a seeded
`Portugal-2026` project with zero data loss.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x strict (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x async, asyncpg, Alembic, PyJWT (RS256),
  bcrypt, pdf2image, openai SDK v1.x (backend) | React 18, TanStack Query v5,
  React Hook Form, Zod, i18next, HeroUI, Tailwind CSS, Vitest, MSW (frontend)
**Storage**: PostgreSQL 16 — all monetary as NUMERIC(10,2), UUIDs for all PKs
**Testing**: pytest + pytest-asyncio + httpx + pytest-cov ≥80% (backend);
  Vitest + React Testing Library + MSW (frontend)
**Target Platform**: Linux containers via Docker Compose (db + backend + frontend)
**Project Type**: Web application (REST API backend + SPA frontend)
**Performance Goals**: Colour suggestion API call within 5s; project switch context
  reload within 1s on the client; all pre-existing performance goals from plan 001 unchanged
**Constraints**: All monetary arithmetic uses Python `Decimal`; project_id propagated
  via JWT claim; `require_open_project` FastAPI dependency guards all write endpoints;
  OCR always mocked in tests; CORS locked to frontend origin
**Scale/Scope**: Single-digit project count; ~8 users per project; ~10 new/modified
  API endpoints; ~4 new UI pages/components; 1 Alembic migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Code Quality — Python 3.12 + FastAPI + async SQLAlchemy | Tech context matches | ✅ PASS |
| I. Code Quality — React 18 + TS strict + Tailwind + HeroUI | Tech context matches | ✅ PASS |
| I. Code Quality — NUMERIC(10,2), Python Decimal, no floats | No monetary changes; existing rule unchanged | ✅ PASS |
| I. Code Quality — pre-commit (black, isort, flake8, mypy) | No change to toolchain | ✅ PASS |
| II. Testing — pytest-asyncio, ≥80% coverage | New service/repo modules require test files | ✅ PASS |
| II. Testing — OCR always mocked | Language param added to mock interface; mock updated | ✅ PASS |
| II. Testing — Vitest + RTL + MSW frontend | New project pages require component tests | ✅ PASS |
| III. Architecture — Router/Service/Repository layers | New project router/service/repo follow same pattern | ✅ PASS |
| III. Architecture — No business logic in schemas/models | Enforced by layer pattern | ✅ PASS |
| III. Architecture — JWT RS256 from JWT_SECRET env | JWT payload extended; algorithm unchanged | ✅ PASS |
| III. Architecture — Alembic migrations only | Migration 010 covers all schema changes | ✅ PASS |
| IV. Security — bcrypt password hashes | No change to auth | ✅ PASS |
| IV. Security — Upload type+size validation | No change | ✅ PASS |
| IV. Security — CORS locked to frontend origin | No change | ✅ PASS |
| V. UX — i18next, no hardcoded JSX strings | New project UI pages use i18next keys | ✅ PASS |
| V. UX — Portuguese flag palette | **JUSTIFIED VIOLATION** — see Complexity Tracking | ⚠️ OVERRIDE |
| V. UX — Two decimal places + euro symbol | No change | ✅ PASS |
| VI. Performance — Paginated lists, DB-level filtering | New project endpoints paginated; all queries project-filtered at DB | ✅ PASS |
| VII. Docker — docker compose up --build only | No change | ✅ PASS |
| VII. Docker — Alembic runs on startup | Migration 010 runs automatically | ✅ PASS |

**Constitution Check: 19 PASS, 1 JUSTIFIED OVERRIDE — no blocking violations.**

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| §V Colour scheme — Portuguese flag palette only | Per-project dynamic theming is the core product requirement (FR-009, SC-003); each project must have its own visual identity | A single fixed palette cannot visually distinguish France-2026 from Portugal-2026; the user explicitly requires configurable colour schemes |

## Project Structure

### Documentation (this feature)

```text
specs/002-multi-project-support/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Database schema changes
├── quickstart.md        # Setup + validation steps
├── contracts/
│   └── api.md           # New and modified API endpoints
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (generated by /speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   └── project.py              # NEW: Project + ProjectMember ORM models
│   ├── schemas/
│   │   └── project.py              # NEW: Pydantic schemas for project CRUD + color suggest
│   ├── repositories/
│   │   └── project_repository.py   # NEW: CRUD + member management queries
│   ├── services/
│   │   ├── project_service.py      # NEW: create/update/close/reopen + color suggestion
│   │   └── ocr_service.py          # MODIFIED: add language param to process_upload
│   ├── routers/
│   │   └── projects.py             # NEW: /projects endpoints + /auth/switch-project
│   ├── dependencies.py             # MODIFIED: get_current_project_id, require_open_project
│   ├── config.py                   # UNCHANGED (openai_api_key already present)
│   └── models/
│       ├── app_user.py             # MODIFIED: add project_id FK (nullable)
│       ├── category.py             # MODIFIED: add project_id FK (NOT NULL)
│       └── ticket.py               # MODIFIED: add project_id FK (NOT NULL)
├── alembic/versions/
│   └── 010_multi_project_support.py # NEW: full migration (create + backfill)
└── tests/
    ├── test_projects.py            # NEW: CRUD, close/reopen, color suggest, member mgmt
    ├── test_auth.py                # MODIFIED: switch-project endpoint
    └── test_tickets.py             # MODIFIED: project scoping assertions

frontend/
├── src/
│   ├── api/
│   │   └── projects.ts             # NEW: API client for all /projects endpoints
│   ├── pages/
│   │   └── ProjectsPage.tsx        # NEW: admin-only projects list + management UI
│   ├── components/
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx     # NEW: card in projects list
│   │   │   ├── ProjectForm.tsx     # NEW: create/edit form with color picker + suggest
│   │   │   └── ProjectChooser.tsx  # NEW: login screen project selector + navbar switcher
│   │   └── layout/
│   │       ├── Layout.tsx          # MODIFIED: apply CSS vars from active project
│   │       └── Navbar.tsx          # MODIFIED: project badge + admin switcher
│   ├── context/
│   │   └── ProjectContext.tsx      # NEW: active project state + CSS var application
│   ├── locales/
│   │   ├── en/translation.json     # MODIFIED: add project-related keys
│   │   ├── ru/translation.json     # MODIFIED: add project-related keys
│   │   └── pt/translation.json     # MODIFIED: add project-related keys
│   └── pages/
│       └── LoginPage.tsx           # MODIFIED: add project chooser for admin
```

---

## Phase 0: Research — Complete

See [research.md](research.md).

Key decisions:
- Project context via JWT claim (`project_id`); admin switches via `POST /auth/switch-project`
- `family_members` stays global; `project_members` join table added
- LLM colour suggestion reuses OpenAI client; dedicated `POST /projects/suggest-colors`
- OCR gains `language` param threaded from `project.default_language`
- Categories become project-scoped; name uniqueness is per-project
- Project lifecycle: `status = open | closed`; `require_open_project` FastAPI dependency
- Single Alembic migration `010` for all schema changes + backfill
- Frontend theming via CSS custom properties on `:root`
- Login chooser calls unauthenticated `GET /projects/public-list`

---

## Phase 1: Design — Complete

### Backend Implementation Order

**Step 1 — Migration (010_multi_project_support.py)**
- Create `projects` table; insert Portugal-2026 seed row
- Add nullable `project_id` to `tickets`, `categories`, `app_users`
- Backfill all rows; set NOT NULL on `tickets` and `categories`
- Create `project_members` join table; backfill all family_members
- Replace `UNIQUE (categories.name)` with `UNIQUE (name, project_id)`
- Add composite index `(project_id, purchased_at)` on tickets

**Step 2 — ORM Models**
- `project.py`: `Project` model + `ProjectMember` association table
- `app_user.py`: add `project_id` nullable FK + relationship
- `category.py`: add `project_id` NOT NULL FK + relationship
- `ticket.py`: add `project_id` NOT NULL FK + relationship

**Step 3 — Schemas**
- `project.py`: `ProjectCreate`, `ProjectUpdate`, `ProjectResponse`,
  `ProjectPublicResponse`, `ColorSuggestRequest`, `ColorSuggestResponse`,
  `ProjectMemberAdd`, `ProjectMemberResponse`

**Step 4 — Repository**
- `project_repository.py`:
  - `get_all()`, `get_by_id()`, `get_public_list()`
  - `create()`, `update()`, `set_status()`
  - `add_member()`, `remove_member()`, `get_members()`

**Step 5 — Service**
- `project_service.py`:
  - `create_project()` — creates project + seeds default categories
  - `update_project()`, `close_project()`, `reopen_project()`
  - `add_member_to_project()`, `remove_member_from_project()`
  - `suggest_colors(query)` — OpenAI call, returns hex triple

**Step 6 — Dependencies (dependencies.py)**
- `get_current_project_id(token) -> UUID` — extract from JWT
- `require_open_project(project_id, db) -> Project` — 403 if closed
- Update `get_current_user` to embed `project_id` in token and expose via dependency

**Step 7 — Auth Router (auth.py)**
- `POST /auth/login` — add optional `project_id` field; embed in JWT for admins
- `POST /auth/switch-project` — admin only; issue new JWT with updated `project_id`

**Step 8 — Projects Router (projects.py)**
- Wire all `/projects` and `/projects/{id}/members` endpoints

**Step 9 — Existing Routers (scoped queries)**
- `tickets.py`, `categories.py`, `members.py`, `balances.py`, `reports.py`:
  inject `get_current_project_id` dependency; pass to repository calls
- All POST/PUT/DELETE endpoints: inject `require_open_project`

**Step 10 — OCR Service**
- Add `language: str = "pt"` param to `process_upload` and `process_multiple_uploads`
- Inject language hint into `_SYSTEM_PROMPT_TEMPLATE`
- Update ticket router to pass `project.default_language` when calling OCR

**Step 11 — Tests**
- `test_projects.py`: full CRUD, close/reopen guard, color suggest (mocked OpenAI),
  member add/remove, project scoping assertions
- Update `test_auth.py`: switch-project endpoint
- Update `test_tickets.py`: cross-project isolation assertions
- Update OCR mock interface for language param

### Frontend Implementation Order

**Step 1 — API Client (api/projects.ts)**
- `getPublicProjects()`, `getProjects()`, `createProject()`, `updateProject()`
- `closeProject()`, `reopenProject()`, `suggestColors(query)`
- `getProjectMembers()`, `addProjectMember()`, `removeProjectMember()`

**Step 2 — ProjectContext (context/ProjectContext.tsx)**
- Store active project object (id, name, colors, status)
- `useEffect` to write CSS vars (`--project-bg`, `--project-text`, `--project-accent`)
  to `:root` whenever active project changes
- Expose `switchProject(projectId)` — calls `POST /auth/switch-project`, updates JWT,
  updates context

**Step 3 — Layout + Navbar**
- `Layout.tsx`: consume `ProjectContext`; no style changes needed (CSS vars handle it)
- `Navbar.tsx`: show project name badge; admin gets a dropdown to switch projects;
  show closed-project indicator (lock icon) when status = closed

**Step 4 — Login Page**
- `LoginPage.tsx`: call `getPublicProjects()` on mount; show `ProjectChooser` only
  for admin (determined after login, or show by default with auto-select for users);
  pass `project_id` in login body

**Step 5 — ProjectChooser Component**
- Dropdown list of projects; each item styled with project `bg_color`
- Shows closed indicator for closed projects

**Step 6 — ProjectsPage (admin only)**
- List all projects with status, colours preview, member count
- "New Project" button → `ProjectForm`
- Per-project actions: Edit, Close/Reopen, Manage Members

**Step 7 — ProjectForm Component**
- Fields: name, default_language (select), bg_color, text_color, accent_color (color pickers)
- "Suggest Colours" button → calls `suggestColors(name)` → populates pickers
- WCAG contrast ratio warning (client-side)
- React Hook Form + Zod validation

**Step 8 — ProjectCard Component**
- Displays project name, status badge, colour swatches, member count

**Step 9 — i18n Keys**
- Add keys to all three locale files:
  `projects.*`, `project.closed`, `project.open`, `project.suggestColors`,
  `project.language`, `project.members`, etc.

**Step 10 — Route Guard Update**
- `App.tsx`: add `/projects` route (admin only); redirect non-admin attempting to access it

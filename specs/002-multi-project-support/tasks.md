# Tasks: Multi-Project Support

**Input**: Design documents from `specs/002-multi-project-support/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅ quickstart.md ✅

**Tests**: Included — constitution mandates ≥80% backend coverage; OCR always mocked.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.
User stories from spec.md: US1 (P1) Create Project · US2 (P2) Manage Members · US3 (P3) Scoped Tickets ·
US4 (P4) Switch Projects · US5 (P5) Colour Scheme · US6 (P6) Migration

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)

---

## Phase 1: Setup

**Purpose**: Wire new files into the existing project; no logic yet.

- [ ] T001 Register new `projects` router in `backend/app/main.py` and add `project.py` + `project_member.py` imports to `backend/app/models/__init__.py`
- [ ] T002 [P] Create empty stub files: `backend/app/models/project.py`, `backend/app/repositories/project_repository.py`, `backend/app/services/project_service.py`, `backend/app/routers/projects.py`, `backend/app/schemas/project.py`
- [ ] T003 [P] Create empty stub files: `frontend/src/api/projects.ts`, `frontend/src/context/ProjectContext.tsx`, `frontend/src/pages/ProjectsPage.tsx`, `frontend/src/components/projects/ProjectCard.tsx`, `frontend/src/components/projects/ProjectForm.tsx`, `frontend/src/components/projects/ProjectChooser.tsx`

**Checkpoint**: All imports resolve; `docker compose up --build` succeeds with no new errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration + core backend plumbing that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Write `backend/alembic/versions/010_multi_project_support.py` — full migration per `data-model.md`: create `projects` table, insert Portugal-2026 seed row (`id='a0000000-0000-0000-0000-000000000001'`, `default_language='pt'`, green/white/gold colours, `status='open'`), add nullable `project_id` to `tickets`/`categories`/`app_users`, backfill all rows, set NOT NULL on `tickets`/`categories`, create `project_members` join table, backfill all family_members, replace `UNIQUE(categories.name)` with `UNIQUE(name, project_id)`, add composite index `(project_id, purchased_at)` on tickets
- [ ] T005 [P] Implement `Project` and `ProjectMember` SQLAlchemy models in `backend/app/models/project.py` — fields per data-model.md: id, name, default_language, bg_color, text_color, accent_color, status CHECK(`open`/`closed`), created_at; join table with PK(project_id, member_id), joined_at
- [ ] T006 [P] Update `backend/app/models/app_user.py` — add nullable `project_id` UUID FK → `projects.id` with relationship
- [ ] T007 [P] Update `backend/app/models/category.py` — add `project_id` UUID FK NOT NULL → `projects.id` with relationship; remove module-level `UNIQUE(name)` index (migration replaces it)
- [ ] T008 [P] Update `backend/app/models/ticket.py` — add `project_id` UUID FK NOT NULL → `projects.id` with relationship and index
- [ ] T009 Implement `backend/app/schemas/project.py` — `ProjectCreate`, `ProjectUpdate`, `ProjectResponse`, `ProjectPublicResponse`, `ColorSuggestRequest`, `ColorSuggestResponse`, `ProjectMemberAdd`, `ProjectMemberResponse`, `SwitchProjectRequest`
- [ ] T010 Implement `backend/app/repositories/project_repository.py` — async methods: `get_all()`, `get_by_id()`, `get_public_list()`, `create()`, `update()`, `set_status()`, `add_member()`, `remove_member()`, `get_members()`; all using `AsyncSession`
- [ ] T011 Update `backend/app/services/auth_service.py` — embed `project_id` (str UUID or `None`) and `role` in JWT payload; update `create_access_token()` and `decode_token()` accordingly
- [ ] T012 Update `backend/app/dependencies.py` — add `get_current_project_id(token) -> UUID` extracting `project_id` claim; add `require_open_project(project_id, db) -> Project` dependency returning 403 if project status is `closed`; add `require_admin(current_user)` dependency returning 403 if role ≠ admin
- [ ] T013 Update all existing repository query methods to accept `project_id: UUID` parameter and apply `WHERE project_id = :project_id` filter: `ticket_repository.py` (list, balance queries), `category_repository.py` (list), `balance_repository.py`, `report_repository.py`
- [ ] T014 Inject `get_current_project_id` into all existing routers (`tickets.py`, `categories.py`, `members.py`, `balances.py`, `reports.py`) — pass to repository calls; inject `require_open_project` on all POST/PUT/DELETE write handlers in those routers

**Checkpoint**: Migration runs on startup; all existing tests pass with the added project scope; `GET /tickets` scoped to Portugal-2026.

---

## Phase 3: User Story 6 — Data Migration to Portugal-2026 (Priority: P6) 🏗️

**Goal**: Verify the migration leaves zero data loss and all existing entities correctly attributed to Portugal-2026.

**Independent Test**: After `docker compose up --build`, querying tickets filtered to Portugal-2026 returns all pre-migration tickets; no orphaned records exist.

- [ ] T015 [P] [US6] Write migration integration tests in `backend/tests/test_migration.py` — assert Portugal-2026 project exists with correct language/colours, all tickets have `project_id` set, zero `NULL` project_id rows in tickets/categories, all family_members present in `project_members` for Portugal-2026, all `user`-role app_users linked to Portugal-2026
- [ ] T016 [P] [US6] Write `backend/tests/conftest.py` fixture additions — `portugal_project` fixture returning seeded project; `project_scoped_db_session` that injects project context into async test client headers
- [ ] T017 [US6] Validate down-migration in `010_multi_project_support.py` — implement `downgrade()` that reverses all 16 steps; run `alembic downgrade -1` then `alembic upgrade head` in CI validation

**Checkpoint**: `pytest tests/test_migration.py` passes; zero orphaned rows confirmed.

---

## Phase 4: User Story 1 — Admin Creates a New Project (Priority: P1) 🎯 MVP

**Goal**: Admin can create a project, receive LLM colour suggestions, and have the project ready for ticket entry.

**Independent Test**: Admin creates "France-2026", clicks Suggest Colours, reviews palette, sets language `fr`, saves — project appears in chooser on login screen.

- [ ] T018 Implement `backend/app/services/project_service.py` — `create_project()` (creates project + seeds 6 default categories for it), `update_project()`, `close_project()` (sets status=closed), `reopen_project()` (sets status=open), `suggest_colors(query: str) -> ColorSuggestResponse` (OpenAI JSON mode call returning bg/text/accent hex)
- [ ] T019 [P] [US1] Implement project CRUD endpoints in `backend/app/routers/projects.py`: `GET /projects` (admin), `POST /projects` (admin), `PUT /projects/{id}` (admin), `POST /projects/{id}/close` (admin), `POST /projects/{id}/reopen` (admin), `POST /projects/suggest-colors` (admin)
- [ ] T020 [P] [US1] Implement `GET /projects/public-list` (no auth) in `backend/app/routers/projects.py` — returns `{ id, name, bg_color, status }` list
- [ ] T021 [US1] Write `backend/tests/test_projects.py` — test create (201, duplicate 409), update, close (403 on write after close), reopen, suggest_colors (mock OpenAI returning fixture hex values), public-list (no auth), admin-only guard (403 for user role)
- [ ] T022 [P] [US1] Implement `frontend/src/api/projects.ts` — `getPublicProjects()`, `getProjects()`, `createProject()`, `updateProject()`, `closeProject()`, `reopenProject()`, `suggestColors(query)`; all using existing `client.ts` axios instance
- [ ] T023 [P] [US1] Implement `frontend/src/context/ProjectContext.tsx` — React context holding active project (`id`, `name`, `bg_color`, `text_color`, `accent_color`, `status`); expose `setActiveProject()` and `switchProject(projectId)` (calls `POST /auth/switch-project`, stores new JWT, updates context); `useEffect` writing CSS vars `--project-bg`, `--project-text`, `--project-accent` to `document.documentElement.style` on project change
- [ ] T024 [US1] Implement `frontend/src/components/projects/ProjectForm.tsx` — React Hook Form + Zod; fields: name (required), default_language (select: pt/fr/es/de/en/other), bg_color/text_color/accent_color (HTML color pickers); "Suggest Colours" button calling `suggestColors(name)` populating pickers; WCAG contrast ratio warning computed client-side; submit calls create or update API
- [ ] T025 [P] [US1] Implement `frontend/src/components/projects/ProjectCard.tsx` — displays project name, status badge (open/closed), colour swatches, default language tag; edit and close/reopen action buttons (admin only)
- [ ] T026 [US1] Implement `frontend/src/pages/ProjectsPage.tsx` — lists all projects using `getProjects()`; "New Project" button opening `ProjectForm` in a modal/drawer; per-card actions wired to `closeProject`/`reopenProject`/`updateProject`; member management section (stub, wired in US2)
- [ ] T027 [US1] Add `/projects` route to `frontend/src/App.tsx` guarded by admin role check; redirect non-admin to dashboard; add "Projects" link to Navbar only for admin users

**Checkpoint**: Admin can create a project, receive LLM colour suggestions, and see it in the projects list; `pytest tests/test_projects.py` passes.

---

## Phase 5: User Story 4 — Admin Switches Between Projects (Priority: P4)

**Goal**: Admin can select a project at login and switch projects via the navbar without re-authenticating.

**Independent Test**: Admin logs in selecting France-2026, navigates to tickets — sees only France tickets; switches to Portugal-2026 — sees only Portugal tickets.

- [ ] T028 Implement `POST /auth/switch-project` in `backend/app/routers/auth.py` — admin only; validates project exists; issues new JWT with updated `project_id`; returns `{ access_token, token_type, role, project_id }`
- [ ] T029 [P] [US4] Update `POST /auth/login` in `backend/app/routers/auth.py` — accept optional `project_id` field in request body; for admin: embed selected (or first available) project_id in JWT; for user role: embed assigned `app_users.project_id` (ignore request field)
- [ ] T030 [US4] Update `frontend/src/pages/LoginPage.tsx` — on mount call `getPublicProjects()`, show `ProjectChooser` dropdown if projects > 1 (or if user is determined to be admin after first login attempt); pass selected `project_id` in login body
- [ ] T031 [P] [US4] Implement `frontend/src/components/projects/ProjectChooser.tsx` — dropdown list; each option styled with project `bg_color`; closed projects shown with lock icon; emits `onChange(projectId)`
- [ ] T032 [US4] Update `frontend/src/components/layout/Navbar.tsx` — show active project name badge; admin gets ProjectChooser dropdown in navbar calling `switchProject()` from context; closed-project lock icon when `status === 'closed'`
- [ ] T033 [P] [US4] Write tests for switch-project in `backend/tests/test_auth.py` — successful switch returns new token with updated project_id; non-admin returns 403; unknown project returns 404
- [ ] T034 [US4] Write frontend MSW test in `frontend/src/pages/__tests__/LoginPage.test.tsx` — project chooser renders for admin, login body includes project_id, hidden for user-role accounts

**Checkpoint**: Admin can log in choosing France-2026 and switch to Portugal-2026 from the navbar; all list views refresh to the correct project's data.

---

## Phase 6: User Story 5 — Project Colour Scheme Applied to UI (Priority: P5)

**Goal**: The application shell reflects the active project's colour scheme; switching projects updates the palette immediately.

**Independent Test**: Portugal-2026 (green navbar) → switch to France-2026 (blue navbar) → CSS vars update within 1 second with no page reload.

- [ ] T035 [US5] Verify `ProjectContext.tsx` `useEffect` applies `--project-bg`, `--project-text`, `--project-accent` CSS vars on `:root`; Portugal-2026 seed values default to `#006600`, `#FFFFFF`, `#FFD700`
- [ ] T036 [P] [US5] Update `frontend/src/components/layout/Layout.tsx` — apply `bg-[var(--project-bg)]` and `text-[var(--project-text)]` Tailwind arbitrary value classes to the top-level nav/header shell; wrap app in `ProjectContext.Provider`
- [ ] T037 [P] [US5] Update `frontend/src/components/layout/Navbar.tsx` — use `var(--project-accent)` for active link highlight; ensure all nav text uses `var(--project-text)` so contrast is correct per project config
- [ ] T038 [US5] Write frontend unit test in `frontend/src/context/__tests__/ProjectContext.test.tsx` — switching project updates CSS vars on `document.documentElement`; verify with RTL `getComputedStyle` or direct DOM assertion

**Checkpoint**: Switching projects in the navbar instantly changes navbar and header colours; no page reload required.

---

## Phase 7: User Story 2 — Admin Manages Project Members (Priority: P2)

**Goal**: Admin can add/remove family members from a project; non-admin users see only their project's members.

**Independent Test**: Admin adds "Alice" to France-2026; a user scoped to France-2026 sees Alice in allocation selectors; removing Alice from France-2026 removes her from selectors there while keeping her in Portugal-2026.

- [ ] T039 Implement `GET /projects/{id}/members`, `POST /projects/{id}/members`, `DELETE /projects/{id}/members/{member_id}` in `backend/app/routers/projects.py` per contracts/api.md; inject `require_open_project` on POST and DELETE
- [ ] T040 [P] [US2] Update `backend/app/repositories/member_repository.py` — `get_members_for_project(project_id)` query using `project_members` join; update allocation selector query to filter by `project_members` join so only project-linked active members appear
- [ ] T041 [P] [US2] Update `backend/app/services/project_service.py` — implement `add_member_to_project()` (409 if already member, 403 if closed) and `remove_member_from_project()` (404 if not member)
- [ ] T042 [US2] Extend `backend/tests/test_projects.py` — add_member (201), duplicate (409), remove (204), remove non-member (404), closed-project guard (403); assert GET /members returns only project-linked members after join
- [ ] T043 [P] [US2] Add member management section to `frontend/src/pages/ProjectsPage.tsx` — expandable panel per project listing linked members; "Add Member" select (all global members not yet in project) and remove button; wire to `addProjectMember()`/`removeProjectMember()` from `api/projects.ts`
- [ ] T044 [US2] Extend `frontend/src/api/projects.ts` — `getProjectMembers(projectId)`, `addProjectMember(projectId, memberId)`, `removeProjectMember(projectId, memberId)`
- [ ] T045 [US2] Write MSW test in `frontend/src/pages/__tests__/ProjectsPage.test.tsx` — member list renders for project, add member calls correct endpoint, remove member removes from list

**Checkpoint**: A member added to France-2026 appears in ticket allocation selectors only when scoped to France-2026; Portugal-2026 selectors unaffected.

---

## Phase 8: User Story 3 — Project-Scoped Ticket Entry (Priority: P3)

**Goal**: Ticket creation is automatically scoped to the active project; OCR uses the project's default language for better extraction.

**Independent Test**: User scoped to France-2026 uploads a French receipt; OCR prompt includes `"The receipt is written in fr"`; ticket is saved under France-2026 and absent from Portugal-2026 ticket list.

- [ ] T046 Update `backend/app/services/ocr_service.py` — add `language: str = "pt"` parameter to `process_upload()` and `process_multiple_uploads()`; inject `"The receipt is written in {language}."` line into `_SYSTEM_PROMPT_TEMPLATE` before the rules block
- [ ] T047 [P] [US3] Update ticket router in `backend/app/routers/tickets.py` — on upload, query `project.default_language` from DB and pass to `ocr_service.process_upload(language=project.default_language)`; ensure `project_id` from JWT is set on new `Ticket` records
- [ ] T048 [P] [US3] Update `backend/tests/conftest.py` — update OCR mock fixture to accept and record `language` kwarg; add `assert_language_passed` helper for test assertions
- [ ] T049 [US3] Extend `backend/tests/test_tickets.py` — assert ticket created by France-2026 user is absent from Portugal-2026 ticket list; assert OCR called with `language="fr"` when project default_language is fr; assert `require_open_project` blocks ticket creation on closed project (403)
- [ ] T050 [US3] Update `backend/tests/test_balances.py` and `backend/tests/test_reports.py` — assert balance and report queries return only data from the active project; cross-project data does not leak

**Checkpoint**: Uploading a receipt in France-2026 returns OCR with French language hint; the ticket is invisible from Portugal-2026 views.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: i18n completeness, coverage gate, final validation.

- [ ] T051 [P] Add all project-related i18n keys to `frontend/src/locales/en/translation.json`, `frontend/src/locales/ru/translation.json`, `frontend/src/locales/pt/translation.json` — keys: `projects.title`, `projects.new`, `projects.edit`, `projects.close`, `projects.reopen`, `projects.closed`, `projects.open`, `projects.suggestColors`, `projects.language`, `projects.members`, `projects.members.add`, `projects.members.remove`, `projects.colorScheme`, `projects.switchProject`; ensure zero missing keys in all three locales
- [ ] T052 [P] Update `frontend/src/index.css` or Tailwind config — document CSS custom property names (`--project-bg`, `--project-text`, `--project-accent`) with default fallback values matching Portugal-2026 seed colours so the app renders correctly before `ProjectContext` hydrates
- [ ] T053 Run `pytest --cov=app --cov-fail-under=80` in `backend/`; identify and fill any coverage gaps in `test_projects.py`, `test_auth.py`, `test_tickets.py`
- [ ] T054 Run quickstart.md validation steps end-to-end: `docker compose up --build`, confirm migration ran, log in as admin, create a new project via UI, switch to it, create a ticket, confirm project isolation in ticket list
- [ ] T055 [P] Update `backend/app/config.py` `.env.example` if any new env vars were introduced (none expected — `OPENAI_API_KEY` already present); document `default_language` values accepted by OCR in `quickstart.md`

**Checkpoint**: All tests pass, ≥80% coverage, quickstart validation succeeds end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US6 Migration)**: Depends on Phase 2 — validates the migration
- **Phase 4 (US1)**: Depends on Phase 2 — first user-facing story
- **Phase 5 (US4)**: Depends on Phase 2 + T019 (project endpoints exist) + T023 (ProjectContext)
- **Phase 6 (US5)**: Depends on T023 (ProjectContext) + T032 (Navbar)
- **Phase 7 (US2)**: Depends on Phase 2 + T039 (member endpoints)
- **Phase 8 (US3)**: Depends on Phase 2 + T046 (OCR language param)
- **Phase 9 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US6 (P6 — Migration)**: Foundational; validates Phase 2 output
- **US1 (P1 — Create Project)**: Independent after Foundational
- **US4 (P4 — Switch Projects)**: Depends on US1 (projects must exist to switch between)
- **US5 (P5 — Colour Scheme)**: Depends on US4 (ProjectContext must be populated by switch flow)
- **US2 (P2 — Manage Members)**: Independent after Foundational (parallel with US1)
- **US3 (P3 — Scoped Tickets)**: Depends on Foundational router scoping (T014)

### Parallel Opportunities

Within Phase 2: T005, T006, T007, T008 can run in parallel after T004 (models created)
Within Phase 4: T019, T020, T022, T023, T025 can run in parallel
Within Phase 5: T029, T031, T033 can run in parallel
Phase 7 and Phase 8 can run in parallel with each other after Phase 2 completes

---

## Parallel Example: Phase 4 (US1 — Create Project)

```bash
# Backend and frontend can run in parallel once models/schemas exist (T009):
Backend Agent:  "Implement project_service.py (T018)"
Backend Agent:  "Implement projects router CRUD endpoints (T019)"
Frontend Agent: "Implement api/projects.ts API client (T022)"
Frontend Agent: "Implement ProjectContext.tsx (T023)"
Frontend Agent: "Implement ProjectCard.tsx (T025)"
```

---

## Implementation Strategy

### MVP First (US1 + US4 + Foundation)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US6 Migration Validation)
3. Complete Phase 4 (US1 — Create Project)
4. Complete Phase 5 (US4 — Switch Projects)
5. **STOP and VALIDATE**: Admin can create projects and switch between them; Portugal-2026 data intact
6. Deploy / demo

### Incremental Delivery

1. Foundation + Migration → existing app works with project scope, Portugal-2026 as default
2. US1 (Create Project) → admin can create France-2026 with custom colours
3. US4 (Switch Projects) → admin can navigate between projects
4. US5 (Colour Scheme) → visual differentiation
5. US2 (Manage Members) → member assignment per project
6. US3 (Scoped Tickets) → OCR language + full isolation

### Parallel Team Strategy

With two agents/developers:
- **Agent A**: Phase 2 migration + backend (T004–T014)
- **Agent B**: Phase 1 stubs + frontend scaffolding (T001–T003, T022–T023)
- After Phase 2: Agent A takes backend stories (US1 backend, US4 backend); Agent B takes frontend stories (US1 frontend, US4 frontend)

---

## Notes

- [P] tasks operate on different files and have no incomplete-task dependencies
- Migration T004 is the single most critical task — all other tasks depend on it running correctly
- OCR mock (T048) must be updated before any ticket tests are run in the new branch
- CSS vars must have fallback values (T052) to prevent flash of unstyled project shell on first load
- `require_open_project` dependency (T012) must be injected on ALL write handlers in existing routers (T014) before any story-level testing begins

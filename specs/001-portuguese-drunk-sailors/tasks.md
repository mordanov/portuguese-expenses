---
description: "Task list for Portuguese Drunk Sailors implementation"
---

# Tasks: Portuguese Drunk Sailors

**Input**: Design documents from `specs/001-portuguese-drunk-sailors/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅ quickstart.md ✅

**Implementation mechanism**: `run-agents.sh` dispatches tasks to specialist agents via Brainstorm MCP.
Each task carries an **agent label** (`[PA]`, `[SA]`, `[SEC]`, `[PM]`, `[BE]`, `[FE]`, `[DO]`, `[AT]`, `[CR]`)
indicating the responsible agent. Story labels (`[US1]`–`[US6]`) trace tasks back to spec.md user stories.

**CRITICAL — JWT algorithm**: The spec draft listed HS256. The constitution (§ III) mandates **RS256**.
All agents must use RS256. See `research.md` "JWT Algorithm" section. Agent files that reference HS256
are superseded by the constitution.

**Project Administrator is the most important reporter.** Every completed task requires:
1. `../scripts/report-task-metrics.sh` written to SQLite
2. Brainstorm `task-metrics` message to `project-administrator`
3. Ticket Manager ticket transitioned to `IN_REVIEW`
No task is complete without all three steps.

## Format: `[ID] [Agent] [P?] [Story?] Description — file: path`

- **[Agent]**: `[PA]` `[SA]` `[SEC]` `[PM]` `[BE]` `[FE]` `[DO]` `[AT]` `[CR]`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: User story traceability (US1–US6 from spec.md)
- All file paths relative to repository root

---

## Phase 1: Platform Bootstrap

**Purpose**: Initialize reporting infrastructure and provision all agent accounts before any code is written.
Project Administrator must complete this phase entirely before other agents begin.

**⚠️ PRE-REQUISITE (human step)**: Place Ticket Manager admin credentials in
`project-administrator/credentials.json` (see `project-administrator/credentials.json.example`).
PA cannot start without this file.

- [ ] T001 [PA] Initialize SQLite metrics database — file: `project-administrator/agent_metrics.py` (run `python agent_metrics.py init`)
- [ ] T002 [PA] Authenticate to Ticket Manager as admin using `project-administrator/credentials.json` and store JWT for session
- [ ] T003 [PA] Bootstrap agent accounts: create or verify accounts for all 8 roles (`product-manager`, `software-architect`, `security-architect`, `backend`, `frontend`, `devops`, `code-reviewer`, `autotester`) and write each role's `credentials.json` per bootstrap sequence in `agents/project-administrator.md`
- [ ] T004 [PA] Broadcast `bootstrap-complete` signal via Brainstorm MCP to all agents with Ticket Manager host/port — payload: `{type: "bootstrap-complete", host, port, roles}`
- [ ] T005 [PA] Broadcast reporting contract to all agents: include `../scripts/report-task-metrics.sh` command template and `task-metrics` brainstorm message shape from `agents/project-administrator.md`
- [ ] T006 [PA] Create Ticket Manager project `portuguese-expenses` and record project_id for all subsequent ticket creation

**Checkpoint**: All agents have credentials, know the reporting contract, and PA is actively collecting.

---

## Phase 2: Architecture & Security Review

**Purpose**: SA and SEC review plan and contracts before any code is written. Issues found here are cheaper to fix.

- [ ] T007 [SA] [P] Review `specs/001-portuguese-drunk-sailors/plan.md` and `contracts/api.md` for architectural completeness; flag any contract gaps or layer separation concerns; create Ticket Manager ticket for each finding
- [ ] T008 [SEC] [P] Threat-model the authentication flow (RS256 JWT, bcrypt, env-var seeded users), receipt upload flow (file validation, pdf2image, OCR), and CORS configuration per `agents/security-architect.md`; document findings in `specs/001-portuguese-drunk-sailors/security-review.md`
- [ ] T009 [SEC] [P] Define security acceptance criteria for upload endpoint (`POST /tickets/upload`): file type/size gate, no SSRF via pdf2image, OCR JSON treated as untrusted, no persistence before confirmation — file: `specs/001-portuguese-drunk-sailors/security-review.md`
- [ ] T010 [PM] [P] Confirm user story priorities P1–P6, MVP scope (US6→US5→US1→US2→US3→US4), and acceptance criteria completeness against `specs/001-portuguese-drunk-sailors/spec.md`; create Ticket Manager tickets for each user story phase

**Checkpoint**: Architecture and security concerns documented. PM has confirmed priorities. Implementation can begin.

---

## Phase 3: DevOps Foundation

**Purpose**: Docker Compose infrastructure, environment config, and CI skeleton. Blocks all Phase 4+ work
that needs `docker compose up --build` to validate.

- [ ] T011 [DO] Create `docker-compose.yml` with three services: `db` (postgres:16), `backend` (Python 3.12), `frontend` (Node 20) — file: `docker-compose.yml`
- [ ] T012 [DO] [P] Create `backend/Dockerfile`: multi-stage build, Python 3.12-slim, installs poppler-utils for pdf2image, copies `requirements.txt`, runs `alembic upgrade head` as entrypoint pre-command — file: `backend/Dockerfile`
- [ ] T013 [DO] [P] Create `frontend/Dockerfile`: Node 20 build stage + nginx serve stage; sets `VITE_API_BASE_URL` at build time — file: `frontend/Dockerfile`
- [ ] T014 [DO] Create `.env.example` with all required variables documented: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ALGORITHM=RS256`, `JWT_EXPIRE_MINUTES`, `APP_USER_1_USERNAME`, `APP_USER_1_PASSWORD`, `APP_USER_2_USERNAME`, `APP_USER_2_PASSWORD`, `OPENAI_API_KEY`, `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB`, `FRONTEND_URL`, `VITE_API_BASE_URL` — file: `.env.example`
- [ ] T015 [DO] [P] Add `.gitignore` entries: `*.env`, `.env`, `*/credentials.json`, `project-administrator/agent_metrics.db`, `backend/uploads/`, `**/__pycache__/`, `frontend/node_modules/`, `frontend/dist/` — file: `.gitignore`
- [ ] T016 [DO] Create `backend/pyproject.toml` with black, isort, mypy, flake8 configuration matching constitution requirements — file: `backend/pyproject.toml`
- [ ] T017 [DO] [P] Create `backend/.pre-commit-config.yaml` with hooks: black, isort, flake8, mypy — file: `backend/.pre-commit-config.yaml`
- [ ] T018 [DO] Add RSA key pair generation instructions to `specs/001-portuguese-drunk-sailors/quickstart.md` (already drafted — verify openssl commands are correct and tested)
- [ ] T019 [CR] Review DevOps Phase 3 output: Dockerfiles, docker-compose.yml, .env.example, pyproject.toml; verify no secrets committed, constitution compliance, and `docker compose up --build` succeeds with dummy `.env`

**Checkpoint**: `docker compose up --build` starts all three services (may have no app logic yet — just containers up).

---

## Phase 4: Backend Foundation

**Purpose**: FastAPI app skeleton, async DB layer, Alembic migrations for all entities, JWT RS256 middleware.
All backend user story tasks depend on this phase.

- [ ] T020 [BE] Create `backend/requirements.txt` with pinned versions: fastapi, uvicorn[standard], sqlalchemy[asyncio]≥2.0, asyncpg, alembic, pydantic-settings, python-jose[cryptography], bcrypt, passlib, python-multipart, openai≥1.0, pdf2image, pillow — file: `backend/requirements.txt`
- [ ] T021 [BE] [P] Create `backend/requirements-dev.txt`: pytest, pytest-asyncio, httpx, pytest-cov, pre-commit — file: `backend/requirements-dev.txt`
- [ ] T022 [BE] Create `backend/app/config.py` using pydantic-settings: load all env vars from `.env.example`, expose typed `Settings` singleton — file: `backend/app/config.py`
- [ ] T023 [BE] Create `backend/app/database.py`: async engine with asyncpg, `async_sessionmaker`, `get_async_session` dependency — file: `backend/app/database.py`
- [ ] T024 [BE] Create Alembic environment: `backend/alembic/env.py` with async support for asyncpg, reads `DATABASE_URL` from env — file: `backend/alembic/env.py`
- [ ] T025 [BE] Create migration `001_initial_schema.py`: all five tables (`family_members`, `categories`, `tickets`, `items`, `allocations`, `app_users`) with NUMERIC(10,2) money columns, UUID PKs, FK constraints, indexes — file: `backend/alembic/versions/001_initial_schema.py`; reference: `data-model.md`
- [ ] T026 [BE] Create migration `002_seed_default_categories.py`: insert 6 default categories (Wine `#722F37`, Meals `#4CAF50`, Entertainment `#2196F3`, Gifts `#E91E63`, Parking `#FF9800`, Other `#9E9E9E`) — file: `backend/alembic/versions/002_seed_default_categories.py`
- [ ] T027 [BE] Create `backend/app/models/`: one file per entity (`family_member.py`, `category.py`, `ticket.py`, `item.py`, `allocation.py`, `app_user.py`) using SQLAlchemy 2.x `DeclarativeBase`; no business logic; NUMERIC(10,2) for all money fields — files: `backend/app/models/*.py`
- [ ] T028 [BE] Create `backend/app/dependencies.py`: `get_async_session` (yields DB session), `get_current_user` (validates RS256 JWT from Authorization header, raises 401 if invalid/missing) — file: `backend/app/dependencies.py`
- [ ] T029 [BE] Create `backend/app/main.py`: FastAPI app factory, CORS middleware locked to `FRONTEND_URL` env var (no wildcard), include all routers, startup event runs `alembic upgrade head` — file: `backend/app/main.py`
- [ ] T030 [BE] Create `backend/app/repositories/base.py` with base async repository pattern (get_by_id, list, create, update, delete helpers) — file: `backend/app/repositories/base.py`
- [ ] T031 [BE] Create `backend/tests/conftest.py`: async test client, in-memory SQLite or test-postgres session fixture, JWT test token fixture, mock OCR fixture — file: `backend/tests/conftest.py`
- [ ] T032 [CR] Review backend foundation (T020–T031): verify async-only DB access, RS256 JWT dependency, CORS locked to env var, NUMERIC(10,2) in models, no business logic in models/schemas, Alembic env async-compatible

**Checkpoint**: Backend app starts, all migrations apply, JWT middleware rejects unauthenticated requests.

---

## Phase 5: Frontend Foundation

**Purpose**: React/TS project, Tailwind + HeroUI, i18n setup, API client with JWT interceptor, route shell.
All frontend user story tasks depend on this phase. Can run in parallel with Phase 4 (different directory).

- [ ] T033 [FE] [P] Scaffold `frontend/` with Vite + React 18 + TypeScript strict: `npm create vite@latest frontend -- --template react-ts`; configure `tsconfig.json` with `"strict": true` — file: `frontend/package.json`, `frontend/tsconfig.json`
- [ ] T034 [FE] [P] Install and configure Tailwind CSS + HeroUI in `frontend/`: `tailwind.config.ts` with Portuguese flag palette (`#006600`, `#FF0000`, `#FFD700`, `#FAFAF5`) as custom colors — file: `frontend/tailwind.config.ts`
- [ ] T035 [FE] [P] Install and configure i18next + react-i18next; create skeleton translation files with at least `nav.*` and `auth.*` keys for EN/RU/PT; configure `frontend/src/i18n.ts` with missing-key detection in dev mode — files: `frontend/src/i18n.ts`, `frontend/src/locales/en/translation.json`, `frontend/src/locales/ru/translation.json`, `frontend/src/locales/pt/translation.json`
- [ ] T036 [FE] Create `frontend/src/api/client.ts`: axios instance with `VITE_API_BASE_URL`, Bearer JWT interceptor (reads token from localStorage), 401 redirect to `/login` — file: `frontend/src/api/client.ts`
- [ ] T037 [FE] Create `frontend/src/App.tsx`: React Router v6 route shell with all 9 routes (`/login`, `/`, `/tickets`, `/tickets/new`, `/tickets/:id`, `/members`, `/categories`, `/reports`, `/balances`); `ProtectedRoute` wrapper redirects unauthenticated users to `/login` — file: `frontend/src/App.tsx`
- [ ] T038 [FE] Create `frontend/src/components/layout/Navbar.tsx`: app title "Portuguese Drunk Sailors", language switcher (EN 🇬🇧 / RU 🇷🇺 / PT 🇵🇹) that persists locale to localStorage, logout button; uses `#006600`/`#FF0000`/`#FFD700` palette — file: `frontend/src/components/layout/Navbar.tsx`
- [ ] T039 [FE] Create `frontend/src/components/layout/Layout.tsx`: page wrapper with Navbar + main content area + i18n-keyed page titles — file: `frontend/src/components/layout/Layout.tsx`
- [ ] T040 [FE] Create `frontend/src/components/shared/MoneyDisplay.tsx`: renders monetary values as `€X.XX` (always 2 decimal places, euro symbol); accepts `Decimal`-compatible string prop — file: `frontend/src/components/shared/MoneyDisplay.tsx`
- [ ] T041 [FE] Configure Vitest + React Testing Library + MSW: `frontend/vitest.config.ts`, `frontend/tests/setup.ts`, `frontend/tests/mocks/handlers.ts` skeleton — files: `frontend/vitest.config.ts`, `frontend/tests/setup.ts`, `frontend/tests/mocks/handlers.ts`
- [ ] T042 [CR] Review frontend foundation (T033–T041): verify TypeScript strict mode, HeroUI imported correctly, i18n keys not hardcoded in JSX, MoneyDisplay uses 2 decimals + €, ProtectedRoute guards all non-login routes

**Checkpoint**: `npm run dev` starts frontend; `/login` route renders; Navbar shows language switcher.

---

## Phase 6: User Story 6 — Authentication (Priority: P6)

**Goal**: Two pre-configured users can log in and receive a JWT (RS256). All non-login routes require a valid JWT.
**Independent Test**: Pre-configured user logs in, receives token, accesses `/`, and is redirected on logout.

- [ ] T043 [BE] [US6] Create migration `003_seed_app_users.py`: read `APP_USER_1_*` and `APP_USER_2_*` from env, hash passwords with bcrypt, insert into `app_users` — file: `backend/alembic/versions/003_seed_app_users.py`
- [ ] T044 [BE] [US6] Create `backend/app/repositories/auth_repository.py`: `get_user_by_username(session, username) -> AppUser | None` — file: `backend/app/repositories/auth_repository.py`
- [ ] T045 [BE] [US6] Create `backend/app/services/auth_service.py`: `verify_password(plain, hashed)`, `create_access_token(username)` using RS256 with `JWT_PRIVATE_KEY`, `decode_access_token(token)` using `JWT_PUBLIC_KEY` — file: `backend/app/services/auth_service.py`
- [ ] T046 [BE] [US6] Create `backend/app/schemas/auth.py`: `LoginRequest(username, password)`, `TokenResponse(access_token, token_type)` — file: `backend/app/schemas/auth.py`
- [ ] T047 [BE] [US6] Create `backend/app/routers/auth.py`: `POST /auth/login` — calls `AuthService`, returns `TokenResponse`; no JWT required on this endpoint — file: `backend/app/routers/auth.py`
- [ ] T048 [BE] [US6] Write `backend/tests/test_auth.py`: valid login returns 200 + token; invalid credentials returns 401; unauthenticated request to `/members` returns 401 — file: `backend/tests/test_auth.py`
- [ ] T049 [FE] [US6] Create `frontend/src/api/auth.ts`: `login(username, password)` → calls `POST /auth/login`, stores token in localStorage; `logout()` → clears token; `isAuthenticated()` — file: `frontend/src/api/auth.ts`
- [ ] T050 [FE] [US6] Create `frontend/src/pages/LoginPage.tsx`: React Hook Form + Zod schema `{username: string, password: string}`; calls `auth.login()`; redirects to `/` on success; shows i18n error on 401; no registration link; uses Portuguese flag palette — file: `frontend/src/pages/LoginPage.tsx`; i18n keys: `auth.username`, `auth.password`, `auth.login`, `auth.invalidCredentials`
- [ ] T051 [FE] [US6] Write login page test: valid credentials redirect to `/`; invalid credentials show error; form validates required fields — file: `frontend/tests/pages/LoginPage.test.tsx`
- [ ] T052 [SEC] [US6] Review auth implementation: verify bcrypt used (not MD5/SHA), RS256 JWT (not HS256), JWT_PRIVATE_KEY/JWT_PUBLIC_KEY sourced only from env, plain-text password never logged, no registration endpoint, CORS still locked

**Checkpoint**: `POST /auth/login` returns RS256 JWT; all other endpoints return 401 without token; LoginPage functional.

---

## Phase 7: User Story 5 — Reference Data Management (Priority: P5)

**Goal**: Users manage family members (add/rename/deactivate) and categories (add/rename/delete with guard).
**Independent Test**: Add member, allocate to ticket, deactivate — member gone from selectors, historical allocation intact. Add category, assign to item, try delete — blocked.

- [ ] T053 [BE] [P] [US5] Create `backend/app/repositories/member_repository.py`: `list_all`, `list_active`, `get_by_id`, `create`, `update`, `soft_delete` — file: `backend/app/repositories/member_repository.py`
- [ ] T054 [BE] [P] [US5] Create `backend/app/repositories/category_repository.py`: `list_all`, `get_by_id`, `create`, `update`, `delete` (raises if items reference it), `has_items(id)` — file: `backend/app/repositories/category_repository.py`
- [ ] T055 [BE] [US5] Create `backend/app/services/member_service.py`: `list_members(active_only)`, `create_member(name)`, `update_member(id, name, is_active)`, `deactivate_member(id)` — no business logic in repository; FK-safe soft delete — file: `backend/app/services/member_service.py`
- [ ] T056 [BE] [US5] Create `backend/app/services/category_service.py`: `list_categories`, `create_category(name, color)`, `update_category(id, name, color)`, `delete_category(id)` — raises `CategoryReferencedError` if items reference it — file: `backend/app/services/category_service.py`
- [ ] T057 [BE] [US5] Create `backend/app/schemas/member.py` and `backend/app/schemas/category.py`: request/response shapes per `contracts/api.md` (pagination wrapper, member/category objects) — files: `backend/app/schemas/member.py`, `backend/app/schemas/category.py`
- [ ] T058 [BE] [US5] Create `backend/app/routers/members.py`: `GET /members`, `POST /members`, `PUT /members/{id}`, `DELETE /members/{id}`; all require JWT; no business logic — file: `backend/app/routers/members.py`
- [ ] T059 [BE] [US5] Create `backend/app/routers/categories.py`: `GET /categories`, `POST /categories`, `PUT /categories/{id}`, `DELETE /categories/{id}`; DELETE returns 409 when category is referenced — file: `backend/app/routers/categories.py`
- [ ] T060 [BE] [P] [US5] Write `backend/tests/test_members.py`: create, rename, deactivate, list active-only, list all (deactivated retained) — file: `backend/tests/test_members.py`
- [ ] T061 [BE] [P] [US5] Write `backend/tests/test_categories.py`: create, rename, delete unreferenced, delete-blocked when referenced, color validation — file: `backend/tests/test_categories.py`
- [ ] T062 [FE] [P] [US5] Create `frontend/src/api/members.ts` and `frontend/src/api/categories.ts`: TanStack Query hooks `useMembers`, `useCreateMember`, `useUpdateMember`, `useDeactivateMember`, `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` — files: `frontend/src/api/members.ts`, `frontend/src/api/categories.ts`
- [ ] T063 [FE] [US5] Create `frontend/src/pages/MembersPage.tsx`: list all members with active/inactive indicator; add-member form (React Hook Form + Zod); inline rename; deactivate button with confirmation; i18n keys: `members.*` — file: `frontend/src/pages/MembersPage.tsx`
- [ ] T064 [FE] [US5] Create `frontend/src/pages/CategoriesPage.tsx`: list categories with colour swatch; add/rename form; delete with guard (show error from 409); colour picker input; i18n keys: `categories.*` — file: `frontend/src/pages/CategoriesPage.tsx`
- [ ] T065 [FE] [US5] Create `frontend/src/components/shared/MemberChip.tsx`: reusable chip showing member name; selected/unselected state; used in allocation step — file: `frontend/src/components/shared/MemberChip.tsx`
- [ ] T066 [CR] Review US5 backend: verify soft delete (no hard DELETE on family_members), category delete 409 logic in service (not router), pagination contract matches `contracts/api.md`, no business logic in routers
- [ ] T067 [AT] [US5] Verify US5 independently: deactivated member excluded from new allocation selectors but present in historical records; category deletion blocked when referenced — create verification test in `backend/tests/test_members.py` and `backend/tests/test_categories.py`

**Checkpoint**: Members and categories CRUD fully functional. MemberChip component ready for ticket wizard.

---

## Phase 8: User Story 1 — Receipt Capture & OCR Review (Priority: P1)

**Goal**: Upload receipt → OCR draft → editable table → payer selection. Nothing persisted until confirmation.
**Independent Test**: Upload JPEG → see extracted items in editable table → correct item → choose payer → reach allocation step.

- [ ] T068 [BE] [US1] Create `backend/app/services/ocr_service.py`: validates file (MIME type JPEG/PNG/WEBP/PDF, size ≤ 10 MB, raises `UploadValidationError` on fail); converts PDF first page with `pdf2image`; calls OpenAI gpt-4o vision with JSON-only system prompt; validates response with Pydantic `OCRDraft` schema; raises `OCRParseError` on invalid JSON, `OCRServiceError` on API failure — **OpenAI client MUST be injectable for mocking** — file: `backend/app/services/ocr_service.py`
- [ ] T069 [BE] [US1] Create `backend/app/schemas/ticket.py`: `OCRDraft` (store_name, purchased_at, items list, discount_total, total_price), `TicketCreateRequest` (all fields + items with member_ids), `TicketResponse`, `TicketListResponse` (paginated) — file: `backend/app/schemas/ticket.py`; reference: `contracts/api.md` POST /tickets/upload and POST /tickets
- [ ] T070 [BE] [US1] Create `backend/app/routers/tickets.py`: `POST /tickets/upload` — multipart upload, calls `OCRService`, returns `OCRDraft`; does NOT persist — file: `backend/app/routers/tickets.py`
- [ ] T071 [BE] [US1] Write `backend/tests/test_ocr_service.py`: OCR client MUST be mocked (constitution §II); test valid JPEG returns draft; test PDF conversion path; test malformed JSON raises `OCRParseError`; test invalid file type returns 422; test oversized file returns 422 — file: `backend/tests/test_ocr_service.py`
- [ ] T072 [BE] [US1] Write `backend/tests/test_tickets.py` (upload section): upload valid JPEG with mocked OCR returns 200 OCRDraft; upload PDF with mocked OCR returns 200; upload .exe returns 422; upload 11 MB file returns 422; upload with expired JWT returns 401 — file: `backend/tests/test_tickets.py`
- [ ] T073 [FE] [P] [US1] Create `frontend/src/api/tickets.ts`: `useUploadReceipt` mutation (multipart POST /tickets/upload), `useTickets` (paginated GET), `useTicket(id)`, `useCreateTicket`, `useUpdateTicket`, `useDeleteTicket` — file: `frontend/src/api/tickets.ts`
- [ ] T074 [FE] [US1] Create `frontend/src/components/tickets/UploadStep.tsx`: drag-and-drop zone + file picker; accepts JPEG/PNG/WEBP/PDF; shows file size error client-side before upload; calls `useUploadReceipt`; shows loading spinner; on success passes `OCRDraft` to parent wizard state — file: `frontend/src/components/tickets/UploadStep.tsx`; i18n keys: `upload.dragDrop`, `upload.fileTypes`, `upload.maxSize`, `upload.uploading`, `upload.error`
- [ ] T075 [FE] [US1] Create `frontend/src/components/tickets/ReviewStep.tsx`: renders editable table of items (name, price, category dropdown); store name and date fields editable; payer dropdown (active members only from `useMembers({active_only: true})`); discount_total field; live total — file: `frontend/src/components/tickets/ReviewStep.tsx`; i18n keys: `review.storeName`, `review.date`, `review.payer`, `review.items`, `review.name`, `review.price`, `review.category`, `review.discount`
- [ ] T076 [FE] [US1] Create `frontend/src/pages/NewTicketPage.tsx`: 4-step wizard shell with step indicator (`Upload → Review → Allocate → Confirm`); holds wizard state (`OCRDraft + edits`); renders correct step component; back/next navigation — file: `frontend/src/pages/NewTicketPage.tsx`; i18n keys: `wizard.steps.*`
- [ ] T077 [FE] [US1] Write upload + review step tests with MSW: valid upload shows editable table; invalid file type shows error; changing item name updates table; payer selection persists to next step — file: `frontend/tests/components/tickets/UploadStep.test.tsx`, `frontend/tests/components/tickets/ReviewStep.test.tsx`
- [ ] T078 [SEC] [US1] Review upload security: MIME type validated server-side (not just extension), file size gate before OCR call, pdf2image called on a temp file (no path traversal), OCR JSON response treated as untrusted input, no raw receipt data in logs

**Checkpoint**: Upload JPEG → OCR draft → editable table. Nothing persisted. Invalid files rejected with 422.

---

## Phase 9: User Story 2 — Cost Allocation (Priority: P2)

**Goal**: Allocate items to members; discount distributed proportionally; ticket saved atomically.
**Independent Test**: Ticket with items, discount, multi-member allocation → correct discounted prices and per-member costs; confirm saves everything atomically.

- [ ] T079 [BE] [US2] Create `backend/app/repositories/ticket_repository.py`: `create_ticket_with_items_and_allocations(session, data)` — atomic INSERT of ticket + items + allocations in one transaction; `get_ticket_with_detail(id)` — joined load of items + allocations + members — file: `backend/app/repositories/ticket_repository.py`
- [ ] T080 [BE] [US2] Create `backend/app/services/ticket_service.py`: `compute_discounted_prices(items, discount_total) -> list[Decimal]` using formula from `research.md`; `save_ticket(session, request)` — calls compute, then repository; validates `member_ids` non-empty per item; validates all `paid_by_id` and `member_id` exist and are active — file: `backend/app/services/ticket_service.py`
- [ ] T081 [BE] [US2] Add `POST /tickets` to `backend/app/routers/tickets.py`: calls `TicketService.save_ticket`; returns 201 with full ticket detail — file: `backend/app/routers/tickets.py`
- [ ] T082 [BE] [US2] Add `GET /tickets`, `GET /tickets/{id}`, `PUT /tickets/{id}`, `DELETE /tickets/{id}` to router; `GET /tickets` accepts `from`, `to`, `member_id`, `category_id` query params; filtering applied at DB level (no in-memory filtering) — file: `backend/app/routers/tickets.py`; reference: `contracts/api.md`
- [ ] T083 [BE] [US2] Create `backend/app/schemas/item.py`: `ItemUpdateRequest`, `AllocationReplaceRequest(member_ids)`, `AllocationResponse` — file: `backend/app/schemas/item.py`
- [ ] T084 [BE] [US2] Create `backend/app/repositories/item_repository.py` and `backend/app/routers/items.py`: `PUT /items/{id}` (update name/price/category/position, recalculate discounted_price), `PUT /items/{id}/allocations` (replace allocation list; reject empty member_ids with 422) — files: `backend/app/repositories/item_repository.py`, `backend/app/routers/items.py`
- [ ] T085 [BE] [US2] Extend `backend/tests/test_tickets.py`: proportional discount correct to 2 decimal places (Decimal, not float); total allocation split correct; inactive member in member_ids returns 422; empty member_ids returns 422; atomic save (all-or-nothing on DB error) — file: `backend/tests/test_tickets.py`
- [ ] T086 [FE] [US2] Create `frontend/src/components/tickets/AllocateStep.tsx`: for each item renders member chip multi-select (`MemberChip`); "select all" button per item; live per-member cost summary panel updates on each selection change using `item.price / selectedCount`; shows `€X.XX` format via `MoneyDisplay` — file: `frontend/src/components/tickets/AllocateStep.tsx`; i18n keys: `allocate.selectMembers`, `allocate.selectAll`, `allocate.memberCost`, `allocate.perMember`
- [ ] T087 [FE] [US2] Create `frontend/src/components/tickets/ConfirmStep.tsx`: read-only summary of store, date, payer, items with discounted prices, per-member costs; "Confirm & Save" calls `useCreateTicket`; on success redirects to `/tickets` — file: `frontend/src/components/tickets/ConfirmStep.tsx`; i18n keys: `confirm.summary`, `confirm.save`, `confirm.saving`
- [ ] T088 [FE] [US2] Create `frontend/src/pages/TicketDetailPage.tsx`: full ticket view with items + allocations; edit mode toggles to editable form; delete with confirmation — file: `frontend/src/pages/TicketDetailPage.tsx`
- [ ] T089 [FE] [US2] Create `frontend/src/pages/TicketsPage.tsx`: paginated list with filters (date range, member, category); uses `useTickets`; links to ticket detail and new ticket — file: `frontend/src/pages/TicketsPage.tsx`; i18n keys: `tickets.title`, `tickets.filters.*`, `tickets.empty`
- [ ] T090 [FE] [US2] Write allocation step tests: selecting 2 members on €10 item shows €5.00 each; "select all" selects all 8 members; unselecting one member updates summary; confirm button disabled when any item has 0 allocations — file: `frontend/tests/components/tickets/AllocateStep.test.tsx`
- [ ] T091 [FE] [US2] Create `frontend/src/components/shared/DateRangePicker.tsx`: date range input component used by tickets, reports, and balances pages — file: `frontend/src/components/shared/DateRangePicker.tsx`
- [ ] T092 [CR] Review US2 ticket save and allocation: verify Decimal arithmetic (no floats), atomic transaction in repository, discount formula exact match to `research.md`, DB-level filtering on GET /tickets, allocation replace rejects empty array

**Checkpoint**: Full 4-step ticket wizard works end-to-end. Ticket saved with correct discounted prices.

---

## Phase 10: User Story 3 — Balance Tracking (Priority: P3)

**Goal**: Pairwise net balances across all tickets or filtered by date range.
**Independent Test**: Two tickets with different payers → balance screen shows correct net directional amounts.

- [ ] T093 [BE] [US3] Create `backend/app/repositories/balance_repository.py`: SQL CTE query — pass 1: gross amounts (sum of `item.discounted_price / allocation_count` per creditor/debtor pair); pass 2: net = `gross(A→B) - gross(B→A)`; filter by `from`/`to` date range on `ticket.purchased_at`; only return rows where net > 0 — file: `backend/app/repositories/balance_repository.py`; reference: `research.md` "Pairwise Balance Algorithm"
- [ ] T094 [BE] [US3] Create `backend/app/services/balance_service.py`: wraps repository, formats `Decimal` amounts as strings, returns `BalanceResponse` — file: `backend/app/services/balance_service.py`
- [ ] T095 [BE] [US3] Create `backend/app/schemas/balance.py`: `BalanceEntry(debtor, creditor, amount)`, `BalanceResponse(balances, as_of)` — file: `backend/app/schemas/balance.py`
- [ ] T096 [BE] [US3] Create `backend/app/routers/balances.py`: `GET /balances?from=&to=`; JWT required — file: `backend/app/routers/balances.py`
- [ ] T097 [BE] [US3] Write `backend/tests/test_balances.py`: net balance correct across two tickets (€30 A→B minus €10 B→A = €20); zero-balance row omitted; date range filter excludes older ticket; no tickets returns empty list — file: `backend/tests/test_balances.py`
- [ ] T098 [FE] [US3] Create `frontend/src/api/balances.ts`: `useBalances(from?, to?)` TanStack Query hook — file: `frontend/src/api/balances.ts`
- [ ] T099 [FE] [US3] Create `frontend/src/pages/BalancesPage.tsx`: date range filter (optional); list of `BalanceRow` components showing "Alice owes Bob €20.00" in i18n format; empty state when no balances; `MoneyDisplay` for amounts — file: `frontend/src/pages/BalancesPage.tsx`; i18n keys: `balances.title`, `balances.owes`, `balances.empty`, `balances.filterByDate`
- [ ] T100 [FE] [US3] Create `frontend/src/components/balances/BalanceRow.tsx`: shows debtor name, "owes" (i18n), creditor name, amount — file: `frontend/src/components/balances/BalanceRow.tsx`
- [ ] T101 [FE] [US3] Write balance page test with MSW: renders balance rows; applies date filter; shows empty state; MoneyDisplay shows €20.00 format — file: `frontend/tests/pages/BalancesPage.test.tsx`
- [ ] T102 [AT] [US3] Verify net balance math independently: seed two tickets via API, check balance endpoint returns exactly the expected net direction and amount — file: `backend/tests/test_balances.py`

**Checkpoint**: Balance screen shows correct pairwise net amounts with optional date filter.

---

## Phase 11: User Story 4 — Reporting (Priority: P4)

**Goal**: Three report views (summary, itemized, categories) with date range filters.
**Independent Test**: Tickets in May and June; May-only filter returns correct per-member totals; category report shows correct breakdown.

- [ ] T103 [BE] [P] [US4] Create `backend/app/repositories/report_repository.py`: (a) `summary_query(from, to)` — sum of `item.discounted_price / allocation_count` per member; (b) `itemized_query(from, to, member_id)` — items grouped by ticket for one member; (c) `category_query(from, to)` — sum per category — all use DB-level date filtering — file: `backend/app/repositories/report_repository.py`
- [ ] T104 [BE] [P] [US4] Create `backend/app/services/report_service.py`: wraps repository queries, computes `percentage` for categories (Decimal arithmetic), formats all amounts as strings — file: `backend/app/services/report_service.py`
- [ ] T105 [BE] [P] [US4] Create `backend/app/schemas/report.py`: `SummaryResponse`, `ItemizedResponse`, `CategoryReportResponse` per `contracts/api.md` — file: `backend/app/schemas/report.py`
- [ ] T106 [BE] [US4] Create `backend/app/routers/reports.py`: `GET /reports/summary`, `GET /reports/itemized`, `GET /reports/categories`; all require JWT; all require `from` and `to` params; `itemized` also requires `member_id` — file: `backend/app/routers/reports.py`
- [ ] T107 [BE] [US4] Write `backend/tests/test_reports.py`: summary correct for date-filtered period; itemized groups by ticket correctly; category report correct percentages (Decimal, not float); uncategorized items in category report — file: `backend/tests/test_reports.py`
- [ ] T108 [FE] [P] [US4] Create `frontend/src/api/reports.ts`: `useSummaryReport(from, to)`, `useItemizedReport(from, to, memberId)`, `useCategoryReport(from, to)` — file: `frontend/src/api/reports.ts`
- [ ] T109 [FE] [US4] Create `frontend/src/components/reports/SummaryTable.tsx`: table of member names + totals; uses `MoneyDisplay`; i18n keys: `reports.summary.*` — file: `frontend/src/components/reports/SummaryTable.tsx`
- [ ] T110 [FE] [US4] Create `frontend/src/components/reports/CategoryPieChart.tsx`: pie chart (use a lightweight chart lib, e.g. recharts) showing category breakdown; table below with category name, total, percentage; uses category colour from API; i18n keys: `reports.categories.*` — file: `frontend/src/components/reports/CategoryPieChart.tsx`
- [ ] T111 [FE] [US4] Create `frontend/src/pages/ReportsPage.tsx`: tabbed layout (Summary | Itemized | Categories); `DateRangePicker` at top shared across tabs; member selector in Itemized tab — file: `frontend/src/pages/ReportsPage.tsx`; i18n keys: `reports.tabs.*`
- [ ] T112 [CR] Review US4 reports: verify DB-level filtering (no in-memory), Decimal percentage arithmetic, uncategorized items handled, API params validated (missing from/to returns 422)

**Checkpoint**: All three report views return correct date-filtered data.

---

## Phase 12: Dashboard

**Purpose**: Dashboard page summarizing app state. No new backend endpoints needed.

- [ ] T113 [FE] Create `frontend/src/pages/DashboardPage.tsx`: summary cards (total tickets, outstanding balance snapshot, recent tickets list); uses `useTickets({page_size: 5})` and `useBalances()`; links to `/tickets` and `/balances`; i18n keys: `dashboard.*` — file: `frontend/src/pages/DashboardPage.tsx`
- [ ] T114 [FE] Add all missing i18n keys from T043–T113 to all three locale files (`en`, `ru`, `pt`) and verify no missing keys in dev console — files: `frontend/src/locales/en/translation.json`, `frontend/src/locales/ru/translation.json`, `frontend/src/locales/pt/translation.json`

---

## Phase 13: Quality Gates & Security Sign-Off

**Purpose**: Cross-cutting verification, coverage gate, security sign-off, and code review before Docker validation.

- [ ] T115 [BE] Run `pytest --cov=app --cov-fail-under=80` and fix any gaps; ensure all OCR calls are mocked (no live OpenAI calls in test suite); report coverage summary to PA — file: `backend/tests/` (fix as needed)
- [ ] T116 [AT] [P] Execute acceptance scenarios for US1–US6 from `spec.md` against running Docker Compose stack; document pass/fail for each scenario; flag any regressions
- [ ] T117 [AT] [P] Verify all three locales (EN, RU, PT) render with zero missing translation keys; run `i18next-scanner` or equivalent — flag any missing key as a blocker
- [ ] T118 [SEC] Final security sign-off: verify no secrets in codebase (`git grep`), CORS wildcard absent, JWT RS256 in production code path, bcrypt hashes only in DB, upload validation present, confirm all security acceptance criteria from T008/T009 are met — file: `specs/001-portuguese-drunk-sailors/security-review.md` (update)
- [ ] T119 [CR] Final code review of all backend modules: layer separation (router/service/repository), no floats for money, all list endpoints paginated, DB-level filtering confirmed, migration files safe — create Ticket Manager tickets for any blocker findings
- [ ] T120 [CR] Final code review of all frontend modules: no hardcoded JSX strings, TypeScript strict no-error, all routes protected, MoneyDisplay used for all monetary values, no localStorage token exposure in logs

---

## Phase 14: Docker Integration & Delivery

**Purpose**: End-to-end `docker compose up --build` validation and final delivery report.

- [ ] T121 [DO] Validate `docker compose up --build` from clean state (no local volumes): all three services start, Alembic migrations run, default categories seeded, app users seeded, frontend reachable at port 3000, backend reachable at port 8000 — file: `specs/001-portuguese-drunk-sailors/quickstart.md` (mark validation checklist complete)
- [ ] T122 [DO] Add health check endpoints to backend (`GET /health` returns 200) and configure `docker-compose.yml` `healthcheck` for backend service; frontend `nginx` default health is sufficient — files: `backend/app/routers/health.py`, `docker-compose.yml`
- [ ] T123 [AT] Run full `quickstart.md` validation checklist against Docker Compose stack: login, receipt upload, allocation, balance, report, all locales, coverage gate — sign off each item
- [ ] T124 [PA] Run `python agent_metrics.py gaps` to identify any agents with missing task metrics; chase all outstanding reports
- [ ] T125 [PA] Run `python agent_metrics.py summary` and confirm all completed tasks have matching SQLite entries and brainstorm `task-metrics` messages
- [ ] T126 [PA] Generate final HTML report: `python agent_metrics.py report-html`; share path and factual summary with human — file: `project-administrator/reports/portuguese-expenses-final.html`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (PA Bootstrap): No dependencies — human must place `project-administrator/credentials.json` first
- **Phase 2** (Architecture & Security Review): Depends on Phase 1
- **Phase 3** (DevOps Foundation): Depends on Phase 1
- **Phase 4** (Backend Foundation): Depends on Phase 3 (Dockerfiles must exist)
- **Phase 5** (Frontend Foundation): Depends on Phase 3; **can run in parallel with Phase 4**
- **Phase 6** (US6 Authentication): Depends on Phase 4 + Phase 5
- **Phase 7** (US5 Reference Data): Depends on Phase 6
- **Phase 8** (US1 OCR & Upload): Depends on Phase 7 (needs member list for payer dropdown)
- **Phase 9** (US2 Allocation): Depends on Phase 8
- **Phase 10** (US3 Balances): Depends on Phase 9 (needs confirmed tickets)
- **Phase 11** (US4 Reports): Depends on Phase 9; **can run in parallel with Phase 10**
- **Phase 12** (Dashboard): Depends on Phase 10 + Phase 11
- **Phase 13** (Quality Gates): Depends on Phase 12
- **Phase 14** (Docker & Delivery): Depends on Phase 13

### Agent Parallelism Opportunities

| Phase | Can run in parallel |
|-------|-------------------|
| 3 (DevOps) vs 2 (SA/SEC review) | Yes — different owners |
| 4 (Backend) vs 5 (Frontend) | Yes — different directories |
| Any [P]-marked tasks within a phase | Yes — different files |
| T103/T104/T105 (report repo/service/schema) | Yes |
| T060/T061 (member + category tests) | Yes |
| T116/T117 (AT acceptance + locale check) | Yes |

---

## Parallel Execution Examples

### Phase 9: US2 Allocation

```
# Run simultaneously:
Task T079: ticket_repository.py (BE)
Task T086: AllocateStep.tsx (FE)
Task T091: DateRangePicker.tsx (FE)
```

### Phase 10 + Phase 11: Balance + Reports

```
# Run simultaneously after Phase 9:
Task T093–T102: Balance backend + frontend (BE + FE)
Task T103–T107: Reports backend (BE)
```

---

## Implementation Strategy

### MVP First (US6 → US5 → US1 → US2 only)

1. Complete Phases 1–9 (through US2 Cost Allocation)
2. **STOP and VALIDATE**: Upload receipt, allocate items, confirm ticket, check DB records
3. Deploy/demo if ready

### Incremental Delivery

1. Phases 1–6 → Authentication working → Demo login
2. Add Phase 7 (US5) → Members and categories manageable → Demo CRUD
3. Add Phase 8 (US1) → Receipt upload OCR draft → Demo OCR flow
4. Add Phase 9 (US2) → Full ticket wizard → Demo end-to-end save
5. Add Phase 10 (US3) → Balances → Demo "who owes whom"
6. Add Phase 11 (US4) → Reports → Full feature complete

### Parallel Team Strategy

With full agent team:
1. PA bootstraps (Phase 1)
2. SA + SEC review concurrently with DevOps setup (Phases 2+3)
3. BE Foundation + FE Foundation in parallel (Phases 4+5)
4. BE + FE work in parallel on each user story phase
5. AT + CR run verification on each completed story before next begins

---

## Notes

- `[P]` tasks have no dependencies on incomplete tasks in the same phase — safe to dispatch to agents in parallel
- `[Story]` label maps each task to spec.md user story for acceptance criteria verification
- Agent label (`[PA]`, `[BE]`, etc.) tells `run-agents.sh` which skill to invoke
- Every agent must complete the 3-step reporting handshake (SQLite + brainstorm + ticket transition) before a task is considered done
- Project Administrator monitors all agent activity and generates the final HTML delivery report
- **JWT must be RS256 everywhere** — agent files mentioning HS256 are superseded by the constitution (see `research.md`)
- Constitution §I forbids floats for money — every task touching monetary values must use `Decimal` (backend) or string representation (frontend JSON)

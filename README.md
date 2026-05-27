# Portuguese Drunk Sailors / Portuguese Expenses

**Portuguese Drunk Sailors** is the product specification and agent-orchestration workspace for a family expense tracking and cost allocation web application.

The product goal is to help a household of 8 family members answer a simple but painful question after shared shopping trips:

> Who consumed what, and who owes whom money?

The repository currently contains the business requirements, constitution/governance assets, Spec Kit workflow files, and specialist agent instructions used to plan and coordinate implementation. After the changes following commit `d3622e8`, the previously tracked runnable application source, Docker Compose setup, and generated feature specs are no longer part of the tracked `HEAD` tree.

---

## Current repository status

As of the current workspace state:

- The tracked repository is primarily a **planning, governance, and agent-skills repository**.
- Product requirements are in `documentation/speckit-specify-prompt.md`.
- Engineering governance is in `.specify/memory/constitution.md`.
- Spec Kit commands/templates/workflows are in `.specify/` and `.claude/skills/`.
- Specialist agent prompts are in `agents/`.
- `install-brainstorm.sh` installs and registers Brainstorm MCP support for coordinated agent work.

Local untracked folders may exist, such as `backend/`, `frontend/`, `private/`, `.env`, or `project-administrator/`. Treat those as local/generated/runtime artifacts unless they are intentionally re-added to Git.

> Security note: never commit `.env`, private keys, `private/*.pem`, `project-administrator/credentials.json`, generated SQLite databases, `node_modules/`, build outputs, or uploaded receipts.

---

## What the product is about

Portuguese Drunk Sailors is intended to be a small-household expense application for shared purchases across groceries, wine shops, supermarkets, restaurants, parking, gifts, and similar categories.

A typical shopping trip works like this:

1. One person pays the full receipt.
2. The receipt is uploaded as a photo or PDF.
3. OCR extracts a draft list of store/date/items/prices/discounts.
4. The user reviews and edits the OCR result before anything is persisted.
5. Each receipt item is allocated to one or more family members.
6. Ticket-level discounts are distributed proportionally across items.
7. Each item cost is split equally among allocated members.
8. The app calculates pairwise net balances, for example: `Alice owes Bob €23.50`.
9. Reports show spending by member, item, date range, and category.

The core discount formula from the business requirements is:

```text
item_discounted_price = item_price - (item_price / ticket_subtotal) * ticket_discount_total
```

---

## Product scope

The business source of truth is `documentation/speckit-specify-prompt.md`.

### Required capabilities

- Receipt capture through image/PDF upload.
- OCR draft extraction using OpenAI `gpt-4o` vision.
- Editable receipt review before persistence.
- Ticket payer selection.
- Per-item allocation to one or more active family members.
- “Select all members” shortcut for shared items.
- Live per-member cost summary before confirmation.
- Proportional discount handling.
- Atomic ticket, item, and allocation save on confirmation.
- Pairwise net balance tracking with optional date filters.
- Reports for:
  - total cost per family member;
  - itemized consumption by member;
  - category spending breakdown.
- Family member management with soft deactivation.
- Category management with deletion blocked while referenced.
- Authentication via two pre-created users; no registration.
- Internationalized UI in English, Russian, and Portuguese.

### Main domain entities

- **Ticket**: shopping trip/receipt with date, store, payer, total, discount, and optional raw image URL.
- **Item**: receipt line item with original price, computed discounted price, category, and display position.
- **Allocation**: item-to-family-member join; cost per member is the discounted item price divided by allocation count.
- **FamilyMember**: person who can pay for or consume items; deactivation is soft-delete only.
- **Category**: editable spending category with a display color.

---

## Repository parts

```text
.
├── .claude/skills/                 # Local Spec Kit skill instructions
├── .specify/                       # Spec Kit templates, scripts, workflows, and constitution
├── agents/                         # Specialist agent prompts
├── documentation/                  # Product/constitution source prompts
├── CLAUDE.md                       # Workspace instruction pointer
├── install-brainstorm.sh           # Brainstorm MCP installer
└── README.md                       # This file
```

### `documentation/`

Contains high-level prompt inputs:

- `documentation/speckit-specify-prompt.md` — business/product requirements.
- `documentation/speckit-constitution-prompt.md` — governance principles used to create the constitution.

### `.specify/`

Contains Spec Kit workflow assets:

- constitution memory;
- feature/spec/plan/task templates;
- workflow registry;
- bash and PowerShell helper scripts;
- Git integration extension files.

### `.claude/skills/`

Contains local skill definitions for Spec Kit workflows such as:

- specification generation;
- clarification;
- planning;
- task generation;
- implementation execution;
- checklist/analyze flows;
- Git helper workflows.

### `agents/`

Contains specialist prompts for coordinated AI-agent work:

- `product-manager.md`
- `software-architect.md`
- `security-architect.md`
- `backend-developer-python.md`
- `frontend-developer-react.md`
- `devops.md`
- `autotester.md`
- `code-reviewer.md`
- `project-administrator.md`

These agents are aligned to `documentation/speckit-specify-prompt.md` and should treat it as the business source of truth.

### `install-brainstorm.sh`

Installs Brainstorm MCP from `https://github.com/TheodorStorm/brainstorm-mcp.git`, builds it with npm, registers it with Claude Code, and optionally adds a shell wrapper.

---

## Intended application architecture

The constitution and product requirements define the intended implementation stack. The runnable source is not currently tracked in `HEAD`, but future/restored implementation should follow these constraints.

### Backend

- Python 3.12
- FastAPI
- SQLAlchemy 2.x async
- asyncpg
- Alembic
- PostgreSQL 16
- PyJWT using RS256
- bcrypt password hashing
- OpenAI Python SDK v1.x
- `gpt-4o` vision OCR
- `pdf2image` for PDF first-page conversion
- Python `Decimal` for all monetary arithmetic
- `NUMERIC(10,2)` for stored money values
- pytest, pytest-asyncio, httpx, pytest-cov with at least 80% backend coverage

### Frontend

- React 18
- TypeScript strict mode
- Tailwind CSS
- HeroUI
- TanStack Query v5
- React Hook Form
- Zod
- i18next with EN/RU/PT locales
- Vitest
- React Testing Library
- MSW

### Infrastructure

- Docker Compose with at least:
  - PostgreSQL database service;
  - FastAPI backend service;
  - React/nginx frontend service.
- Alembic migrations should run automatically on backend startup.
- CORS must be locked to the configured frontend origin.
- Environment variables must be the single source of runtime configuration.

---

## Governance rules

The project constitution lives at `.specify/memory/constitution.md`.

Key non-negotiable rules:

- No floats for money.
- Backend database access must be async.
- Business logic belongs in services, not routers, schemas, or models.
- All routes except login require JWT authentication.
- JWT must be RS256.
- Uploads must be validated before processing.
- OCR calls must be mocked in tests.
- All user-facing frontend text must be internationalized.
- Docker Compose should be the one-command runtime path once app source is present.

---

## How to use this repository now

### 1. Review the product requirements

```zsh
cat documentation/speckit-specify-prompt.md
```

### 2. Review the constitution

```zsh
cat .specify/memory/constitution.md
```

### 3. Review specialist agents

```zsh
ls agents
```

### 4. Install Brainstorm MCP support

```zsh
bash install-brainstorm.sh
```

Optional custom install location:

```zsh
bash install-brainstorm.sh --dir "$HOME/.local/share/brainstorm-mcp"
```

### 5. Use Spec Kit workflows

The repository includes local Spec Kit skills under `.claude/skills/` and templates under `.specify/`. Typical workflow intent:

1. Specify the feature from `documentation/speckit-specify-prompt.md`.
2. Clarify underspecified requirements.
3. Produce an implementation plan.
4. Generate tasks.
5. Implement through specialist agents.
6. Analyze consistency.
7. Commit validated changes.

Exact invocation depends on the host assistant/tooling environment.

---

## Testing and validation

Because the runnable app source and Docker Compose files are no longer tracked in current `HEAD`, application-level commands such as backend pytest, frontend Vitest, and `docker compose up --build` are not currently available from the tracked repository alone.

### Current repository validation

You can still validate shell syntax and inspect Git state:

```zsh
bash -n install-brainstorm.sh
git status --short
git diff --name-status d3622e8..HEAD
```

### Intended application validation once source is restored

When backend/frontend/Docker source is restored or regenerated, the expected validation commands are:

```zsh
# Backend coverage gate
cd backend
pytest --cov=app --cov-fail-under=80
```

```zsh
# Frontend tests
cd frontend
npm test
```

```zsh
# Frontend build/type check
cd frontend
npm run build
```

```zsh
# Full stack startup
cd /path/to/portuguese-expenses
docker compose up --build
```

Expected runtime checks after full app source exists:

- login works for the two pre-created users;
- invalid/oversized uploads are rejected;
- OCR drafts are editable before save;
- item allocation and proportional discounts are correct;
- balances show pairwise net debts;
- reports filter correctly by date range;
- EN/RU/PT locales render without missing translation keys.

---

## Deployment notes

There is no deployable tracked application in current `HEAD` because the backend, frontend, Dockerfiles, and Compose file from the earlier implementation snapshot were removed after `d3622e8`.

Once the app source is restored or regenerated, the intended deployment model is:

1. Prepare a production `.env` from a safe `.env.example`.
2. Generate production RS256 JWT keys.
3. Set strong PostgreSQL credentials.
4. Set `OPENAI_API_KEY` for OCR.
5. Set `FRONTEND_URL` and `VITE_API_BASE_URL` to production origins.
6. Start via Docker Compose:

   ```zsh
   docker compose up --build -d
   ```

7. Put TLS termination in front of frontend/backend services.
8. Back up PostgreSQL and uploaded receipt storage.
9. Keep secrets outside Git.

---

## Future work

### Repository hygiene

- Decide whether the runnable app source removed after `d3622e8` should be restored, regenerated, or intentionally kept out of this repository.
- Reintroduce `.gitignore` rules for `.env`, `private/`, credentials, SQLite databases, `node_modules/`, build outputs, uploads, and Python caches.
- Recreate `.env.example` without real secrets.
- Avoid committing generated artifacts such as `frontend/dist/`, `frontend/node_modules/`, `.pytest_cache/`, `.coverage`, and `__pycache__/`.
- Add CI for documentation checks, shell syntax, and eventually backend/frontend tests once source returns.

### Product features

- Settlement tracking: mark debts as paid and keep settlement history.
- Manual ticket entry for receipts without OCR.
- OCR confidence indicators and field-level review warnings.
- Export balances/reports to CSV or PDF.
- Mobile-first receipt capture improvements.
- Durable object storage for receipt files.
- Observability: structured logs, request IDs, metrics, and OCR latency tracking.
- Backup/restore automation for PostgreSQL.
- Optional role distinctions if admin/editor permissions are needed later.

---

## Quick command reference

```zsh
# Check current Git changes since the previous app snapshot
git diff --name-status d3622e8..HEAD

# Validate installer shell syntax
bash -n install-brainstorm.sh

# Install Brainstorm MCP support
bash install-brainstorm.sh

# Review product requirements
cat documentation/speckit-specify-prompt.md

# Review constitution
cat .specify/memory/constitution.md

# List specialist agents
ls agents
```


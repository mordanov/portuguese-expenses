# Portuguese Drunk Sailors

**Portuguese Drunk Sailors** is a full-stack family expense tracking and cost allocation web application.

It is designed for a household of 8 family members who share purchases across supermarkets, groceries, wine shops, restaurants, parking, gifts, and other categories. After each shopping trip, one person pays the whole bill; the app helps the family answer:

> Who consumed what, how much does each person owe, and who should pay whom?

The app supports receipt upload with OCR, manual ticket entry, editable receipt review, item-by-item allocation to family members, proportional ticket discount distribution, pairwise balance calculation, optional balance offsetting rules, and spending reports.

---

## Product overview

### Main workflow

1. A user logs in with one of two pre-created application accounts.
2. The user uploads a receipt photo/PDF or starts a manual ticket.
3. For uploads, the backend extracts a draft using OpenAI `gpt-4o` vision OCR.
4. The user reviews and edits store/date/items/categories before anything is saved.
5. The user selects the family member who paid the bill.
6. The user allocates each item to one or more active family members.
7. The app distributes ticket-level discounts proportionally across items:

   ```text
   item_discounted_price = item_price − (item_price / ticket_subtotal) × ticket_discount_total
   ```

8. Each item cost is split equally across the members allocated to that item.
9. Confirming the ticket saves the ticket, items, and allocations atomically.
10. Balances and reports are calculated from confirmed tickets.
11. Optional offsetting rules can adjust the displayed balance ledger, for example when one person absorbs another person's receivables or transfers their debts to someone else.

### Core features

- **Authentication**: two environment-provisioned users, no registration flow.
- **Receipt capture**: JPEG, PNG, WEBP, and PDF uploads up to 10 MB.
- **Manual entry**: start a ticket without OCR when a receipt is unavailable or unreadable.
- **OCR draft review**: extracted receipt data is editable before persistence.
- **Per-item allocation**: allocate each item to one or more active family members.
- **Discount handling**: proportional discount allocation using euro-cent precision.
- **Balance tracking**: pairwise net balances such as “Alice owes Bob €23.50”, with date/member filters and persisted offsetting rules.
- **Reports**:
  - total cost per member for a date range;
  - itemized consumed items for a selected member;
  - category breakdown as chart/table.
- **Family member management**: add, rename, deactivate; historical records are preserved.
- **Category management**: add, rename, delete; deletion is blocked when items reference a category.
- **Internationalized UI**: English, Russian, and Portuguese locales.

---

## Latest changes since `d3622e8`

The current codebase has moved beyond the original receipt/allocation/balance/reporting flow with several usability and balance-management additions:

- **Manual ticket entry**: `/tickets/new` can start from an empty draft when no receipt is available, so users can enter store/date/items manually without calling OCR.
- **Persisted offset rules**: a new `offset_rules` database table and Alembic migration `004_offset_rules.py` store balance adjustment rules.
- **Offset rules API**: authenticated `GET`, `POST`, and `DELETE` operations are exposed at `/offset-rules`.
- **Balance-page adjustments**: `/balances` can apply saved `absorb` and `transfer` rules to the displayed ledger after loading raw pairwise balances.
- **Balance filters**: the balance page now supports member-level debtor/creditor filtering in addition to date filtering.
- **Ticket detail editing**: ticket detail/API support includes adding items and replacing item allocations after ticket creation, with discounted prices recalculated as needed.
- **Localization updates**: EN/RU/PT translation files include the new balance offsetting, filtering, manual-entry, and ticket-editing labels.

---

## Repository structure

```text
.
├── backend/                         # FastAPI REST API
│   ├── app/
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   ├── repositories/            # Data access layer
│   │   ├── routers/                 # FastAPI HTTP endpoints
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── services/                # Business logic
│   │   ├── config.py                # Environment-based settings
│   │   ├── database.py              # Async SQLAlchemy session setup
│   │   └── main.py                  # FastAPI app and router registration
│   ├── alembic/                     # Database migrations and seed data
│   ├── tests/                       # Backend pytest suite
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/                        # React SPA
│   ├── src/
│   │   ├── api/                     # Axios + TanStack Query API hooks
│   │   ├── components/              # UI components
│   │   ├── locales/                 # en / ru / pt translations
│   │   ├── pages/                   # Application pages/routes
│   │   ├── App.tsx                  # Route definitions
│   │   └── i18n.ts                  # i18next setup
│   ├── tests/                       # Vitest + React Testing Library + MSW tests
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── specs/001-portuguese-drunk-sailors/
│   ├── spec.md                      # Product specification
│   ├── plan.md                      # Architecture and implementation plan
│   ├── quickstart.md                # Setup/validation notes
│   ├── data-model.md                # Domain model and DB rules
│   ├── contracts/api.md             # API contract
│   └── tasks.md                     # Implementation task plan
├── agents/                          # Specialist agent prompts used during implementation
├── project-administrator/           # Agent/task metrics tooling
├── docker-compose.yml               # db + backend + frontend orchestration
└── .env.example                     # Required environment variables
```

---

## Application parts

### Backend API

The backend is a FastAPI application with a layered architecture:

- **Routers** handle HTTP only.
- **Services** contain business logic, including authentication, OCR, discount calculation, allocation validation, balances, and reports.
- **Repositories** encapsulate database access.
- **Schemas** define Pydantic request/response contracts.
- **Models** define SQLAlchemy ORM tables.
- **Alembic migrations** create schema and seed default categories/users.
- **Offset rules** are stored in the database and exposed through a protected API for balance-page adjustments.

Main API areas:

- `POST /auth/login`
- `/members`
- `/categories`
- `/tickets` and `/tickets/upload`
- `/items/{id}` and `/items/{id}/allocations`
- `/balances`
- `/offset-rules`
- `/reports/summary`
- `/reports/itemized`
- `/reports/categories`
- `GET /health`

Backend API docs are available at `http://localhost:8000/docs` when the backend is running.

### Frontend SPA

The frontend is a Vite React application with protected routes:

- `/login` — login form
- `/` — dashboard
- `/tickets` — ticket list and filters
- `/tickets/new` — receipt upload or manual entry, then review/allocation/confirmation wizard
- `/tickets/:id` — ticket detail/edit page with item/allocation editing support
- `/members` — family member management
- `/categories` — category management
- `/reports` — summary, itemized, and category reports
- `/balances` — pairwise net balances with date/member filters and offsetting rules

The UI uses the Portuguese flag-inspired palette and supports EN/RU/PT localization.

### Database

PostgreSQL stores:

- application users;
- family members;
- categories;
- tickets;
- ticket items;
- item allocations;
- balance offset rules.

Money is stored as `NUMERIC(10,2)`. Backend monetary calculations use Python `Decimal` rather than floats.

Offset rules are stored in an `offset_rules` table created by Alembic migration `004_offset_rules.py`. They currently support two rule types:

- `absorb`: retargets debts owed to one member so they are owed to another member.
- `transfer`: retargets debts owed by one member so another member takes them over.

The frontend applies these rules to the displayed balance ledger after fetching the raw pairwise balances from the backend.

### Docker deployment

`docker-compose.yml` runs three services:

- `db`: PostgreSQL 16
- `backend`: FastAPI on port `8000`
- `frontend`: nginx-served React build on port `3000`

The backend container runs Alembic migrations before starting the API server.

---

## Technologies used

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy 2.x async
- asyncpg
- Alembic
- PostgreSQL 16
- PyJWT with RS256 keys
- bcrypt / passlib
- OpenAI Python SDK v1.x
- `gpt-4o` vision for OCR
- `pdf2image` + Poppler for PDF first-page conversion
- Pillow
- python-magic for upload MIME validation
- pytest, pytest-asyncio, httpx, pytest-cov

### Frontend

- React 18
- TypeScript strict mode
- Vite
- Tailwind CSS
- HeroUI
- React Router
- Axios
- TanStack Query v5
- React Hook Form
- Zod
- i18next / react-i18next
- Recharts
- Vitest
- React Testing Library
- MSW

### Infrastructure and tooling

- Docker Compose
- nginx for serving the frontend production build
- Alembic migrations on backend startup
- Backend formatting/lint configuration via Black, isort, mypy, and flake8 settings

---

## Prerequisites

For the Docker-based flow:

- Docker Desktop, or Docker Engine with the Compose plugin
- An OpenAI API key with access to `gpt-4o`

For local development without Docker:

- Python 3.12
- Node.js 20+
- npm
- PostgreSQL 16, or another database URL compatible with the backend configuration
- Poppler installed locally if testing PDF OCR conversion outside Docker

---

## Configuration

Create a local environment file from the example:

```zsh
cp .env.example .env
```

Required groups of variables:

- PostgreSQL connection settings
- RS256 JWT private/public keys
- two pre-created app users
- OpenAI API key
- upload settings
- CORS/frontend URLs

Generate a JWT key pair:

```zsh
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Collapse keys into `\n`-escaped one-line values before pasting them into `.env`:

```zsh
awk 'NR==1{printf "%s", $0; next} {printf "\\n%s", $0} END{print ""}' private.pem
awk 'NR==1{printf "%s", $0; next} {printf "\\n%s", $0} END{print ""}' public.pem
```

Typical local values are shown in `.env.example`.

> Do not commit `.env`, generated private keys, credentials files, uploads, or database volumes.

---

## How to run

### Docker Compose

From the repository root:

```zsh
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`
- Backend health check: `http://localhost:8000/health`

Log in using the credentials configured in `.env`:

- `APP_USER_1_USERNAME` / `APP_USER_1_PASSWORD`, or
- `APP_USER_2_USERNAME` / `APP_USER_2_PASSWORD`

Stop services:

```zsh
docker compose down
```

Stop services and remove the database volume:

```zsh
docker compose down -v
```

### Local backend development

```zsh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

If running the backend locally, ensure `DATABASE_URL` points to a reachable PostgreSQL instance and required environment variables are available.

### Local frontend development

In another terminal:

```zsh
cd frontend
npm install
npm run dev
```

The Vite dev server is configured to run on `http://localhost:3000`. The Docker setup also exposes the production frontend on `http://localhost:3000`.

---

## How to use the app

1. Open the frontend.
2. Log in with one of the configured users.
3. Create or review family members on `/members`.
4. Create or review spending categories on `/categories`.
5. Go to `/tickets/new`.
6. Upload a receipt image/PDF or choose manual entry.
7. Review and correct the OCR draft, or fill in the manual ticket fields.
8. Select the payer.
9. Allocate every item to one or more active family members.
10. Check the live summary and confirm the ticket.
11. Open ticket details later to edit ticket metadata, add items, or replace item allocations.
12. Use `/balances` to see who owes whom, filter by date/member, and optionally create offsetting rules.
13. Use `/reports` to inspect spending by member, item, and category.

---

## Testing

### Backend tests

Run the backend suite with coverage:

```zsh
cd backend
pytest --cov=app --cov-fail-under=80
```

Or through Docker Compose:

```zsh
docker compose run --rm backend pytest --cov=app --cov-fail-under=80
```

The backend tests cover authentication, members, categories, OCR service behavior, tickets, items, balances, and reports. OCR calls are mocked in tests; the suite should not call the real OpenAI API.

### Frontend tests

Run the frontend test suite:

```zsh
cd frontend
npm install
npm test
```

Or through Docker Compose:

```zsh
docker compose run --rm frontend npx vitest run
```

Frontend tests use Vitest, React Testing Library, and MSW API mocks.

### Frontend build/type check

```zsh
cd frontend
npm run build
```

### Docker configuration check

```zsh
docker compose config
```

### Suggested manual smoke test

After `docker compose up --build`:

- `/login` loads.
- EN/RU/PT language switcher works.
- Valid login redirects to the dashboard.
- Protected routes redirect to `/login` without a token.
- Upload rejects invalid files and oversized files.
- A valid receipt upload returns an editable draft.
- Manual ticket entry opens the same review/allocation flow without calling OCR.
- Ticket allocation updates the per-member summary.
- Confirmed tickets appear in the ticket list.
- Ticket details allow item/allocation updates.
- Balances show net pairwise debts.
- Balance filters and offsetting rules update the displayed ledger.
- Reports filter by date range.

---

## Deployment

The simplest deployment target is a Linux host or container platform that can run Docker Compose.

### Basic deployment flow

1. Provision a host with Docker and Docker Compose.
2. Copy or clone this repository to the host.
3. Create a production `.env` from `.env.example`.
4. Use strong PostgreSQL credentials.
5. Generate production RS256 JWT keys.
6. Set `FRONTEND_URL` to the public frontend origin.
7. Set `VITE_API_BASE_URL` to the public backend API URL before building the frontend image.
8. Set `OPENAI_API_KEY` for receipt OCR.
9. Start the stack:

   ```zsh
   docker compose up --build -d
   ```

10. Verify:

   ```zsh
   docker compose ps
   docker compose logs backend
   docker compose logs frontend
   ```

### Production notes

- Put TLS termination in front of the frontend/backend, for example with a reverse proxy or managed load balancer.
- Keep `.env` and private keys outside version control.
- Back up the PostgreSQL volume regularly.
- Consider mapping uploads to durable object storage or a persistent host volume.
- Rotate JWT keys and user passwords according to your operational policy.
- Keep `FRONTEND_URL` restrictive; do not use wildcard CORS origins.

---

## Design and implementation notes

- Business requirements live in `documentation/speckit-specify-prompt.md` and `specs/001-portuguese-drunk-sailors/spec.md`.
- The architecture plan is in `specs/001-portuguese-drunk-sailors/plan.md`.
- API behavior is documented in `specs/001-portuguese-drunk-sailors/contracts/api.md`.
- Database/domain rules are documented in `specs/001-portuguese-drunk-sailors/data-model.md`.
- The implementation uses RS256 JWTs. Older draft references to HS256 are superseded by the project plan/constitution notes.
- Changes after commit `d3622e8` added persisted offset rules (`GET/POST/DELETE /offset-rules`), Alembic migration `004_offset_rules.py`, balance-page member filters, manual ticket entry, and ticket-detail item editing support.
- Offset rules are persisted by the backend but applied by the frontend to the fetched pairwise balance rows before display.
- The product is intentionally scoped for a small trusted household, not multi-tenant SaaS.

---

## Future ideas

Potential improvements for future iterations:

- **Settlement tracking**: mark debts as paid and keep a settlement history.
- **Server-side offset application**: move offset-rule application from the balance page into the backend balance service if adjusted balances must be shared consistently across clients and reports.
- **Recurring households/trips**: support multiple groups, trips, or households.
- **Receipt image storage upgrade**: move raw uploads from filesystem volume to S3-compatible object storage.
- **OCR confidence UI**: show low-confidence extracted fields and highlight likely OCR mistakes.
- **Better rounding reconciliation**: expose cent-level rounding adjustments for complex shared receipts.
- **Export tools**: CSV/PDF export for balances, reports, and itemized consumption.
- **Notification workflow**: send settlement summaries by email, Telegram, or WhatsApp.
- **Mobile UX polish**: optimize the ticket wizard for camera upload on phones.
- **Observability**: add structured logs, request IDs, metrics, and OCR latency tracking.
- **CI pipeline**: run backend tests, frontend tests, frontend build, and Docker config validation on every pull request.
- **Backup/restore scripts**: automate PostgreSQL backups and restore verification.
- **Role-based permissions**: add admin/editor distinctions if the household workflow needs them later.

---

## Quick command reference

```zsh
# Start everything
docker compose up --build

# Stop everything
docker compose down

# Stop and remove DB/uploads volumes managed by compose
docker compose down -v

# Backend tests
cd backend
pytest --cov=app --cov-fail-under=80

# Frontend tests
cd frontend
npm test

# Frontend build
cd frontend
npm run build

# Validate Compose file
docker compose config
```



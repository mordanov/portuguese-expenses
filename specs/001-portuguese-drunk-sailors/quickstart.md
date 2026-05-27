# Quickstart: Portuguese Drunk Sailors

**Branch**: `001-portuguese-drunk-sailors` | **Date**: 2026-05-27

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- An OpenAI API key with access to `gpt-4o`

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd portuguese-expenses

# 2. Copy environment file and fill in secrets
cp .env.example .env
# Edit .env — required values are described in the next section
```

## Environment Variables (`.env`)

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
POSTGRES_DB=portuguese_expenses
DATABASE_URL=postgresql+asyncpg://postgres:changeme@db:5432/portuguese_expenses

# JWT (RS256) — generate with: openssl genrsa -out private.pem 2048
# OpenSSL 3.x outputs PKCS#8 format (BEGIN PRIVATE KEY) — accepted by python-jose RS256
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_ALGORITHM=RS256
JWT_EXPIRE_MINUTES=480

# Pre-created app users
APP_USER_1_USERNAME=admin
APP_USER_1_PASSWORD=changeme
APP_USER_2_USERNAME=editor
APP_USER_2_PASSWORD=changeme

# OpenAI
OPENAI_API_KEY=sk-...

# File uploads
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE_MB=10

# Frontend
FRONTEND_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:8000
```

## Start the Application

```bash
docker compose up --build
```

This single command:
1. Builds all three services (db, backend, frontend)
2. Starts PostgreSQL
3. Runs `alembic upgrade head` (creates schema + seeds categories + seeds users)
4. Starts the FastAPI backend on port 8000
5. Starts the React frontend on port 3000

## Verify It's Running

```
Frontend: http://localhost:3000
Backend API docs: http://localhost:8000/docs
```

Login with the credentials from `APP_USER_1_USERNAME` / `APP_USER_1_PASSWORD`.

## Generate RSA Key Pair

```bash
# Private key (OpenSSL 3.x outputs PKCS#8 — compatible with python-jose RS256)
openssl genrsa -out private.pem 2048

# Public key
openssl rsa -in private.pem -pubout -out public.pem

# Collapse newlines to \n literals before pasting into .env
awk 'NR==1{printf "%s", $0; next} {printf "\\n%s", $0} END{print ""}' private.pem
awk 'NR==1{printf "%s", $0; next} {printf "\\n%s", $0} END{print ""}' public.pem
```

> **Verified**: `openssl genrsa` on OpenSSL 3.x produces `-----BEGIN PRIVATE KEY-----` (PKCS#8).
> `python-jose` accepts this format for RS256 sign and verify. Do not attempt to convert to
> legacy PKCS#1 format — the commands above are correct as written.

## Run Backend Tests

```bash
docker compose run --rm backend pytest --cov=app --cov-fail-under=80
```

## Run Frontend Tests

```bash
docker compose run --rm frontend npx vitest run
```

## Stop the Application

```bash
docker compose down
# To also wipe the database volume:
docker compose down -v
```

## Development Workflow (local, without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pre-commit install
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # starts on port 3000
```

## Validation Checklist

After `docker compose up --build` completes:

- [ ] `http://localhost:3000/login` loads the login form in English
- [ ] Language switcher cycles through EN / RU / PT with no missing-key warnings
- [ ] Login with valid credentials redirects to the dashboard
- [ ] Navigating to any route without a token redirects to `/login`
- [ ] Upload a receipt photo → extracted items appear in editable table
- [ ] Allocate items → live summary updates correctly
- [ ] Confirm ticket → appears in `/tickets` list
- [ ] Balance screen shows correct net amounts
- [ ] Reports return data filtered by selected date range
- [ ] `pytest --cov=app --cov-fail-under=80` exits 0

## Pre-Docker Validation Results (T121 — 2026-05-27)

Docker daemon was unavailable for live `docker compose up --build` run.
Static and local validation completed instead:

| Check | Result |
|-------|--------|
| `docker-compose config` syntax | ✅ VALID |
| Backend Python syntax (`py_compile`) | ✅ PASS |
| Backend tests (`pytest`) | ✅ 77/77 pass |
| Backend coverage (`--cov-fail-under=80`) | ✅ 80.91% |
| Frontend TypeScript build (`tsc -b && vite build`) | ✅ 0 errors |
| Frontend tests (`vitest run`) | ✅ 17/17 pass |
| Health endpoint `GET /health` | ✅ exists in `app/routers/health.py` |
| `docker-compose.yml` healthcheck (backend) | ✅ `curl -f http://localhost:8000/health` |
| `.dockerignore` (backend + frontend) | ✅ prevents secret baking |

**To complete T121**: start Colima (`colima start`) then run `docker compose up --build`.

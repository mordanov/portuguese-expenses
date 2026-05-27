# T019 Code Review: DevOps Phase 3 (T011–T018)

**Reviewer**: code-reviewer  
**Date**: 2026-05-27  
**Verdict**: ✅ APPROVED — 1 bug fix required, 1 documentation correction

---

## Files Reviewed

- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `.env.example`
- `.gitignore`
- `backend/pyproject.toml`
- `backend/.pre-commit-config.yaml`
- `backend/.dockerignore`
- `frontend/.dockerignore`
- `specs/001-portuguese-drunk-sailors/quickstart.md` (RSA section)

---

## ✅ Passing Checks

| Check | Result |
|-------|--------|
| No hardcoded secrets in Dockerfiles | ✅ All values from env vars |
| `.env` excluded from git | ✅ `.gitignore` has `.env`, `*.env`, `**/.env` |
| `credentials.json` excluded | ✅ `*/credentials.json` in `.gitignore` |
| `agent_metrics.db` excluded | ✅ Present in `.gitignore` |
| `docker-compose.yml` — no wildcard in env | ✅ All `${...}` references |
| Backend Dockerfile — multi-stage build | ✅ builder + runtime stages |
| Backend Dockerfile — `poppler-utils` in runtime stage | ✅ Required for pdf2image |
| Backend Dockerfile — `alembic upgrade head` before uvicorn | ✅ |
| Frontend Dockerfile — multi-stage Node 20 + nginx:alpine | ✅ |
| Frontend nginx.conf — SPA fallback (`try_files ... /index.html`) | ✅ |
| Frontend nginx — asset cache headers correct | ✅ Long-term for hashed assets, no-cache for index.html |
| `.env.example` — JWT_ALGORITHM=RS256 | ✅ |
| `.env.example` — PKCS#8 header correct (`BEGIN PRIVATE KEY`) | ✅ |
| `.env.example` — CORS documented as no-wildcard | ✅ |
| `.env.example` — all required vars present | ✅ Matches tasks.md T014 list |
| `pyproject.toml` — strict mypy | ✅ |
| `pyproject.toml` — `asyncio_mode = "auto"` | ✅ |
| `pyproject.toml` — `fail_under = 80` | ✅ |
| `pyproject.toml` — `main.py` omitted from coverage | ✅ (app factory only) |
| `.pre-commit-config.yaml` — pinned versions | ✅ |
| `.pre-commit-config.yaml` — specific type stubs (not `types-all`) | ✅ |
| `docker-compose.yml` — service health dependency chain | ✅ db → backend → frontend |
| `uploads` volume mounted | ✅ |
| `.dockerignore` files exclude `.env`, test dirs, caches | ✅ Both backend and frontend |
| `curl` in backend runtime image (for healthcheck) | ✅ Appropriate |

---

## ❌ Bug: flake8 config in `pyproject.toml` silently ignored

**File**: `backend/pyproject.toml` + `backend/.pre-commit-config.yaml`  
**Severity**: Medium — linting gap, not a security issue, but defeats the purpose of the linting gate

**Problem**: Standard `flake8` does not read `pyproject.toml`. It reads `.flake8`, `setup.cfg`, or `tox.ini`. The `[tool.flake8]` section (max-line-length=88, extend-ignore=E203,W503) will be silently ignored by the pre-commit flake8 hook unless the `flake8-pyproject` plugin is installed.

**Fix** — add `flake8-pyproject` to the pre-commit additional_dependencies:

```yaml
  - repo: https://github.com/PyCQA/flake8
    rev: 7.1.1
    hooks:
      - id: flake8
        additional_dependencies:
          - flake8-pyproject
```

**Alternative**: Move the flake8 config to `backend/.flake8`.

---

## ⚠️ Documentation: quickstart.md shows PKCS#1 header in .env example

**File**: `specs/001-portuguese-drunk-sailors/quickstart.md` (line ~32)  
**Severity**: Low — documentation only, `.env.example` is already correct

**Problem**: The `.env` snippet in quickstart.md shows:
```
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```
This is the PKCS#1 format. OpenSSL 3.x `genrsa` outputs PKCS#8 (`-----BEGIN PRIVATE KEY-----`). The actual `.env.example` is correct and notes this. The mismatch in quickstart.md could lead an operator to copy the wrong header format.

**Fix**: Update quickstart.md line ~32 to use `-----BEGIN PRIVATE KEY-----`.

---

## ℹ️ Notes (no action required)

- `pyproject.toml` is excluded from the Docker build context via `.dockerignore`. This is intentional (no linting in production containers). `pytest.ini_options` won't be read from inside the container, but tests are run from the host — acceptable.
- The `backend/app/main.py` is omitted from coverage measurement. This is correct for an app factory file, but ensure the `/health` endpoint (T122) is covered in integration tests, not unit tests.
- `docker-compose.yml` exposes port 5432 for the database. This is acceptable for local development but should be removed or bound to `127.0.0.1` in any staging/production override.

---

## Required Actions Before Phase 4 Begins

1. **[DevOps] Fix flake8-pyproject**: Add `flake8-pyproject` to `.pre-commit-config.yaml` additional_dependencies for the flake8 hook (or create `backend/.flake8`).
2. **[DevOps] Fix quickstart.md PKCS header**: Change `BEGIN RSA PRIVATE KEY` to `BEGIN PRIVATE KEY` in the .env example snippet.

Phase 4 (Backend Foundation) and Phase 5 (Frontend Foundation) may proceed in parallel while these minor fixes are applied — they do not block backend or frontend code.

# T032 Code Review: Backend Foundation (T020–T031)

**Reviewer**: code-reviewer  
**Date**: 2026-05-27  
**Verdict**: ✅ APPROVED — 2 bugs must be fixed, 1 architecture note

---

## Files Reviewed

- `backend/requirements.txt` + `requirements-dev.txt`
- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/main.py`
- `backend/app/dependencies.py`
- `backend/app/models/` (all 6 files)
- `backend/app/repositories/base.py`
- `backend/alembic/env.py`
- `backend/alembic/versions/001_initial_schema.py`
- `backend/tests/conftest.py`
- `backend/app/services/auth_service.py` (auth_service for JWT verification check)
- `backend/app/services/report_service.py` (spot-check for layer separation)

---

## ✅ Passing Checks

| Check | Result |
|-------|--------|
| All DB access in repositories/services is `async` (`await session.execute`, `await session.get`) | ✅ |
| No synchronous SQLAlchemy calls in routers or services | ✅ |
| JWT uses RS256 — `jwt.encode(…, private_key, algorithm=settings.jwt_algorithm)` | ✅ |
| `decode_access_token` uses `jwt_public_key` (not private) | ✅ |
| `get_current_user` raises 401 for missing/invalid token | ✅ |
| CORS `allow_origins=[settings.frontend_url]` — no wildcard | ✅ |
| All monetary columns are `Numeric(10, 2)` — no Float anywhere in models | ✅ |
| No business logic in models (pure ORM declarations) | ✅ |
| No business logic in schemas (pure Pydantic I/O shapes) — checked all schema files | ✅ |
| `app_users.password_hash` — field named `password_hash`, no `password` field | ✅ |
| Alembic `env.py` uses `create_async_engine` + `asyncio.run(run_migrations_online())` | ✅ |
| Alembic reads `DATABASE_URL` from env, falls back to `alembic.ini` | ✅ |
| Migration 001 — all tables present: `family_members`, `categories`, `app_users`, `tickets`, `items`, `allocations` | ✅ |
| Migration 001 — `Numeric(10, 2)` on all monetary columns (`total_price`, `discount_total`, `price`, `discounted_price`) | ✅ |
| Migration 001 — check constraints for non-negative prices | ✅ |
| Migration 001 — indexes on `tickets.purchased_at`, `tickets.paid_by_id`, `items.ticket_id`, `allocations.item_id` | ✅ |
| `conftest.py` — SQLite in-memory test DB, async engine, per-function teardown | ✅ |
| `conftest.py` — RSA key pair generated at test session start (not hardcoded) | ✅ |
| `conftest.py` — `mock_ocr_client` fixture present and returns structured mock | ✅ |
| `conftest.py` — no live OpenAI calls | ✅ |
| `BaseRepository` — all methods are `async` | ✅ |
| `BaseRepository.list()` — pagination with `offset/limit` (DB-level, not in-memory) | ✅ |
| No float arithmetic for money in `auth_service.py` | ✅ |
| `report_service.py` — Decimal arithmetic with `quantize(Decimal("0.01"))` | ✅ |
| JWT algorithm read from `settings.jwt_algorithm` (not hardcoded) | ✅ |

---

## ❌ Bug 1: `database.py` creates a new engine on every request (connection pool leak)

**File**: `backend/app/database.py`  
**Severity**: High — exhausts DB connections under any real load

**Problem**: `get_async_session()` calls `_make_session_factory()` which calls `_make_engine()` on every invocation. Each call to `create_async_engine` opens a new connection pool. With default pool size of 5, 20 concurrent requests = 20 separate pools = 100 potential connections. The pool is never reused or disposed.

**Current code**:
```python
def _make_engine():
    return create_async_engine(settings.database_url, echo=False, future=True)

def _make_session_factory():
    return async_sessionmaker(_make_engine(), ...)

async def get_async_session():
    factory = _make_session_factory()
    async with factory() as session:
        yield session
```

**Fix** — module-level singletons:
```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_engine = create_async_engine(get_settings().database_url, echo=False, future=True)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session
```

---

## ❌ Bug 2: `aiosqlite` missing from `requirements-dev.txt`

**File**: `backend/requirements-dev.txt`  
**Severity**: Medium — `pytest` suite fails in a clean virtualenv (CI will fail)

**Problem**: `conftest.py` uses `sqlite+aiosqlite:///:memory:` for the test DB. `aiosqlite` is installed in the local `.venv` but is not listed in `requirements-dev.txt`. Any CI environment or fresh clone will fail with `ModuleNotFoundError: No module named 'aiosqlite'`.

**Fix**: Add to `backend/requirements-dev.txt`:
```
aiosqlite==0.20.0
```

---

## ⚠️ Architecture Note: `report_service.py` contains inline DB access

**File**: `backend/app/services/report_service.py:76`  
**Severity**: Low — minor layer separation violation, not a blocker

`get_itemized()` reaches into `self.repo.session` to look up a `FamilyMember` name directly:
```python
m_result = await self.repo.session.execute(
    sa_select(FamilyMember.name).where(FamilyMember.id == member_id)
)
```

This bypasses the repository layer. The service should call a `MemberRepository.get_by_id()` or the member name should be included in the `itemized_query` SQL join. Not a blocker for Phase 4 merge but should be cleaned up before the final review (T119).

---

## Required Actions

1. **[Backend] Fix `database.py`**: Move engine and session factory to module-level singletons (not created per-request). This is a correctness bug under load.
2. **[Backend] Add `aiosqlite` to `requirements-dev.txt`**: Prevents CI breakage.

The architecture note in `report_service.py` may be addressed now or deferred to T119 final review — the service produces correct output, the violation is structural only.

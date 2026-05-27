# Research: Portuguese Drunk Sailors

**Branch**: `001-portuguese-drunk-sailors` | **Date**: 2026-05-27

## Resolved Decisions

### JWT Algorithm: RS256 (not HS256)

**Decision**: RS256 (asymmetric, RSA) for JWT signing.

**Rationale**: The constitution (§ III. Architecture) mandates RS256 with the secret from
`JWT_SECRET`. The original tech-stack note listed HS256 — this is superseded by the
constitution. RS256 is also the stricter choice: it separates signing from verification and
is the industry standard for stateless web APIs.

**Implementation note**: `JWT_SECRET` environment variable holds the RSA private key (PEM).
The backend uses `python-jose` or `PyJWT` with RS256. A corresponding public key env var
(`JWT_PUBLIC_KEY`) is used for verification.

**Alternatives considered**: HS256 (spec draft) — rejected because constitution is
non-negotiable.

---

### Async Database Stack

**Decision**: SQLAlchemy 2.x with `async_sessionmaker`, asyncpg driver, Alembic migrations.

**Rationale**: Constitution mandates async database access. asyncpg is the fastest
PostgreSQL async driver for Python. SQLAlchemy 2.x `async_sessionmaker` is the canonical
way to manage async sessions. All model definitions use `DeclarativeBase`; no legacy
`declarative_base()`.

**Key patterns**:
- All session injection via FastAPI `Depends(get_async_session)`.
- Repository classes receive session as constructor arg.
- No `Session.execute()` in routers — service layer only.

**Alternatives considered**: Tortoise ORM — rejected (less mature, smaller ecosystem,
not constitution-approved).

---

### Monetary Arithmetic: Python Decimal + NUMERIC(10,2)

**Decision**: All monetary values use Python `Decimal` throughout backend; PostgreSQL stores
as `NUMERIC(10,2)`.

**Rationale**: Constitution strictly forbids `float`/`double` for money. `Decimal` avoids
IEEE 754 rounding errors. SQLAlchemy `Numeric(precision=10, scale=2)` maps to
`NUMERIC(10,2)`.

**Discount formula**:
```
item_discounted_price = item_price - (item_price / ticket_subtotal) * ticket_discount_total
```
All intermediate values computed with `Decimal`; final value quantized to
`Decimal('0.01')` (two decimal places). Floor at `Decimal('0.00')` — no negative item prices.

**Edge case**: If `ticket_subtotal == 0` (all items free), set `item_discounted_price = 0`.

---

### OCR Integration: OpenAI gpt-4o Vision

**Decision**: POST image bytes to OpenAI vision API (`gpt-4o`), parse structured JSON from
response. For PDFs, convert first page with `pdf2image` (depends on `poppler`).

**System prompt**: Instructs model to return only JSON — no markdown fences, no preamble.
Schema validated with Pydantic before returning draft to frontend.

**Error handling**:
- Malformed/non-JSON response → raise `OCRParseError`, return HTTP 422 to client.
- API timeout/network error → raise `OCRServiceError`, return HTTP 503.
- In all test environments, the OpenAI client MUST be mocked (constitution § II).

**Alternatives considered**: Tesseract (open-source) — rejected; insufficient accuracy for
varied receipt layouts, no cloud service needed.

---

### Multi-Agent Implementation via run-agents.sh / Brainstorm MCP

**Decision**: Implementation tasks are executed by parallel AI agents coordinated via
`run-agents.sh` (which wraps the Brainstorm MCP). Tasks from `tasks.md` are dispatched
to specialist agents (backend, frontend, infra) and their outputs are reviewed by the
coordinator (human-in-the-loop) before acceptance.

**Rationale**: User explicitly specified this delivery mechanism. Agent parallelism is
well-suited to the clear layer separation required by the constitution (routers / services /
repositories / frontend are independently implementable).

**Implications for tasks.md**:
- Tasks must be written as self-contained, agent-dispatchable units.
- File paths and interfaces must be explicit (agents have no shared memory).
- Each task should reference the relevant contract or data-model section.
- The coordinator reviews handoffs before merging agent output.

---

### File Upload Storage

**Decision**: Uploaded receipt images are stored on the local filesystem (configurable path
via `UPLOAD_DIR` env var), served as static files. Object storage (S3) can be swapped in
later by changing the repository implementation.

**Rationale**: Spec leaves storage backend as an infrastructure concern. Local filesystem
keeps the Docker Compose setup self-contained (no external services).

---

### Pairwise Balance Algorithm

**Decision**: Compute balances in pure SQL using two passes:
1. For each (creditor, debtor) pair, sum allocations where `creditor = ticket.paid_by`
   and `debtor = allocation.member_id` and `debtor ≠ creditor`.
2. Net: `balance(A→B) = gross(A→B) - gross(B→A)`. Show only positive net direction.

**Rationale**: Database-level computation avoids in-memory filtering (constitution § VI).
PostgreSQL CTEs make the two-pass query readable and correct.

---

### Frontend State Management

**Decision**: TanStack Query v5 for server state; React Hook Form + Zod for form state;
no global client state library (Redux, Zustand) needed.

**Rationale**: The app is primarily read-from-server + mutate-server. TanStack Query
handles caching, invalidation, and loading states. Local wizard state (upload → review →
allocate → confirm) is managed with `useState`/`useReducer` within the wizard component.

---

### i18n Strategy

**Decision**: i18next with `react-i18next`. Translation files at
`frontend/src/locales/{en,ru,pt}/translation.json`. Language switcher in navbar persists
choice to `localStorage`. Missing-key detection enabled in development builds.

**Constitution compliance**: All three locales required. Missing key = build error via
`i18next-scanner` pre-commit check.

<!--
SYNC IMPACT REPORT
==================
Version change: (template) → 1.0.0
Added sections:
  - I. Code Quality
  - II. Testing Standards
  - III. Architecture
  - IV. Security
  - V. UX Consistency
  - VI. Performance
  - VII. Docker & Infrastructure
  - Governance
Templates reviewed:
  - .specify/templates/plan-template.md ✅ (Constitution Check section present; aligns with principles)
  - .specify/templates/spec-template.md ✅ (no constitution-specific overrides required)
  - .specify/templates/tasks-template.md ✅ (foundational phase pattern fits multi-layer arch)
Deferred TODOs:
  - RATIFICATION_DATE: set to today (2026-05-27) as first adoption
-->

# Portuguese Drunk Sailors Constitution

## Core Principles

### I. Code Quality

Backend MUST be Python 3.12 with FastAPI and async SQLAlchemy 2.x. All database access MUST be
async using asyncpg. Synchronous database calls are forbidden anywhere in the codebase.

Frontend MUST be React 18 with TypeScript in strict mode, Tailwind CSS, and the HeroUI component
library. Plain CSS files are forbidden; the only CSS artefact permitted is the Tailwind config.

All monetary values MUST be stored as `NUMERIC(10,2)` in PostgreSQL. Floating-point types (`float`,
`double`) are strictly forbidden for any money calculation. Python's `Decimal` type MUST be used
throughout the backend for all monetary arithmetic.

Pre-commit hooks (black, isort, flake8, mypy) MUST pass before any commit. CI MUST enforce the
same checks and fail the build on any violation.

### II. Testing Standards

Backend tests MUST use pytest with pytest-asyncio. Minimum 80% line coverage is non-negotiable;
the suite MUST be run with `pytest --cov=app --cov-fail-under=80` and any failure blocks merge.

The OCR service (OpenAI Vision API calls) MUST always be mocked in tests. No real external API
calls are permitted anywhere in the test suite.

Frontend tests MUST use Vitest and React Testing Library. All form components, page flows, and
i18n rendering MUST have unit tests. API calls MUST be mocked with MSW (Mock Service Worker).

Tests MUST live alongside source in a `tests/` directory. Every new module MUST have a
corresponding test file created in the same PR.

### III. Architecture

Strict layer separation is mandatory:
- **Routers** handle HTTP concerns only (request parsing, response serialisation, status codes).
- **Service classes** own all business logic.
- **Repository classes** own all data-access logic.

Business logic MUST NOT appear in Pydantic schemas or SQLAlchemy models.

All API routes except `POST /auth/login` MUST require a valid JWT. JWT algorithm MUST be RS256;
the secret MUST be read from the environment variable `JWT_SECRET`.

Environment variables are the single source of truth for all configuration. Hardcoded credentials,
API keys, or URLs are forbidden anywhere in source code.

Alembic MUST manage all schema changes. Direct DDL against the database is forbidden.

### IV. Security

Passwords for the two pre-created users MUST be stored as bcrypt hashes. Plain-text passwords
MUST never persist to any storage layer or log.

File uploads MUST be validated for MIME type (JPEG, PNG, WEBP, PDF only) and size (maximum 10 MB)
before any processing begins. Uploads failing validation MUST be rejected with a 422 response.

CORS MUST be locked to the frontend origin specified via environment variable. Wildcard CORS
(`*`) is forbidden in all environments including development.

### V. UX Consistency

All user-facing text MUST be internationalised via i18next. Hardcoded strings in JSX are
forbidden. The i18n key MUST be referenced; the literal string must not appear in component code.

Three locales are supported: English (`en`), Russian (`ru`), and Portuguese (`pt`). All three
translation files MUST be kept in sync; a missing key in any locale is treated as a build error.

The colour scheme MUST follow the Portuguese flag palette:
- Primary green: `#006600`
- Red: `#FF0000`
- Gold accent: `#FFD700`
- Surface: warm off-white `#FAFAF5`

No other primary brand colours are permitted.

All monetary amounts displayed in the UI MUST show exactly two decimal places with a euro symbol
(e.g. `€23.50`).

### VI. Performance

All list endpoints MUST be paginated. Default page size is 20; maximum page size is 100. Clients
MUST NOT receive unbounded result sets.

Ticket list queries MUST apply filtering (date range, member, category) at the database level.
In-memory filtering of full result sets is forbidden.

### VII. Docker & Infrastructure

The application MUST run entirely via `docker compose up --build`. No manual setup steps are
required beyond copying `.env.example` to `.env`.

Alembic migrations MUST run automatically on backend container startup before the application
accepts traffic.

## Governance

This constitution supersedes all other practices, conventions, and preferences. Any principle
stated here is non-negotiable without a formal amendment.

**Amendment procedure**:
1. Open a PR with the proposed change to this file.
2. Bump `CONSTITUTION_VERSION` following semantic versioning:
   - MAJOR: backward-incompatible principle removal or redefinition.
   - MINOR: new principle or section added.
   - PATCH: clarification, wording fix, or non-semantic refinement.
3. Update `LAST_AMENDED_DATE` to the date of merge.
4. Propagate changes to dependent templates (`plan-template.md`, `spec-template.md`,
   `tasks-template.md`) in the same PR.
5. Obtain approval from the project coordinator before merging.

**Compliance review**: Every PR MUST include a Constitution Check confirming no principles are
violated. Violations require explicit justification in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-05-27 | **Last Amended**: 2026-05-27

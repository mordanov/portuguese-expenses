Create principles for a family expense tracking and cost allocation application called "Portuguese Drunk Sailors". Establish the following non-negotiable governance rules:

**Code Quality**
- Backend is Python 3.12 with FastAPI and async SQLAlchemy 2.x. All database access must be async using asyncpg. No synchronous database calls are permitted anywhere.
- Frontend is React 18 with TypeScript (strict mode), Tailwind CSS, and HeroUI component library. No plain CSS files except Tailwind config.
- All monetary values must be stored as NUMERIC(10,2) in PostgreSQL. Floating-point types (float, double) are strictly forbidden for any money calculation. Use Python's `Decimal` type throughout the backend.
- pre-commit hooks (black, isort, flake8, mypy) must pass before any commit. CI must enforce this.

**Testing Standards**
- Backend: pytest with pytest-asyncio. Minimum 80% line coverage enforced via `pytest --cov=app --cov-fail-under=80`. No exceptions.
- The OCR service (OpenAI Vision calls) must always be mocked in tests. No real external API calls in the test suite.
- Frontend: Vitest + React Testing Library. All form components, page flows, and i18n rendering must have unit tests. API calls mocked with MSW.
- Tests live alongside source in a `tests/` directory. Every new module gets a corresponding test file.

**Architecture**
- Strict separation: routers handle HTTP only, business logic lives in service classes, data access in repository classes.
- No business logic in Pydantic schemas or SQLAlchemy models.
- All API routes except `POST /auth/login` require a valid JWT. JWT is RS256, secret from environment variable `JWT_SECRET`.
- Environment variables are the single source of truth for all configuration. No hardcoded credentials, keys, or URLs anywhere in source code.
- Alembic manages all schema changes. Direct DDL against the database is forbidden.

**Security**
- Passwords for the two pre-created users are stored as bcrypt hashes. Plain-text passwords never persist.
- File uploads are validated for type (JPEG, PNG, WEBP, PDF only) and size (max 10 MB) before processing.
- CORS is locked to the frontend origin only. Wildcard CORS is forbidden.

**UX Consistency**
- All user-facing text must be internationalised via i18next. Hardcoded strings in JSX are forbidden.
- Three supported locales: English (en), Russian (ru), Portuguese (pt). All three translation files must be kept in sync.
- Colour scheme follows the Portuguese flag palette: primary green #006600, red #FF0000, gold accent #FFD700. No other primary brand colours.
- All monetary amounts displayed in the UI must show exactly two decimal places with a euro symbol.

**Performance**
- Paginate all list endpoints with a default page size of 20 and a maximum of 100.
- Ticket list queries must use database-level filtering (date range, member, category) — no in-memory filtering of full result sets.

**Docker**
- The application runs entirely via `docker compose up --build`. No manual setup steps should be required beyond copying `.env.example` to `.env`.
- Alembic migrations run automatically on backend container startup.

# Quickstart: Multi-Project Support

**Branch**: `002-multi-project-support` | **Date**: 2026-07-15

## Prerequisites

- Docker Desktop running
- `.env` file present (copy from `.env.example`)
- No additional env vars required — `OPENAI_API_KEY` already covers colour suggestions

## Start / Restart

```bash
docker compose up --build
```

Alembic migration `010_multi_project_support` runs automatically on backend startup.
After migration, all existing data is attributed to the `Portugal-2026` project.

## Validate Migration

```bash
# Confirm Portugal-2026 project exists
docker compose exec db psql -U postgres portuguese_expenses \
  -c "SELECT id, name, status, default_language FROM projects;"

# Confirm all tickets are linked
docker compose exec db psql -U postgres portuguese_expenses \
  -c "SELECT COUNT(*) FROM tickets WHERE project_id IS NULL;"
# Expected: 0

# Confirm all family members are in Portugal-2026 via join table
docker compose exec db psql -U postgres portuguese_expenses \
  -c "SELECT COUNT(*) FROM project_members pm JOIN projects p ON pm.project_id = p.id WHERE p.name = 'Portugal-2026';"
```

## Login Flow (Post-Migration)

1. Open `http://localhost:3000`
2. Admin user: project chooser appears; select `Portugal-2026`
3. Non-admin user: project chooser hidden; auto-scoped to assigned project

## Create a New Project (Admin)

1. Log in as admin
2. Navigate to **Projects** (top-level navbar item, admin only)
3. Click **New Project**
4. Enter name, click **Suggest Colours**, review palette
5. Set **Default Ticket Language** (e.g. `fr` for France)
6. Click **Save**

## Switch Projects (Admin)

Click the project name badge in the navbar → select a different project from the dropdown.
A new JWT is issued automatically; all views refresh to the selected project.

## Run Tests

```bash
# Backend
docker compose exec backend pytest --cov=app --cov-fail-under=80

# Frontend
docker compose exec frontend npm test
```

## Key Environment Variables (no changes from 001)

| Variable          | Description                              |
|-------------------|------------------------------------------|
| `OPENAI_API_KEY`  | Used for both OCR and colour suggestions |
| `JWT_PRIVATE_KEY` | RS256 private key                        |
| `JWT_PUBLIC_KEY`  | RS256 public key                         |
| `DATABASE_URL`    | PostgreSQL connection string             |
| `FRONTEND_URL`    | CORS allowed origin                      |

No new environment variables are required for this feature.

## OCR Default Language Values

Each project has a `default_language` field (set at creation). Accepted values:

| Value    | Language    |
|----------|-------------|
| `pt`     | Portuguese  |
| `fr`     | French      |
| `es`     | Spanish     |
| `de`     | German      |
| `en`     | English     |
| `other`  | Unknown / other — OCR uses generic extraction without language hint |

The active project's `default_language` is automatically injected into the OCR prompt as
`"The receipt is written in {language}."` This improves extraction accuracy for non-English receipts.

## Deployment Note: Pre-Migration Token Invalidation

On first deploy of this feature, any admin tokens issued before migration 010 lack the
`project_id` and `role` JWT claims. These tokens expire within the configured
`JWT_EXPIRE_MINUTES` window (default: 480 min). All users must log out and log back in
after the migration to receive a token with the updated claims. No manual revocation
step is required — tokens naturally expire.

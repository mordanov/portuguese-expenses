# Data Model: Multi-Project Support

**Branch**: `002-multi-project-support` | **Date**: 2026-07-15

All monetary columns use `NUMERIC(10,2)`. All IDs are `UUID`. Timestamps are `TIMESTAMPTZ`.
This document describes **only the changes and additions** to the existing schema.
Unchanged entities (items, allocations, payments, offset_rules) are omitted.

---

## New Entity: `projects`

| Column             | Type          | Constraints                            | Notes                              |
|--------------------|---------------|----------------------------------------|------------------------------------|
| `id`               | UUID          | PK, default gen_random_uuid()          | —                                  |
| `name`             | VARCHAR(100)  | NOT NULL, UNIQUE                       | Human-readable trip name           |
| `default_language` | VARCHAR(10)   | NOT NULL, default `'pt'`               | IETF tag, e.g. `pt`, `fr`, `es`    |
| `bg_color`         | VARCHAR(7)    | NOT NULL, default `'#006600'`          | 6-digit hex, e.g. `#006600`        |
| `text_color`       | VARCHAR(7)    | NOT NULL, default `'#FFFFFF'`          | 6-digit hex                        |
| `accent_color`     | VARCHAR(7)    | NOT NULL, default `'#FFD700'`          | 6-digit hex                        |
| `status`           | VARCHAR(10)   | NOT NULL, CHECK IN (`open`,`closed`), default `'open'` | Project lifecycle |
| `created_at`       | TIMESTAMPTZ   | NOT NULL, default NOW()                | —                                  |

**Rules**:
- `name` must be globally unique across all projects.
- `status = 'closed'` makes the project read-only; all write operations (create/update/delete
  tickets, items, categories, members-of-project) are rejected with 403.
- Hard-delete is not supported; no `DELETE` endpoint exists.
- `Portugal-2026` is seeded by the migration with `id = 'a0000000-0000-0000-0000-000000000001'`
  (stable UUID for backfill), `default_language = 'pt'`, Portuguese flag default colours.

**Indexes**:
- `(status)` — for filtering open projects in the chooser

---

## New Entity: `project_members`

Join table — one family member can participate in many projects.

| Column       | Type        | Constraints                                  | Notes            |
|--------------|-------------|----------------------------------------------|------------------|
| `project_id` | UUID        | FK → projects.id, NOT NULL, ON DELETE CASCADE| —                |
| `member_id`  | UUID        | FK → family_members.id, NOT NULL             | —                |
| `joined_at`  | TIMESTAMPTZ | NOT NULL, default NOW()                      | —                |

**Primary key**: `(project_id, member_id)`

**Rules**:
- A member is visible in a project's allocation selectors only if a row exists here
  AND `family_members.is_active = TRUE`.
- Adding a member to a closed project is forbidden.
- Migration inserts all existing `family_members` into this table for Portugal-2026.

---

## Modified Entity: `tickets`

| Column       | Type  | Change                                          |
|--------------|-------|-------------------------------------------------|
| `project_id` | UUID  | **ADDED** FK → projects.id, NOT NULL            |

- Backfilled to Portugal-2026 UUID for all existing rows.
- All ticket queries receive an implicit `WHERE tickets.project_id = :active_project_id`
  filter applied at the repository layer.

**New index**: `(project_id, purchased_at)` — composite; replaces the existing `(purchased_at)`
index for multi-project date-range queries.

---

## Modified Entity: `categories`

| Column       | Type  | Change                                          |
|--------------|-------|-------------------------------------------------|
| `project_id` | UUID  | **ADDED** FK → projects.id, NOT NULL            |

- `UNIQUE (name)` → replaced by `UNIQUE (name, project_id)`.
- Default categories (Wine, Meals, Entertainment, Gifts, Parking, Other) are seeded by the
  `ProjectService.create()` method (not a migration) so every new project starts with them.
- Migration backfills all existing categories to Portugal-2026.

---

## Modified Entity: `app_users`

| Column       | Type  | Change                                                  |
|--------------|-------|---------------------------------------------------------|
| `project_id` | UUID  | **ADDED** FK → projects.id, NULLABLE                    |

- `role` column already exists (`admin` \| `user`). No change to its definition.
- `project_id` is NULL for admin accounts (they can switch projects at runtime).
- `project_id` is NOT NULL for `user` role accounts; enforced at the service layer.
- Migration sets `project_id` = Portugal-2026 UUID for all existing rows where
  `role = 'user'`.

---

## Modified Entity: `family_members`

No column changes. The `UNIQUE (name)` constraint **remains** (members are global; names
must be globally unique across all projects). Relationships are added via the new
`project_members` join table.

---

## Migration: `010_multi_project_support.py`

Ordered steps (single Alembic revision, single transaction):

```
1. CREATE TABLE projects (...)
2. INSERT INTO projects VALUES ('a0000000-...', 'Portugal-2026', 'pt', '#006600', '#FFFFFF', '#FFD700', 'open', NOW())
3. ALTER TABLE tickets ADD COLUMN project_id UUID NULL REFERENCES projects(id)
4. ALTER TABLE categories ADD COLUMN project_id UUID NULL REFERENCES projects(id)
5. ALTER TABLE app_users ADD COLUMN project_id UUID NULL REFERENCES projects(id)
6. UPDATE tickets SET project_id = 'a0000000-...' WHERE project_id IS NULL
7. UPDATE categories SET project_id = 'a0000000-...' WHERE project_id IS NULL
8. UPDATE app_users SET project_id = 'a0000000-...' WHERE role = 'user'
9. ALTER TABLE tickets ALTER COLUMN project_id SET NOT NULL
10. ALTER TABLE categories ALTER COLUMN project_id SET NOT NULL
11. CREATE TABLE project_members (project_id UUID REFERENCES projects(id) ON DELETE CASCADE, member_id UUID REFERENCES family_members(id), joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (project_id, member_id))
12. INSERT INTO project_members (project_id, member_id) SELECT 'a0000000-...', id FROM family_members
13. DROP CONSTRAINT categories_name_key
14. ADD CONSTRAINT categories_name_project_id_key UNIQUE (name, project_id)
15. CREATE INDEX ix_tickets_project_id_purchased_at ON tickets (project_id, purchased_at)
16. CREATE INDEX ix_projects_status ON projects (status)
```

**Down migration**: Reverse steps 3–16 (drop columns, drop tables, restore constraint).

---

## JWT Payload (updated)

```json
{
  "sub": "<user_id>",
  "role": "admin | user",
  "project_id": "<uuid or null for admin before project selection>"
}
```

Admin tokens carry `project_id` of the currently selected project. A new
`POST /auth/switch-project` endpoint issues a fresh token with an updated `project_id`
without requiring re-authentication.

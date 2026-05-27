# Data Model: Portuguese Drunk Sailors

**Branch**: `001-portuguese-drunk-sailors` | **Date**: 2026-05-27

All monetary columns use `NUMERIC(10,2)`. All IDs are `UUID` (PostgreSQL `gen_random_uuid()`).
Timestamps are `TIMESTAMPTZ` (UTC-stored).

---

## Entities

### `family_members`

| Column     | Type         | Constraints                  | Notes                          |
|------------|--------------|------------------------------|--------------------------------|
| `id`       | UUID         | PK, default gen_random_uuid()| —                              |
| `name`     | VARCHAR(100) | NOT NULL, UNIQUE             | Display name                   |
| `is_active`| BOOLEAN      | NOT NULL, default TRUE       | FALSE = soft-deleted           |
| `created_at`| TIMESTAMPTZ | NOT NULL, default NOW()      | —                              |
| `updated_at`| TIMESTAMPTZ | NOT NULL, default NOW()      | Updated on every write         |

**Rules**:
- Soft delete only (`is_active = FALSE`). No `DELETE` permitted.
- Active members (`is_active = TRUE`) appear in allocation selectors.
- Historical allocations retain their `member_id` FK even after deactivation.

---

### `categories`

| Column     | Type         | Constraints                  | Notes                          |
|------------|--------------|------------------------------|--------------------------------|
| `id`       | UUID         | PK, default gen_random_uuid()| —                              |
| `name`     | VARCHAR(100) | NOT NULL, UNIQUE             | Display name                   |
| `color`    | VARCHAR(7)   | NOT NULL                     | Hex color, e.g. `#FF0000`      |
| `created_at`| TIMESTAMPTZ | NOT NULL, default NOW()      | —                              |

**Rules**:
- `DELETE` is blocked at the service layer if any `items.category_id` references this row.
- Default categories seeded on first run: Wine, Meals, Entertainment, Gifts, Parking, Other.

---

### `tickets`

| Column          | Type            | Constraints                   | Notes                             |
|-----------------|-----------------|-------------------------------|-----------------------------------|
| `id`            | UUID            | PK, default gen_random_uuid() | —                                 |
| `store_name`    | VARCHAR(200)    | NOT NULL                      | From OCR or manual entry          |
| `purchased_at`  | TIMESTAMPTZ     | NOT NULL                      | Datetime of purchase              |
| `paid_by_id`    | UUID            | FK → family_members.id, NOT NULL | Member who paid                |
| `raw_image_url` | TEXT            | NULLABLE                      | Path/URL to uploaded receipt file |
| `total_price`   | NUMERIC(10,2)   | NOT NULL, CHECK >= 0          | As printed on receipt             |
| `discount_total`| NUMERIC(10,2)   | NOT NULL, default 0.00, CHECK >= 0 | Ticket-level discount        |
| `created_at`    | TIMESTAMPTZ     | NOT NULL, default NOW()       | —                                 |
| `updated_at`    | TIMESTAMPTZ     | NOT NULL, default NOW()       | —                                 |

**Indexes**:
- `(purchased_at)` — for date-range filtering
- `(paid_by_id)` — for balance queries

**Rules**:
- `discount_total` MUST NOT exceed `SUM(items.price)` for the ticket (enforced in service layer).
- A ticket is saved atomically with all its items and allocations in a single transaction.

---

### `items`

| Column             | Type          | Constraints                     | Notes                              |
|--------------------|---------------|---------------------------------|------------------------------------|
| `id`               | UUID          | PK, default gen_random_uuid()   | —                                  |
| `ticket_id`        | UUID          | FK → tickets.id ON DELETE CASCADE, NOT NULL | —                   |
| `name`             | VARCHAR(300)  | NOT NULL                        | As extracted or edited             |
| `price`            | NUMERIC(10,2) | NOT NULL, CHECK >= 0            | Original price from receipt        |
| `discounted_price` | NUMERIC(10,2) | NOT NULL, CHECK >= 0            | Computed on ticket save            |
| `category_id`      | UUID          | FK → categories.id, NULLABLE    | Optional category tag              |
| `position`         | SMALLINT      | NOT NULL, default 0             | Display order within ticket        |
| `created_at`       | TIMESTAMPTZ   | NOT NULL, default NOW()         | —                                  |

**Indexes**:
- `(ticket_id)` — items are always fetched by ticket
- `(category_id)` — for category-level reporting

**Computed field — `discounted_price`**:
```
ticket_subtotal = SUM(item.price) for all items on ticket

item.discounted_price = item.price - (item.price / ticket_subtotal) * ticket.discount_total
                      = MAX(0.00, result)   # floor at zero
                      quantized to 0.01    # two decimal places
```
Computed by the `TicketService` before `INSERT`. Never recomputed after save unless the
ticket or item is explicitly edited.

---

### `allocations`

| Column      | Type | Constraints                                         | Notes                               |
|-------------|------|-----------------------------------------------------|-------------------------------------|
| `id`        | UUID | PK, default gen_random_uuid()                       | —                                   |
| `item_id`   | UUID | FK → items.id ON DELETE CASCADE, NOT NULL           | —                                   |
| `member_id` | UUID | FK → family_members.id, NOT NULL                    | Deactivated members retained        |
| `created_at`| TIMESTAMPTZ | NOT NULL, default NOW()                     | —                                   |

**Unique constraint**: `(item_id, member_id)` — one allocation row per member per item.

**Indexes**:
- `(item_id)` — cost-per-member calculation
- `(member_id)` — balance and itemized report queries

**Derived value — cost per member for one item**:
```
cost = item.discounted_price / COUNT(allocations WHERE item_id = item.id)
```
Computed at query time (not stored). Used in balance and report queries.

---

### `app_users` (authentication only)

| Column          | Type         | Constraints                   | Notes                               |
|-----------------|--------------|-------------------------------|-------------------------------------|
| `id`            | UUID         | PK, default gen_random_uuid() | —                                   |
| `username`      | VARCHAR(100) | NOT NULL, UNIQUE              | From env var `APP_USER_1_USERNAME`  |
| `password_hash` | VARCHAR(200) | NOT NULL                      | bcrypt hash                         |
| `created_at`    | TIMESTAMPTZ  | NOT NULL, default NOW()       | —                                   |

**Rules**:
- Two rows seeded from environment variables on startup.
- No `INSERT` via API. No registration endpoint.
- Plain-text password MUST NOT be logged or stored.

---

## Relationships Diagram (text)

```
app_users           (2 rows, auth only)

family_members      (8 rows typical, soft-deletable)
    │
    ├──< tickets.paid_by_id
    └──< allocations.member_id

categories          (6 default, user-editable)
    └──< items.category_id

tickets
    └──< items.ticket_id
            └──< allocations.item_id
```

---

## Alembic Migration Strategy

1. `001_initial_schema.py` — creates all tables above.
2. `002_seed_default_categories.py` — inserts 6 default categories.
3. `003_seed_app_users.py` — reads env vars, inserts 2 bcrypt-hashed users.
4. Future migrations follow sequential numbering.

Migrations run automatically on backend container startup (`alembic upgrade head`).
Direct DDL against the database is forbidden (constitution § III).

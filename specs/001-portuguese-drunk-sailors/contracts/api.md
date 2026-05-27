# API Contracts: Portuguese Drunk Sailors

**Branch**: `001-portuguese-drunk-sailors` | **Date**: 2026-05-27
**Base URL**: `http://localhost:8000` (development) — configured via `BACKEND_URL` env var
**Auth**: Bearer JWT (RS256) required on all endpoints except `POST /auth/login`
**Content-Type**: `application/json` unless noted (multipart for upload)
**Pagination**: All list endpoints accept `?page=1&page_size=20` (default 20, max 100)
**Monetary values**: Always strings in JSON to avoid float precision loss, e.g. `"23.50"`

---

## Authentication

### `POST /auth/login`

Login with username + password. Returns JWT.

**Request**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response 200**:
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

**Response 401**: `{ "detail": "Invalid credentials" }`

---

## Family Members

### `GET /members`

List all family members.

**Query params**:
- `active_only` (boolean, default `false`) — when `true`, returns only active members
- `page` (integer, default `1`)
- `page_size` (integer, default `20`, max `100`)

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "is_active": true,
      "created_at": "ISO8601"
    }
  ],
  "total": 8,
  "page": 1,
  "page_size": 20
}
```

### `POST /members`

Create a new family member.

**Request**:
```json
{ "name": "string" }
```

**Response 201**:
```json
{ "id": "uuid", "name": "string", "is_active": true, "created_at": "ISO8601" }
```

**Response 409**: `{ "detail": "Member name already exists" }`

### `PUT /members/{id}`

Rename or activate/deactivate a member.

**Request** (all fields optional):
```json
{ "name": "string", "is_active": false }
```

**Response 200**: Updated member object (same schema as POST 201).

**Response 404**: `{ "detail": "Member not found" }`

### `DELETE /members/{id}`

Soft-delete (sets `is_active = false`).

**Response 204**: No body.

---

## Categories

### `GET /categories`

**Query params**:
- `page` (integer, default `1`)
- `page_size` (integer, default `20`, max `100`)

**Response 200**:
```json
{
  "items": [
    { "id": "uuid", "name": "string", "color": "#FF0000", "created_at": "ISO8601" }
  ],
  "total": 6,
  "page": 1,
  "page_size": 20
}
```

### `POST /categories`

**Request**: `{ "name": "string", "color": "#RRGGBB" }`

**Response 201**: Category object.

**Response 409**: `{ "detail": "Category name already exists" }`

### `PUT /categories/{id}`

**Request** (all optional): `{ "name": "string", "color": "#RRGGBB" }`

**Response 200**: Updated category object.

### `DELETE /categories/{id}`

**Response 204**: No body.

**Response 409**: `{ "detail": "Category is referenced by items and cannot be deleted" }`

---

## Tickets

### `POST /tickets/upload`

Upload receipt image or PDF for OCR extraction.

**File handling**: The server saves the file to `UPLOAD_DIR` using a UUID v4 filename (e.g.
`a1b2c3d4-uuid.jpg`). The client-supplied filename is **never** used in filesystem paths.
The saved path is returned as `raw_image_url` in the draft so the client can pass it to
`POST /tickets`. Orphan files (wizard abandoned) are cleaned up by a startup sweep of
`UPLOAD_DIR` for files older than 24 hours not referenced by any ticket.

**Request**: `multipart/form-data` with field `file` (JPEG, PNG, WEBP, PDF; max 10 MB).
MIME type is validated from magic bytes — not from `Content-Type` header or file extension.

**Response 200** — draft for review:
```json
{
  "store_name": "Lidl",
  "purchased_at": "2026-05-20T14:30:00Z",
  "items": [
    { "name": "Bread", "price": "1.49" },
    { "name": "Wine Alentejo", "price": "5.99" }
  ],
  "discount_total": "0.50",
  "total_price": "6.98",
  "raw_image_url": "/uploads/a1b2c3d4-uuid.jpg"
}
```

`raw_image_url` is the server-relative path to the saved file. Pass this value unchanged
in `POST /tickets`. `null` if file storage fails non-fatally (OCR draft still returned).

**Response 422**: Unsupported file type or exceeds 10 MB.
**Response 503**: OCR service unavailable.

---

### `POST /tickets`

Save a confirmed ticket with items and allocations.

**Request**:
```json
{
  "store_name": "string",
  "purchased_at": "ISO8601",
  "paid_by_id": "uuid",
  "total_price": "6.98",
  "discount_total": "0.50",
  "raw_image_url": "string | null",
  "items": [
    {
      "name": "string",
      "price": "1.49",
      "category_id": "uuid | null",
      "position": 0,
      "member_ids": ["uuid", "uuid"]
    }
  ]
}
```

**Response 201**:
```json
{ "id": "uuid", "store_name": "string", "purchased_at": "ISO8601", ... }
```
(Full ticket schema — see GET /tickets/{id} for complete shape.)

**Response 422**: Validation error (e.g. member_ids empty for an item, invalid paid_by_id).

---

### `GET /tickets`

Paginated, filterable ticket list.

**Query params**:
- `from` (ISO8601 date), `to` (ISO8601 date)
- `member_id` (UUID) — filter tickets where member appears in at least one `allocations` row for that ticket's items (join path: tickets → items → allocations); does NOT match on `paid_by_id` alone
- `category_id` (UUID) — filter tickets containing items with this category
- `page`, `page_size`

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "store_name": "string",
      "purchased_at": "ISO8601",
      "paid_by": { "id": "uuid", "name": "string" },
      "total_price": "6.98",
      "discount_total": "0.50",
      "item_count": 2
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

### `GET /tickets/{id}`

Full ticket detail including items and allocations.

**Response 200**:
```json
{
  "id": "uuid",
  "store_name": "string",
  "purchased_at": "ISO8601",
  "paid_by": { "id": "uuid", "name": "string" },
  "raw_image_url": "string | null",
  "total_price": "6.98",
  "discount_total": "0.50",
  "created_at": "ISO8601",
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "price": "1.49",
      "discounted_price": "1.42",
      "position": 0,
      "category": { "id": "uuid", "name": "string", "color": "#FF0000" } ,
      "allocated_members": [
        { "id": "uuid", "name": "string", "cost": "0.71" }
      ]
    }
  ]
}
```

### `PUT /tickets/{id}`

Update ticket **header fields only** (store_name, purchased_at, paid_by_id, total_price,
discount_total). Recalculates `discounted_price` for all existing items using their stored
`price` values and the new `discount_total`. Item prices and allocations are unchanged.

To edit individual item prices → use `PUT /items/{id}`.
To change item allocations → use `PUT /items/{id}/allocations`.

**Request** (all fields optional):
```json
{
  "store_name": "string",
  "purchased_at": "ISO8601",
  "paid_by_id": "uuid",
  "total_price": "7.50",
  "discount_total": "1.00"
}
```

**Response 200**: Updated ticket (same full schema as GET /tickets/{id}), with all items'
`discounted_price` fields recomputed.

### `DELETE /tickets/{id}`

Hard delete ticket (cascades to items and allocations).

**Response 204**: No body.

---

## Items

### `PUT /items/{id}`

Update an individual item's name, price, category, or position.
When `price` is updated, `discounted_price` is recomputed for **all items** on the parent
ticket (single transaction) using the ticket's current `discount_total`.

**Request** (all optional):
```json
{ "name": "string", "price": "2.00", "category_id": "uuid | null", "position": 1 }
```

**Response 200**: Full updated **ticket** (same schema as `GET /tickets/{id}`).
The frontend must replace its cached ticket with this response — sibling items
have updated `discounted_price` values.

> Note: returns the full ticket (not just the item) so the frontend can display
> correct discounted prices for all items without a separate refetch.

### `PUT /items/{id}/allocations`

Replace the full allocation list for one item.

**Request**:
```json
{ "member_ids": ["uuid", "uuid"] }
```

**Response 200**:
```json
{ "item_id": "uuid", "allocated_members": [{ "id": "uuid", "name": "string", "cost": "0.71" }] }
```

**Response 422**: `member_ids` is empty.

---

## Balances

### `GET /balances`

Pairwise net balances. See `research.md` "Pairwise Balance Algorithm" for the two-pass
CTE implementation.

**Query params**: `from` (ISO8601 date), `to` (ISO8601 date) — both optional; filter
applies to `ticket.purchased_at`.

**Response 200**:
```json
{
  "balances": [
    {
      "debtor": { "id": "uuid", "name": "Alice" },
      "creditor": { "id": "uuid", "name": "Bob" },
      "amount": "20.00"
    }
  ],
  "as_of": "2026-05-27T12:00:00Z"
}
```

`as_of` is the UTC timestamp at the time of the request.
Only rows where net `amount > "0.00"` are returned — zero-balance rows are excluded.
All `amount` values are strings with exactly 2 decimal places (e.g. `"20.00"`).

---

## Reports

### `GET /reports/summary`

Total cost per family member.

**Query params**: `from` (ISO8601 date, required), `to` (ISO8601 date, required)

**Response 200**:
```json
{
  "from": "2026-05-01",
  "to": "2026-05-31",
  "members": [
    { "member": { "id": "uuid", "name": "Alice" }, "total": "123.45" }
  ]
}
```

### `GET /reports/itemized`

All items consumed by a member.

**Query params**: `from`, `to` (required), `member_id` (UUID, required)

**Response 200**:
```json
{
  "member": { "id": "uuid", "name": "Alice" },
  "from": "2026-05-01",
  "to": "2026-05-31",
  "tickets": [
    {
      "ticket": { "id": "uuid", "store_name": "Lidl", "purchased_at": "ISO8601" },
      "items": [
        { "name": "Bread", "discounted_price": "1.42", "member_cost": "0.71" }
      ],
      "ticket_total_for_member": "0.71"
    }
  ],
  "grand_total": "0.71"
}
```

### `GET /reports/categories`

Spending by category.

**Query params**: `from`, `to` (required)

**Response 200**:
```json
{
  "from": "2026-05-01",
  "to": "2026-05-31",
  "total": "456.00",
  "categories": [
    {
      "category": { "id": "uuid", "name": "Wine", "color": "#722F37" },
      "total": "120.00",
      "percentage": "26.32"
    }
  ],
  "uncategorized": "45.00"
}
```

---

## Health

### `GET /health`

Docker Compose health check. No authentication required.

**Response 200**:
```json
{ "status": "ok" }
```

---

## Error Response Shape

All 4xx/5xx responses follow:
```json
{
  "detail": "Human-readable error message"
}
```

For 422 validation errors, FastAPI returns the standard:
```json
{
  "detail": [
    { "loc": ["body", "field"], "msg": "error message", "type": "error_type" }
  ]
}
```

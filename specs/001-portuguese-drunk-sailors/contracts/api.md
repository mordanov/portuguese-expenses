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

**Query params**: `?active_only=true` (default `false` — returns all)

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

Upload receipt image or PDF for OCR extraction. Does NOT save — returns draft only.

**Request**: `multipart/form-data` with field `file` (JPEG, PNG, WEBP, PDF; max 10 MB).

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
  "total_price": "6.98"
}
```

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
- `member_id` (UUID) — filter tickets where member has at least one allocation
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

Update ticket header fields (store name, purchased_at, paid_by_id, total_price,
discount_total). Recalculates `discounted_price` for all items.

**Request**: Same schema as `POST /tickets` but all fields optional.

**Response 200**: Updated ticket (same as GET /tickets/{id}).

### `DELETE /tickets/{id}`

Hard delete ticket (cascades to items and allocations).

**Response 204**: No body.

---

## Items

### `PUT /items/{id}`

Update an individual item's name, price, category, or position.
Recalculates `discounted_price` for all items on the parent ticket.

**Request** (all optional):
```json
{ "name": "string", "price": "2.00", "category_id": "uuid | null", "position": 1 }
```

**Response 200**: Updated item object (same shape as items array in GET /tickets/{id}).

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

Pairwise net balances.

**Query params**: `from` (ISO8601 date), `to` (ISO8601 date) — both optional.

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

Only net-positive rows are returned (if Alice owes Bob €0, the row is omitted).

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

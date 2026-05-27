Build "Portuguese Drunk Sailors" — a family expense tracking and cost allocation web application for 8 family members (6 adults, 2 children).

## Core Problem

A family shares purchases across multiple stores (groceries, wine, supermarkets). After each shopping trip, one person pays the full bill. The app must answer: what did each person actually consume, and who owes whom money?

## User Stories

**Receipt capture**
- As a user, I can upload a photo or PDF of a receipt (drag-and-drop, file picker, or mobile camera) so the app can extract its contents automatically.
- As a user, after the scan I see a fully editable table of items with their names, prices, and categories before anything is saved, so I can correct OCR mistakes.
- As a user, I can select which family member paid for the ticket, so debt tracking reflects the real payer.

**Cost allocation**
- As a user, I allocate each item on the receipt to one or more family members using a multi-select chip interface, so each person is charged only for what they consumed.
- As a user, I can use a "select all members" shortcut per item for shared items like water or bread.
- As a user, I see a live per-member cost summary before confirming the ticket, so I can verify the split looks correct.

**Discount handling**
- The app distributes the ticket-level discount proportionally across all items by price weight, then splits each item's discounted price equally among its allocated members.
- Formula: `item_discounted_price = item_price − (item_price / ticket_subtotal) × ticket_discount_total`

**Balance tracking**
- As a user, I see a balance screen showing who owes whom money (e.g. "Alice owes Bob €23.50") across all tickets or filtered by date range.
- Balances are pairwise net amounts: if Alice owes Bob €30 and Bob owes Alice €10, the display shows "Alice owes Bob €20".

**Reporting**
- As a user, I can select a custom date range and see total cost per family member for that period.
- As a user, I can select a family member and see every item they consumed, grouped by ticket, for a date range.
- As a user, I can see spending broken down by category (Wine, Meals, Entertainment, Gifts, Parking, Other — editable list) as a pie chart and table.

**Family member management**
- As a user, I can add, rename, and deactivate family members. Deactivated members remain on historical records but no longer appear in new allocation selectors.

**Category management**
- As a user, I can add, rename, and delete spending categories. Each category has a display colour. Deletion is blocked if any item references that category.

**Authentication**
- Two users are pre-created from environment variables. There is no registration flow.
- Login via username + password returns a JWT. All routes except login require a valid JWT.
- Both users have identical, full permissions.

## Domain Entities & Rules

**Ticket**: `purchased_at` (datetime), `store_name`, `paid_by` (→ FamilyMember), `raw_image_url`, `total_price` NUMERIC(10,2), `discount_total` NUMERIC(10,2).

**Item**: `name`, `price` NUMERIC(10,2), `discounted_price` NUMERIC(10,2) (computed on save), `category` (→ Category, optional), `ticket` (→ Ticket), `position` (display order).

**Allocation**: `item` (→ Item), `member` (→ FamilyMember). One row per member per item. Cost per member = `item.discounted_price / count(allocations for that item)`.

**FamilyMember**: `name`, `is_active`. Soft delete only.

**Category**: `name`, `color` (hex).

## API Surface (backend)

```
POST   /auth/login
GET    /members           POST /members
PUT    /members/{id}      DELETE /members/{id}          # soft delete
GET    /categories        POST /categories
PUT    /categories/{id}   DELETE /categories/{id}
POST   /tickets/upload    # multipart, runs OCR, returns draft — does NOT save
POST   /tickets           # save confirmed ticket with items + allocations
GET    /tickets           # paginated, filterable by date range / member / category
GET    /tickets/{id}
PUT    /tickets/{id}
DELETE /tickets/{id}
PUT    /items/{id}
PUT    /items/{id}/allocations   # replace allocation list for one item
GET    /balances?from=&to=
GET    /reports/summary?from=&to=
GET    /reports/itemized?from=&to=&member_id=
GET    /reports/categories?from=&to=
```

## OCR Service

- Send image to `gpt-4o` vision API with a prompt that instructs it to return **only** this JSON (no markdown, no preamble):
```json
{
  "store_name": "string",
  "purchased_at": "ISO8601 datetime or null",
  "items": [{"name": "string", "price": 0.00}],
  "discount_total": 0.00,
  "total_price": 0.00
}
```
- For PDFs, convert the first page to an image with `pdf2image` before sending.
- This draft is returned to the frontend for user review. Nothing is persisted until the user confirms.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend language | Python 3.12 |
| Backend framework | FastAPI |
| ORM | SQLAlchemy 2.x async |
| Migrations | Alembic |
| Database | PostgreSQL 16 |
| Auth | JWT (HS256), bcrypt for password hashing |
| AI/OCR | OpenAI gpt-4o vision (python SDK v1.x) |
| Backend tests | pytest, pytest-asyncio, httpx, pytest-cov (≥80%) |
| Frontend framework | React 18 + TypeScript strict |
| Styling | Tailwind CSS + HeroUI |
| State/data | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| i18n | i18next (en, ru, pt) |
| Frontend tests | Vitest + React Testing Library + MSW |
| Infra | Docker Compose (db, backend, frontend) |

## UI Structure

- `/login` — login form
- `/` — dashboard: summary cards, recent tickets, quick balance snapshot
- `/tickets` — paginated list with filters
- `/tickets/new` — 4-step wizard: Upload → Review & Edit → Allocate → Confirm
- `/tickets/:id` — ticket detail with edit capability
- `/members` — member management
- `/categories` — category management with colour picker
- `/reports` — tabbed: Summary | Itemized | Categories
- `/balances` — pairwise net balances with date range filter

## Visual Identity

- App name: **Portuguese Drunk Sailors**
- Colour palette: Portuguese flag green (#006600), red (#FF0000), gold accent (#FFD700), warm off-white surface (#FAFAF5)
- Language switcher in navbar: EN 🇬🇧 / RU 🇷🇺 / PT 🇵🇹
- All UI strings internationalised — no hardcoded labels in JSX

## Success Criteria

- `docker compose up --build` starts the app with no manual steps beyond `.env` setup
- Uploading a receipt photo extracts items correctly and presents them for editing
- Allocating items to members produces correct per-member costs including proportional discounts
- Balance screen correctly shows net pairwise amounts across multiple tickets with different payers
- Reports filter correctly by custom date range
- `pytest --cov=app --cov-fail-under=80` passes
- All three locales render without missing translation keys

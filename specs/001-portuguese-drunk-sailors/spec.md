# Feature Specification: Portuguese Drunk Sailors

**Feature Branch**: `001-portuguese-drunk-sailors`
**Created**: 2026-05-27
**Status**: Draft
**Input**: User description: "Build Portuguese Drunk Sailors — a family expense tracking and cost allocation web application for 8 family members (6 adults, 2 children)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Receipt Capture & OCR Review (Priority: P1)

A user photographs or uploads a receipt after a shopping trip. The app automatically extracts
store name, date, item names, prices, and any discount total. The user reviews the extracted
data in an editable table, corrects any OCR mistakes, and selects which family member paid
the bill before proceeding.

**Why this priority**: This is the entry point for all data. Without receipt capture there are
no tickets, no balances, and no reports. Everything else depends on it.

**Independent Test**: A user can upload a receipt image, see extracted items in an editable
table, correct a name/price, choose the payer, and reach the allocation step — without any
reporting or balance logic being required.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the new ticket page, **When** they upload a JPEG photo of a
   receipt, **Then** the app displays a prefilled table with store name, date, item names, and
   prices extracted from the image — ready for editing.
2. **Given** the extracted item table is displayed, **When** the user changes an item name or
   price, **Then** the change is reflected immediately in the review table and in the live
   cost summary.
3. **Given** a PDF receipt is uploaded, **When** the extraction completes, **Then** the same
   editable table is shown (PDF first-page converted to image internally).
4. **Given** the review table is shown, **When** the user selects the paying family member
   from a dropdown, **Then** that member is marked as payer and the selection persists to
   the confirmation step.
5. **Given** an upload of a file that is not JPEG/PNG/WEBP/PDF or exceeds 10 MB,
   **When** the user attempts to submit, **Then** the app rejects the file with a clear
   error message before any processing occurs.

---

### User Story 2 — Cost Allocation Per Item (Priority: P2)

After reviewing extracted items, the user allocates each item to one or more family members
using a multi-select chip interface. Shared items (water, bread) can be assigned to all members
with a single shortcut. A live per-member cost summary updates as allocations change, letting
the user verify the split before confirming.

**Why this priority**: Allocation is the core value proposition — without it the app cannot
answer "who owes whom". Balances and reports both derive from allocation data.

**Independent Test**: Given a ticket with items already in review, a user can allocate each
item to specific members, use "select all" on a shared item, observe the live summary update,
and confirm the ticket — resulting in saved allocations and correct per-member costs including
proportional discount distribution.

**Acceptance Scenarios**:

1. **Given** the allocation step of the wizard, **When** the user selects two members for an
   item priced at €10.00 with no discount, **Then** the live summary shows €5.00 for each
   selected member for that item.
2. **Given** an item in the allocation step, **When** the user clicks "select all members",
   **Then** all 8 family members are selected for that item in one action.
3. **Given** a ticket with a €5.00 discount on a €50.00 subtotal containing two items of
   equal price, **When** the user confirms, **Then** each item's discounted price is
   `item_price − (item_price / 50.00) × 5.00` and allocations use the discounted price.
4. **Given** the confirmation step, **When** the user submits, **Then** the ticket, all items,
   and all allocations are persisted atomically; the draft is discarded.
5. **Given** the allocation step, **When** no members are selected for at least one item,
   **Then** the user cannot proceed to confirmation and sees a validation message.

---

### User Story 3 — Balance Tracking (Priority: P3)

The balance screen shows pairwise net amounts across all confirmed tickets, e.g. "Alice owes
Bob €23.50". If both Alice and Bob owe each other, the display shows only the net direction.
The user can filter balances by a custom date range.

**Why this priority**: Balances are the primary financial output of the app. They answer the
core question of who owes whom and are required for the family to settle up.

**Independent Test**: With at least two tickets confirmed (different payers, different
allocations), the balance screen correctly shows net pairwise amounts and correctly adjusts
when a date filter excludes one of the tickets.

**Acceptance Scenarios**:

1. **Given** ticket A where Alice paid €30 and Bob consumed €30, and ticket B where Bob paid
   €10 and Alice consumed €10, **When** the balance screen loads with no date filter,
   **Then** it shows "Alice owes Bob €20" (net of 30 − 10).
2. **Given** the balance screen, **When** the user applies a date range that includes only
   ticket A, **Then** the screen shows "Alice owes Bob €30".
3. **Given** no tickets exist, **When** the balance screen loads, **Then** it shows an empty
   state with a prompt to add tickets.

---

### User Story 4 — Reporting (Priority: P4)

The reports section provides three views: (a) total cost per family member for a date range,
(b) itemized view of everything a specific member consumed grouped by ticket, and (c) spending
by category shown as a pie chart and table. All views filter by a custom date range.

**Why this priority**: Reports provide insight and accountability but are not required for the
core spend-tracking loop.

**Independent Test**: With confirmed tickets across two months, the summary report for a
single-month filter shows correct per-member totals; the itemized report for a selected member
lists only their consumed items; the category report shows correct breakdown.

**Acceptance Scenarios**:

1. **Given** confirmed tickets in May and June, **When** the user selects the summary report
   for May only, **Then** totals reflect only May consumption per member.
2. **Given** member "Alice" allocated to three items across two tickets, **When** the user
   views the itemized report for Alice, **Then** both tickets appear as groups, each listing
   Alice's items with their discounted prices.
3. **Given** items tagged with categories, **When** the user views the categories report,
   **Then** a pie chart and table show each category's share of total spend for the period.

---

### User Story 5 — Reference Data Management (Priority: P5)

Users can manage the list of family members (add, rename, deactivate) and spending categories
(add, rename, delete with guard). Deactivated members no longer appear in allocation selectors
but remain on historical records. Categories cannot be deleted while items reference them.

**Why this priority**: Reference data must be set up before tickets can be entered and must be
maintainable over time, but initial setup is a one-time task.

**Independent Test**: A user can add a new member, allocate an item to them, deactivate them,
confirm they no longer appear in new allocation selectors, and confirm their past allocations
remain intact.

**Acceptance Scenarios**:

1. **Given** the members page, **When** the user adds a new member, **Then** the member
   appears in allocation selectors for all subsequent tickets.
2. **Given** an active member, **When** the user deactivates them, **Then** they no longer
   appear in the allocation chip interface for new tickets, but their name still appears in
   historical allocation records.
3. **Given** a category referenced by one or more items, **When** the user attempts to delete
   it, **Then** the deletion is blocked and the user sees an error explaining why.
4. **Given** the categories page, **When** the user adds a category with a chosen hex colour,
   **Then** that colour is used in the category reports pie chart.

---

### User Story 6 — Authentication (Priority: P6)

Two pre-configured users can log in with username and password. A JWT is returned on success.
All application routes except the login page require a valid JWT. Both users have full
permissions. There is no self-service registration.

**Why this priority**: Authentication is a prerequisite for all other stories but is a
minimal, pre-seeded setup rather than a user-facing feature.

**Independent Test**: A pre-configured user can log in, receive a token, access a protected
route, and be redirected to login when the token is absent or invalid.

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** the user submits the login form, **Then** they are
   redirected to the dashboard and hold a valid session token.
2. **Given** invalid credentials, **When** the user submits the login form, **Then** an error
   message is shown and no token is issued.
3. **Given** a user with no token attempts to access `/tickets`, **When** the request is
   made, **Then** they are redirected to `/login`.

---

### Edge Cases

- What happens when the OCR service is unavailable or returns malformed JSON?
  → The upload step shows a user-friendly error; no draft is created; the user can retry.
- What happens when all items on a ticket are allocated to zero members?
  → Confirmation is blocked; the user must allocate at least one member per item.
- What happens when a discount exceeds the ticket subtotal?
  → The item discounted prices floor at €0.00; no negative item prices are stored.
- What happens when a family member is deactivated mid-wizard (concurrent session)?
  → The wizard retains the member selection for that session; the ticket saves normally.
- What happens when the uploaded file is valid type but the image is unreadable (blank page)?
  → OCR returns empty items list; the user sees an empty editable table and can enter items
  manually before confirming.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept JPEG, PNG, WEBP, and PDF uploads up to 10 MB and reject
  all other types and sizes before processing.
- **FR-002**: The system MUST send the uploaded image to an external vision API and return a
  structured draft (store name, date, items with prices, discount total) for user review.
- **FR-003**: The system MUST present extracted receipt data in a fully editable table before
  any data is persisted.
- **FR-004**: Users MUST be able to assign any active family member as the ticket payer.
- **FR-005**: Users MUST be able to allocate each item to one or more active family members
  via a multi-select interface.
- **FR-006**: The system MUST provide a "select all active members" shortcut per item.
- **FR-007**: The system MUST display a live per-member cost summary that updates as
  allocations change, before the ticket is confirmed.
- **FR-008**: The system MUST compute each item's discounted price using the formula:
  `item_discounted_price = item_price − (item_price / ticket_subtotal) × ticket_discount_total`
  and store the result on save.
- **FR-009**: The system MUST persist ticket, items, and allocations atomically on confirmation.
- **FR-010**: The balance screen MUST show pairwise net amounts across all confirmed tickets
  or filtered by a date range.
- **FR-011**: Balances MUST be net: if A owes B €30 and B owes A €10, the display shows
  "A owes B €20".
- **FR-012**: The summary report MUST show total cost per family member for a chosen date range.
- **FR-013**: The itemized report MUST show every item consumed by a selected member, grouped
  by ticket, for a chosen date range.
- **FR-014**: The category report MUST show spending by category as a pie chart and table for
  a chosen date range.
- **FR-015**: Users MUST be able to add, rename, and deactivate family members. Deactivated
  members MUST remain on historical records.
- **FR-016**: Users MUST be able to add, rename, and delete categories. Deletion MUST be
  blocked if any item references the category.
- **FR-017**: Two application users MUST be pre-configured from environment variables. There
  is no self-service registration.
- **FR-018**: All routes except the login endpoint MUST require a valid session token.
- **FR-019**: All list views MUST be paginated (default 20 items, max 100).
- **FR-020**: Ticket list filtering (date range, member, category) MUST be applied at the
  database level, not in application memory.
- **FR-021**: All user-facing text MUST be available in English, Russian, and Portuguese;
  locale is switchable via a navbar control.

### Key Entities

- **Ticket**: Represents one shopping trip. Attributes: store name, purchase date/time,
  payer (→ FamilyMember), receipt image URL, total price, discount total.
- **Item**: One line on a receipt. Attributes: name, original price, discounted price
  (computed), category (optional → Category), position (display order), parent ticket.
- **Allocation**: Links one item to one family member. Many-to-many through this join entity.
  Cost per member = `item.discounted_price ÷ number of allocations for that item`.
- **FamilyMember**: A person who can pay for or consume items. Attributes: name, active flag
  (soft-delete only).
- **Category**: A spending category with a display colour (hex). Used to tag items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload a receipt photo and see extracted items ready for editing
  within 15 seconds of upload completion under normal network conditions.
- **SC-002**: Confirming a ticket with 20 items allocated across 8 members completes and
  persists within 3 seconds.
- **SC-003**: The balance screen loads and displays correct net pairwise amounts for a
  dataset of 500 tickets within 2 seconds.
- **SC-004**: All three locales (English, Russian, Portuguese) render with zero missing
  translation keys in a full UI walkthrough.
- **SC-005**: The automated test suite achieves ≥ 80% line coverage on the backend and
  passes without real external API calls.
- **SC-006**: The entire application starts from a clean environment using a single command
  (no manual setup beyond providing environment credentials).
- **SC-007**: Proportional discount allocation produces results accurate to two decimal
  places (euro-cent precision) across all tested receipt configurations.

## Assumptions

- The 8 family members (6 adults, 2 children) are managed in the app, not derived from
  authentication users. There are only 2 login accounts; all 8 members exist as data.
- "Children" members are treated identically to adult members in cost allocation — no
  reduced-share rules are required.
- The OCR step is always followed by a mandatory human review; the system never
  auto-confirms a ticket from OCR output.
- Image storage for raw receipts is handled via a filesystem or object-store path; the
  exact storage backend is an infrastructure concern not specified here.
- Default categories (Wine, Meals, Entertainment, Gifts, Parking, Other) are seeded on
  first run; users may edit them freely thereafter.
- Currency is always euros; no multi-currency support is required.
- The application is used by a small trusted group; no rate limiting or abuse-prevention
  beyond standard authentication is required for v1.
- Mobile camera upload is handled by the browser's native file picker on mobile devices;
  no native mobile app is required.

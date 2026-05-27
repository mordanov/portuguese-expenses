# Architecture Review: Portuguese Drunk Sailors

**Task**: T007 | **Reviewer**: Software Architect Agent | **Date**: 2026-05-27
**Artifacts reviewed**: `plan.md`, `contracts/api.md`, `data-model.md`, `research.md`, `quickstart.md`, `spec.md`, `security-review.md`
**Status**: APPROVED WITH FINDINGS — all blockers are missing specifications or clarifications required before implementation; no design-level defects found.

---

## Verdict

The overall architecture is **sound and implementable**. Layer separation is well-defined (router → service → repository), the data model is coherent, and the API contracts are comprehensive for the primary flows. The constitution compliance check has zero violations.

The findings below are **not defects in the design** — they are gaps or ambiguities in the contracts and task specifications that must be resolved before agents implement them. Resolving these now is cheaper than correcting agent output after the fact.

---

## Findings

### GAP-001 — `PUT /tickets/{id}` recalculation contract underspecified

**Severity**: High (blocks T082 / T092)

**Location**: `contracts/api.md` — `PUT /tickets/{id}`

**Issue**: The contract states "Recalculates `discounted_price` for all items." However, it does not specify:
1. Whether existing item `price` values are used, or whether the request body can override item prices.
2. Whether existing allocations are preserved, replaced, or invalidated on ticket header update.
3. Whether `total_price` in the request body is the new authoritative value or recomputed from items.

The `PUT /tickets/{id}` request schema says "Same schema as `POST /tickets` but all fields optional", which implies the body CAN include `items` with new prices. But if it can, can it also include `member_ids`? Is it a full replace or a partial patch?

**Risk**: Backend and frontend agents will make conflicting assumptions. Cost summaries and balance data could diverge from user expectations.

**Recommended clarification** (choose one and document in `contracts/api.md`):
- **Option A** (recommended): `PUT /tickets/{id}` updates header fields only (store_name, purchased_at, paid_by_id, total_price, discount_total). Item edits go through `PUT /items/{id}`. Allocation changes go through `PUT /items/{id}/allocations`. This is cleaner and already reflected in T084.
- **Option B**: Full ticket replace — includes items and allocations. Requires clear cascade semantics.

**Action required**: PM/SA to clarify and update `contracts/api.md` before T082 is assigned.

---

### GAP-002 — Raw image upload and `raw_image_url` lifecycle missing

**Severity**: High (blocks T068, T079, Phase 8)

**Location**: `contracts/api.md` — `POST /tickets/upload`; `data-model.md` — `tickets.raw_image_url`; `research.md` — "File Upload Storage"

**Issue**: The upload flow is documented (draft returned, not persisted), but the lifecycle of the actual file is never closed:
1. `POST /tickets/upload` accepts a file and returns an `OCRDraft`. Does the backend save the file during this call, or not?
2. If not saved at upload time: `POST /tickets` has `"raw_image_url": "string | null"`. Where does this URL come from? The client cannot generate it; the server must.
3. If saved at upload time: there must be a separate upload endpoint that returns a URL, and that URL is passed in `POST /tickets`. This is a different flow from what is documented.
4. Orphan file cleanup: if the user uploads a file but abandons the wizard, the file on disk is never referenced by any ticket. What is the cleanup policy?

**Risk**: The `raw_image_url` field appears in `POST /tickets` request but there is no documented mechanism to produce it. Backend agents will have to guess.

**Recommended approach**: Document one of these flows explicitly:
- **Option A** (simplest): `POST /tickets/upload` saves the file to `UPLOAD_DIR` using a UUID filename, includes `raw_image_url` in the `OCRDraft` response. Client passes it back in `POST /tickets`. Orphan cleanup via cron or startup sweep.
- **Option B**: `raw_image_url` is optional (`null` if wizard skips file step). No file saving at upload time. Image is not retained.

**Action required**: Update `contracts/api.md` to define where `raw_image_url` comes from and document the orphan cleanup policy. Update `data-model.md` and `ocr_service.py` task (T068) accordingly. Note: security-review.md B-01 (UUID filename) and U-07 (no persistence before confirmation) must be reconciled with whichever option is chosen.

---

### GAP-003 — Pagination contract inconsistency on `GET /members`

**Severity**: Medium (blocks T057, T058)

**Location**: `contracts/api.md` — `GET /members`

**Issue**: `GET /members` uses `?active_only=true` as a filter but returns a paginated envelope. However, FR-019 specifies `?page=1&page_size=20` as the pagination interface. The `GET /members` response shape in the contract shows `"page": 1, "page_size": 20` in the response, which is correct.

The inconsistency: `GET /members` is documented as `?active_only=true` (no `page`/`page_size` params shown in the examples). Similarly `GET /categories` shows no pagination query params. Yet the response envelopes include `total`, `page`, `page_size`.

If `active_only` is the only query param and pagination is also supported, the contract must show both: `?active_only=true&page=1&page_size=20`.

**Risk**: Frontend agent will not know to pass pagination params on member/category endpoints. Backend agent may not implement pagination for these endpoints.

**Action required**: Update `contracts/api.md` for `GET /members` and `GET /categories` to explicitly list `page` and `page_size` as supported query params alongside their domain-specific filters.

---

### GAP-004 — Balance formula denominator not defined in API contract

**Severity**: Medium (blocks T093, T097)

**Location**: `contracts/api.md` — `GET /balances`; `research.md` — "Pairwise Balance Algorithm"

**Issue**: The `BalanceEntry` in the API contract shows `"amount": "20.00"` with no explanation of the sign convention or rounding. The `research.md` pairwise algorithm is clear (two-pass CTE, show only positive direction), but the API contract for `GET /balances` does not reference `research.md` and does not state:
1. What currency precision is used (`NUMERIC(10,2)` → always 2 decimal places).
2. Whether the `as_of` timestamp is the request timestamp or the most recent ticket's `purchased_at`.
3. Whether a row `{debtor: Alice, creditor: Bob, amount: "0.00"}` is returned or omitted (contract says "only net-positive rows returned" — but "positive" means > 0, not ≥ 0).

The last point matters for the acceptance test in T097 ("zero-balance row omitted").

**Action required**: Update `contracts/api.md` `GET /balances` to:
- State that `as_of` is the UTC timestamp at time of the request.
- Confirm rows with `amount = "0.00"` are excluded.
- Reference `research.md` "Pairwise Balance Algorithm" for implementation.

---

### GAP-005 — `GET /tickets` filter by `member_id` semantics ambiguous

**Severity**: Medium (blocks T082, T085)

**Location**: `contracts/api.md` — `GET /tickets`

**Issue**: `member_id` filter on `GET /tickets` is documented as "filter tickets where member has at least one allocation". This is correct but the join path is non-trivial:
```
tickets → items → allocations → family_members
```
The word "allocation" here means the `allocations` table (join entity). The equivalent query requires a JOIN or EXISTS subquery through items. The contract does not mention whether this also includes tickets where the member is `paid_by_id`, or only tickets where they appear in allocations.

**Risk**: Backend agent may filter on `paid_by_id` only (simpler join) and miss allocation-based membership. Or may double-count tickets where member is both payer and allocatee.

**Action required**: Clarify in `contracts/api.md`: "Returns tickets where at least one `allocations` row for the ticket's items references `member_id`. Does NOT include tickets where the member is `paid_by_id` but has no item allocations."

---

### GAP-006 — `PUT /items/{id}` discount recalculation scope unclear

**Severity**: Medium (blocks T084)

**Location**: `contracts/api.md` — `PUT /items/{id}`

**Issue**: The contract states "Recalculates `discounted_price` for all items on the parent ticket." This means a `PUT /items/{id}` call must:
1. Fetch the parent ticket's `discount_total`.
2. Fetch ALL sibling items for the ticket.
3. Recompute `discounted_price` for every item using the updated item's new price.
4. Update ALL items in a single transaction.

This is a multi-row update inside a single item endpoint. The contract does not specify whether the response returns the full updated ticket or just the updated item. It currently says "Updated item object (same shape as items array in GET /tickets/{id})."

**Risk**: If the backend returns only the updated item but silently updates siblings, the frontend will show stale `discounted_price` values for the other items until the next full ticket reload.

**Action required**: Update `contracts/api.md` for `PUT /items/{id}` to clarify that after recalculation the response returns the full updated ticket (same as `GET /tickets/{id}`), OR add a note that the frontend must refetch the full ticket after any item update. The simpler choice is to return only the item and require frontend refetch.

---

### GAP-007 — Missing `GET /health` endpoint in API contract

**Severity**: Low (blocks T122)

**Location**: `contracts/api.md`

**Issue**: T122 defines a `GET /health` endpoint for Docker Compose health checks, but it does not appear in `contracts/api.md`. This is a platform-operational endpoint, not a business endpoint, but it should be documented to avoid confusion.

**Action required**: Add a brief entry to `contracts/api.md` under a "Health" or "Operational" section:
```
GET /health
Response 200: { "status": "ok" }
No auth required.
```

---

### GAP-008 — `raw_image_url` not in `POST /tickets/upload` response

**Severity**: Low (relates to GAP-002)

**Location**: `contracts/api.md` — `POST /tickets/upload` response schema

**Issue**: If the chosen resolution for GAP-002 is Option A (file saved at upload time, URL returned in OCRDraft), then the `OCRDraft` response schema must include a `raw_image_url` field. Currently it does not.

**Action required**: Resolve GAP-002 first; then update `OCRDraft` response schema accordingly.

---

### GAP-009 — `POST /tickets` response shape incomplete

**Severity**: Low (blocks T081)

**Location**: `contracts/api.md` — `POST /tickets` Response 201

**Issue**: The contract says "Full ticket schema — see GET /tickets/{id} for complete shape." This cross-reference is sufficient but informal. Agents may miss it.

**Action required**: No change required if agents can be directed to this note. Consider inline-duplicating the full response schema for explicit agent guidance.

---

## Layer Separation — No Violations Found

The following layer-separation checks were performed against `plan.md` and `tasks.md`:

| Check | Result |
|---|---|
| Routers contain no business logic | ✅ — routers call service methods only; tasks T043–T059 enforce this |
| Services contain all business logic | ✅ — discount computation in TicketService, balance in BalanceService |
| Repositories contain no business logic | ✅ — repositories are data-access only |
| Models contain no business logic | ✅ — entities are data containers; no methods |
| Schemas contain no business logic | ✅ — Pydantic request/response shapes only |
| JWT auth in dependencies.py only | ✅ — `get_current_user` Depends injection; no inline validation in routers |
| Async session in dependencies.py only | ✅ — `get_async_session` Depends injection |
| Alembic migrations only, no DDL | ✅ — constitution §III enforced |
| No floats for money | ✅ — NUMERIC(10,2) in DB, Decimal in Python, string in JSON |

---

## Data Model — No Violations Found

| Check | Result |
|---|---|
| All PKs are UUID | ✅ |
| All monetary columns are NUMERIC(10,2) | ✅ |
| Timestamps are TIMESTAMPTZ | ✅ |
| Soft delete for family_members | ✅ |
| Hard delete for tickets (with CASCADE) | ✅ |
| Category delete blocked at service layer | ✅ |
| Unique constraint on allocations (item_id, member_id) | ✅ |
| `discounted_price` computed on save, not stored as float | ✅ |
| `app_users` has no FK to family_members | ✅ |

---

## Constitution Compliance — No Violations

All items from the constitution check in `plan.md` remain valid. The architecture review does not introduce any new violations.

---

## Well-Architected Review Summary

| Pillar | Assessment |
|---|---|
| **Operational Excellence** | Alembic auto-migration on startup; Docker Compose single-command deploy; health check endpoint (T122); coverage gate ≥80% (T115). No gap. |
| **Security** | Full threat model in `security-review.md`; blockers B-01/B-02 defined with verification steps; RS256 JWT enforced; CORS locked; bcrypt passwords. Residual risks documented with owners. |
| **Reliability** | Atomic ticket save (single transaction); OCR service unavailability returns 503 with retry path; validation gates before persistence. |
| **Performance Efficiency** | DB-level filtering for all list endpoints; indexes on `purchased_at`, `paid_by_id`, `ticket_id`, `category_id`, `member_id`; balance CTE avoids in-memory aggregation. SC-003 (balance in 2s for 500 tickets) is achievable. |
| **Cost Optimization** | Household scale; minimal compute. No concerns. |
| **Maintainability** | Clear layer separation; constitution-enforced standards; typed Python + TypeScript strict; i18n from the start. |

---

## Action Items Summary

| ID | Priority | Assignee | Action |
|---|---|---|---|
| GAP-001 | High | PM/SA → BE | Clarify `PUT /tickets/{id}` semantics (header-only vs full replace); update `contracts/api.md` before T082 |
| GAP-002 | High | SA → BE, DO | Define `raw_image_url` lifecycle (Option A or B); update `contracts/api.md`, `data-model.md`, T068 description |
| GAP-003 | Medium | SA | Add `page`/`page_size` params to `GET /members` and `GET /categories` in `contracts/api.md` |
| GAP-004 | Medium | SA | Clarify `as_of` semantics and zero-row exclusion in `GET /balances`; cross-reference research.md |
| GAP-005 | Medium | SA | Clarify `member_id` filter join path in `GET /tickets` — allocation-join not payer-join |
| GAP-006 | Medium | SA | Clarify `PUT /items/{id}` response scope after sibling recalculation |
| GAP-007 | Low | SA | Add `GET /health` to `contracts/api.md` |
| GAP-008 | Low | SA | Update `OCRDraft` schema once GAP-002 is resolved |
| GAP-009 | Low | SA | Optional inline schema duplication for `POST /tickets` 201 response |

---

## Resolved in Review (No Action Needed)

- JWT algorithm: RS256 ✅ (research.md and constitution aligned)
- Decimal arithmetic: enforced at all layers ✅
- OCR mock in tests: explicit in constitution and tasks ✅
- Pagination default/max: FR-019 (default 20, max 100) ✅ — PM flagged this has no acceptance scenario; enforcement is router-layer responsibility
- CORS wildcard: forbidden, FRONTEND_URL env var enforced ✅
- Member deactivation: soft-delete only, historical allocations retained ✅
- Category delete guard: service-layer check, 409 response ✅
- Balance zero-row exclusion: research.md algorithm correct ✅ (GAP-004 clarifies the API contract wording only)

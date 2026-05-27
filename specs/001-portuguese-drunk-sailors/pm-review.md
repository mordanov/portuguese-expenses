# PM Review: Priority Confirmation & Acceptance Criteria Assessment

**Task**: T010 | **Agent**: product-manager | **Date**: 2026-05-27
**Input**: `specs/001-portuguese-drunk-sailors/spec.md`

---

## Priority Confirmation

| Story | Priority | Rationale | Status |
|-------|----------|-----------|--------|
| US6 — Authentication | P6 (build first) | Prerequisite for all routes; pre-seeded, not user-facing | ✅ CONFIRMED |
| US5 — Reference Data | P5 (build second) | Members + categories must exist before tickets can be entered | ✅ CONFIRMED |
| US1 — Receipt Capture & OCR | P1 | Entry point for all data; nothing else works without tickets | ✅ CONFIRMED |
| US2 — Cost Allocation | P2 | Core value proposition; balances and reports derive from allocations | ✅ CONFIRMED |
| US3 — Balance Tracking | P3 | Primary financial output once tickets exist | ✅ CONFIRMED |
| US4 — Reporting | P4 | Insight layer; valuable but not part of core spend-tracking loop | ✅ CONFIRMED |

**Build order** (priority → implementation dependency resolution): US6 → US5 → US1 → US2 → US3 → US4

**Note**: Priority labels (P1 highest, P6 lowest) describe feature importance to the user. Build order reverses this because US6 (auth) and US5 (reference data) are technical prerequisites for P1/P2.

---

## MVP Scope

**MVP = Phases 1–9** (US6 + US5 + US1 + US2): Authentication, reference data, OCR receipt capture, and full cost allocation wizard.

**MVP validation gate**: After Phase 9 completes, perform a full end-to-end smoke test:
1. Log in as pre-configured user
2. Upload a receipt photo → verify OCR draft appears
3. Edit an item name and price
4. Select payer
5. Allocate all items to family members (including one multi-member allocation)
6. Confirm ticket → verify persisted in DB with correct discounted prices
7. Verify allocation math: `item_discounted_price = item_price − (item_price / subtotal) × discount_total`

**Post-MVP** (Phases 10–14): Balance tracking (US3), reports (US4), quality gates, Docker delivery.

---

## Acceptance Criteria Completeness Assessment

### US1 — Receipt Capture & OCR Review

| FR | Covered by scenario | Assessment |
|----|---------------------|------------|
| FR-001 (file type + size gate) | Scenario 5 | ✅ COVERED |
| FR-002 (OCR → structured draft) | Scenario 1 | ✅ COVERED |
| FR-003 (editable table before persist) | Scenarios 1, 2 | ✅ COVERED |
| FR-004 (payer selection) | Scenario 4 | ✅ COVERED |
| PDF path | Scenario 3 | ✅ COVERED |
| OCR service unavailable | Edge case (documented) | ✅ COVERED |

**Gap (non-blocking)**: No scenario explicitly tests that the payer selection persists through all 4 wizard steps. Scenario 4 only says "persists to confirmation step" — this is sufficient but agents should ensure ReviewStep passes payer to AllocateStep and ConfirmStep via wizard state, not just as a prop to ConfirmStep.

### US2 — Cost Allocation

| FR | Covered by scenario | Assessment |
|----|---------------------|------------|
| FR-005 (allocate each item to 1+ members) | Scenario 1 | ✅ COVERED |
| FR-006 (select-all shortcut) | Scenario 2 | ✅ COVERED |
| FR-007 (live cost summary) | Scenario 1 (live update implied) | ✅ COVERED |
| FR-008 (discount formula) | Scenario 3 (exact formula) | ✅ COVERED |
| FR-009 (atomic save) | Scenario 4 | ✅ COVERED |
| Zero-allocation validation | Scenario 5 | ✅ COVERED |
| Inactive member in member_ids | Edge case (T085 backend test) | ✅ COVERED |

**Formula precision**: Scenario 3 states: `item_price − (item_price / 50.00) × 5.00`. Agents must implement using Python `Decimal` with `ROUND_HALF_UP` rounding to 2 decimal places. See `research.md` for rounding strategy.

### US3 — Balance Tracking

| FR | Covered by scenario | Assessment |
|----|---------------------|------------|
| FR-010 (pairwise net balances) | Scenario 1 | ✅ COVERED |
| FR-011 (net direction) | Scenario 1 (€30 − €10 = €20) | ✅ COVERED |
| Date range filter | Scenario 2 | ✅ COVERED |
| Empty state | Scenario 3 | ✅ COVERED |

### US4 — Reporting

| FR | Covered by scenario | Assessment |
|----|---------------------|------------|
| FR-012 (summary per member) | Scenario 1 | ✅ COVERED |
| FR-013 (itemized by member + ticket) | Scenario 2 | ✅ COVERED |
| FR-014 (category pie chart + table) | Scenario 3 | ✅ COVERED |
| Date filtering | Scenarios 1, 2, 3 | ✅ COVERED |

**Gap (non-blocking)**: No scenario covers uncategorized items in the category report. Task T107 explicitly tests this, so it is handled — but a spec scenario would make the intent clearer for future maintainers.

### US5 — Reference Data Management

| FR | Covered by scenario | Assessment |
|----|---------------------|------------|
| FR-015 (add/rename/deactivate members) | Scenarios 1, 2 | ✅ COVERED |
| FR-015 (historical records intact) | Scenario 2 | ✅ COVERED |
| FR-016 (add/rename/delete categories) | Scenarios 3, 4 | ✅ COVERED |
| FR-016 (delete blocked when referenced) | Scenario 3 | ✅ COVERED |
| Category colour → pie chart | Scenario 4 | ✅ COVERED |

### US6 — Authentication

| FR | Covered by scenario | Assessment |
|----|---------------------|------------|
| FR-017 (pre-configured users, no registration) | Scenarios 1, 2 | ✅ COVERED |
| FR-018 (all routes require JWT) | Scenario 3 | ✅ COVERED |

---

## Cross-Cutting Requirements — Coverage Assessment

| FR | Story | Task coverage | Assessment |
|----|-------|---------------|------------|
| FR-019 (pagination default 20, max 100) | All list views | T082, T058, T059 (backend), T089 (FE) | ✅ Tasks cover it — **no user story scenario tests pagination limits explicitly** |
| FR-020 (DB-level filtering) | US2, US3, US4 | T082, T092 (CR), T103 | ✅ Code review gates enforce this |
| FR-021 (EN/RU/PT i18n) | All | T035, T114, T117 (autotester) | ✅ Covered by T117 locale completeness check |

**Pagination gap (flagged for agents)**: FR-019 requires default page size 20, max 100. No acceptance scenario validates this. Agents implementing list endpoints must enforce this at the router level (query param `page_size: int = 20, max=100`). Code reviewer (T032, T066, T082, T092) should verify this is enforced at the API layer, not left to clients.

---

## Success Criteria — Task Coverage

| SC | Covered by task | Assessment |
|----|-----------------|------------|
| SC-001 (OCR within 15s) | T068 (ocr_service timeout), T071 tests | ✅ COVERED |
| SC-002 (ticket confirm within 3s) | T079 atomic save, T085 tests | ✅ COVERED |
| SC-003 (balance load 500 tickets in 2s) | T093 CTE query + index design | ✅ COVERED |
| SC-004 (zero missing i18n keys) | T117 autotester locale check | ✅ COVERED |
| SC-005 (≥80% backend coverage, no live OCR) | T115 coverage gate | ✅ COVERED |
| SC-006 (single-command startup) | T121 Docker validation | ✅ COVERED |
| SC-007 (2-decimal discount accuracy) | T085, T107 Decimal tests | ✅ COVERED |

---

## Findings Summary

**Overall status**: CONFIRMED — priorities, MVP scope, and acceptance criteria are sound and complete for implementation to proceed.

**Agents must note**:
1. Build order is US6→US5→US1→US2 (reversed from priority labels — auth and reference data are prerequisites).
2. Pagination: FR-019 has no scenario — agents must enforce 20/100 limits at router layer without prompting.
3. Discount formula: Must use `Decimal`, never float. See `research.md` for rounding strategy.
4. Payer wizard state: Must flow through all 4 wizard steps in `ticketWizard.ts` store, not just to the last step.
5. Uncategorized items: Must be handled gracefully in category report (included under "Other" or "Uncategorized" label).

**No blockers.** All user stories have sufficient acceptance criteria for the team to implement and test independently.

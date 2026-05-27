# T116: Acceptance Scenario Verification Report

**Feature**: Portuguese Drunk Sailors  
**Date**: 2026-05-27  
**Agent**: autotester  
**Method**: Backend pytest suite (77 tests) + static frontend analysis  

## Quality Report

### Scope
US1–US6 acceptance scenarios from spec.md, verified against:
- Backend: `backend/tests/` — 77 automated tests, coverage 80.91%  
- Frontend: locale completeness scan, JSX hardcoded-string scan, TS type check

### Tests Run
77 backend tests across 11 test files. 1 warning (FastAPI deprecation, non-blocking).

### Passed
77 / 77

### Failed
0

### Flaky / Quarantined
None observed.

---

## US6 — Authentication

| Scenario | Test | Result |
|---|---|---|
| Valid credentials → 200 + token | `test_auth.py::test_login_success` | PASS |
| Invalid credentials → 401 | `test_auth.py::test_login_invalid_password` | PASS |
| Unauthenticated → 401 on protected routes | `test_auth.py::test_unauthenticated_request` | PASS |
| No registration endpoint | Verified by absence in routers | PASS |
| JWT is RS256 | conftest.py generates RS256 keys; `test_auth.py::test_token_payload` | PASS |

**US6 verdict**: PASS ✅

---

## US5 — Reference Data Management

| Scenario | Test | Result |
|---|---|---|
| Create member → appears in selectors | `test_members.py::test_create_member`, `test_deactivated_member_excluded_from_active_selectors` | PASS |
| Deactivate member → absent from active selectors | `test_members.py::test_deactivate_member`, `test_deactivated_member_excluded_from_active_selectors` | PASS |
| Deactivated member present in historical allocations | `test_members.py::test_deactivated_member_present_in_historical_allocation` (**T067**) | PASS |
| Inactive member rejected in new ticket | `test_members.py::test_inactive_member_rejected_in_new_ticket` (**T067**) | PASS |
| Category delete blocked when referenced | `test_categories.py::test_delete_referenced_category_blocked`, `test_category_deletion_blocked_when_item_references_it` (**T067**) | PASS |
| Unreferenced category deletable | `test_categories.py::test_delete_unreferenced_category`, `test_unreferenced_category_can_be_deleted` (**T067**) | PASS |
| Rename member | `test_members.py::test_rename_member` | PASS |
| Duplicate name → 409 | `test_members.py::test_duplicate_member_name`, `test_categories.py::test_duplicate_category_name` | PASS |
| Invalid color → 422 | `test_categories.py::test_invalid_color` | PASS |

**US5 verdict**: PASS ✅

---

## US1 — Receipt Capture & OCR Review

| Scenario | Test | Result |
|---|---|---|
| JPEG upload → OCRDraft returned (mocked OCR) | `test_tickets.py::test_upload_jpeg_mocked_ocr` | PASS |
| PDF upload → OCRDraft returned | `test_ocr_service.py::test_pdf_conversion_path` | PASS |
| Invalid file type (.exe) → 422 | `test_tickets.py::test_upload_exe_rejected` | PASS |
| Oversized file → 422 | `test_tickets.py::test_upload_oversized_rejected` | PASS |
| Malformed OCR JSON → OCRParseError | `test_ocr_service.py::test_malformed_json_raises_parse_error` | PASS |
| Unauthenticated upload → 401 | `test_tickets.py::test_upload_unauthenticated` | PASS |
| Nothing persisted before confirmation | Architecture: upload returns OCRDraft only; no DB write path in POST /tickets/upload | PASS |

**US1 verdict**: PASS ✅

---

## US2 — Cost Allocation

| Scenario | Test | Result |
|---|---|---|
| Proportional discount correct (Decimal, not float) | `test_tickets_extended.py::test_discount_proportional_distribution` | PASS |
| Empty member_ids → 422 | `test_tickets.py::test_empty_member_ids_rejected` | PASS |
| Inactive member in allocation → 422 | `test_members.py::test_inactive_member_rejected_in_new_ticket` | PASS |
| Atomic save (all-or-nothing) | `test_tickets_extended.py::test_atomic_save` | PASS |
| Ticket CRUD (GET/PUT/DELETE) | `test_tickets.py`, `test_tickets_extended.py` | PASS |
| Item allocation replace | `test_items.py` | PASS |

**US2 verdict**: PASS ✅

---

## US3 — Balance Tracking

| Scenario | Test | Result |
|---|---|---|
| Net balance: €30 A→B, €10 B→A → €20 net (T102) | `test_balances.py::test_t102_net_balance_two_tickets_exact_amount` | PASS |
| Zero-balance row omitted | `test_balances.py::test_t102_zero_balance_row_omitted`, `test_zero_balance_omitted` | PASS |
| Date range excludes older ticket | `test_balances.py::test_t102_date_range_excludes_older_ticket`, `test_date_range_filter` | PASS |
| No tickets → empty list | `test_balances.py::test_no_tickets_returns_empty` | PASS |

**US3 verdict**: PASS ✅

---

## US4 — Reporting

| Scenario | Test | Result |
|---|---|---|
| Summary report date-filtered | `test_reports.py::test_summary_report` | PASS |
| Category report | `test_reports.py::test_category_report` | PASS |
| Missing params → 422 | `test_reports.py::test_summary_missing_params`, `test_itemized_missing_member_id` | PASS |
| Itemized report | `test_report_service_direct.py` | PASS |
| Uncategorized items handled | Verified in category service code path | PASS |

**US4 verdict**: PASS ✅

---

## T117 — Locale Completeness

| Locale | Keys | Missing | Result |
|---|---|---|---|
| EN (reference) | 144 | — | PASS ✅ |
| RU | 144 | 0 | PASS ✅ |
| PT | 144 | 0 | PASS ✅ |

**Bug found and fixed**: `ConfirmStep.tsx:75` had hardcoded `<span>Discount</span>` instead of `{t('review.discount')}`, and used `parseFloat(...).toFixed(2)` instead of `MoneyDisplay`. Both corrected.

---

## Constitution Compliance Checks

| Check | Status |
|---|---|
| No floats for money (Python Decimal) | ✅ Verified in all service/repository tests |
| OCR always mocked in tests | ✅ All OCR tests use mock_ocr_client fixture |
| JWT RS256 | ✅ conftest.py generates RSA keys; auth tests verify algorithm |
| CORS locked to env var | ✅ No wildcard in main.py CORS config |
| Pagination on all list endpoints | ✅ Members, categories, tickets, balances all paginated |

---

## Untested Areas (T116 scope note)

- **Frontend UI flows** — T123 (Docker validation) is required to test end-to-end UI flows against a running stack. Frontend automated tests (Vitest/RTL) are scaffold-only (setup.ts present, test files not yet written by frontend agent).
- **Performance goals** — OCR draft within 15s, balance load within 2s for 500 tickets — not tested without live OpenAI and production DB.
- **Docker integration** — T123 pending Docker Compose stack availability.

---

## Defects Found

| ID | Severity | File | Description | Status |
|---|---|---|---|---|
| AT-001 | Minor | `frontend/src/components/tickets/ConfirmStep.tsx:75-76` | Hardcoded "Discount" string not using i18n; float arithmetic instead of MoneyDisplay | **FIXED** |

---

## Release Recommendation

**GO WITH RISKS** for backend MVP (US1–US6).  
**Blocker**: T123 (Docker end-to-end) must pass before final delivery sign-off.  
**Risk**: Frontend test coverage is minimal (scaffold only) — behaviour verified only via backend API tests and static analysis.

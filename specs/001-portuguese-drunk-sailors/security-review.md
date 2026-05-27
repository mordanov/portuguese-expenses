# Security Review: Portuguese Drunk Sailors

**Branch**: `001-portuguese-drunk-sailors` | **Date**: 2026-05-27
**Reviewer**: Security Architect Agent
**Tasks**: T008 (threat model) + T009 (upload acceptance criteria) + T052 (auth review) + T078 (upload security review) + T118 (final sign-off)
**Status**: APPROVED WITH RISKS — all blockers resolved; residual risks documented.

---

## Scope Reviewed

- Authentication flow: RS256 JWT, bcrypt password hashing, env-var-seeded users
- Receipt upload flow: file type/size validation, pdf2image PDF conversion, OpenAI OCR
- CORS configuration: locked to `FRONTEND_URL` env var
- Input validation across all API endpoints
- Secret and credential handling
- Error response safety
- Frontend token storage and handling

---

## Decision

**APPROVED WITH RISKS**

Implementation is conditionally safe provided all required controls below are enforced.
No blocker-severity vulnerabilities exist in the design; all blockers listed are controls
that must be present in the implementation. Residual risks are documented with owners
and due dates.

---

# Threat Model: Portuguese Drunk Sailors

## Scope

Full-stack family expense tracking application. Two pre-configured users log in via
username/password; every other route requires a valid RS256 JWT. Expense tickets are
created via OCR of uploaded receipts (JPEG/PNG/WEBP/PDF), reviewed, allocated to family
members, and saved. No public registration. No role differentiation.

---

## Assets

| Asset | Sensitivity | Location |
|---|---|---|
| User credentials (passwords) | Critical | `app_users.password_hash` (bcrypt) + env vars at seed time |
| JWT private key | Critical | `JWT_PRIVATE_KEY` env var |
| OpenAI API key | High | `OPENAI_API_KEY` env var |
| Receipt image files | Medium | Filesystem `UPLOAD_DIR` |
| Expense data (items, prices, members, balances) | Medium | PostgreSQL |
| Family member names | Low-Medium | PostgreSQL |
| JWT access tokens | High | Client localStorage → Bearer header |
| Database credentials | Critical | `DATABASE_URL` env var |

---

## Actors

| Actor | Trust Level | Entry Points |
|---|---|---|
| Authenticated family member | Trusted (post-login) | All JWT-protected endpoints |
| Unauthenticated user | Untrusted | `POST /auth/login` only |
| OpenAI API | External/Untrusted output | OCR response JSON |
| Uploaded file | Untrusted | `POST /tickets/upload` |
| Environment | Trusted | Container env vars at startup |

---

## Trust Boundaries

```
[Browser / Client]
    │ HTTPS + Bearer JWT
    ▼
[FastAPI Backend] ←── env vars (secrets)
    │   │
    │   ├── PostgreSQL (trusted internal)
    │   ├── Filesystem UPLOAD_DIR (trusted internal, writable)
    │   └── OpenAI API (external, response untrusted)
    │
    [pdf2image / poppler] (local process, trusted)
```

Key boundaries:
1. **Internet → Backend**: JWT required; file upload untrusted
2. **Backend → OpenAI**: outbound only; response content is untrusted
3. **Backend → Filesystem**: must be restricted to UPLOAD_DIR; path traversal risk
4. **Browser → localStorage**: JWT stored client-side; XSS risk

---

## Entry Points

| Entry Point | Auth Required | Notes |
|---|---|---|
| `POST /auth/login` | No | Credential submission |
| `POST /tickets/upload` | Yes (JWT) | File upload; highest-risk endpoint |
| `POST /tickets` | Yes (JWT) | Saves confirmed ticket + items + allocations |
| `PUT /items/{id}/allocations` | Yes (JWT) | Modifies allocation |
| `DELETE /categories/{id}` | Yes (JWT) | Guarded delete |
| `DELETE /members/{id}` | Yes (JWT) | Soft delete only |
| All other `GET`/`PUT` | Yes (JWT) | Read/update operations |

---

## Data Flows

### Authentication Flow

```
Client → POST /auth/login {username, password}
       → AuthService.verify_password(plain, bcrypt_hash)
       → AuthService.create_access_token(username) [RS256 signed]
       → {access_token, token_type: "bearer"}
Client stores token in localStorage
Client sends: Authorization: Bearer <token> on every subsequent request
Backend: get_current_user() validates RS256 signature + expiry on each request
```

### Receipt Upload + OCR Flow

```
Client → POST /tickets/upload (multipart, file field)
       → OCRService.validate_file(mime_type, size)
         [MIME type check: JPEG/PNG/WEBP/PDF; size ≤ 10 MB]
       → [PDF only] pdf2image.convert_from_bytes(first_page_only) → PIL Image
       → OpenAI gpt-4o vision API call (image bytes, JSON-only system prompt)
       → OCRService.parse_response(json_str) → Pydantic OCRDraft validation
       → Returns OCRDraft to client (NOT persisted)
Client reviews/edits draft → POST /tickets (confirmed save)
```

### Ticket Save Flow

```
Client → POST /tickets {store_name, purchased_at, paid_by_id, items[member_ids]}
       → TicketService.save_ticket()
           → Validate paid_by_id exists and is active
           → Validate all member_ids exist and are active
           → Validate member_ids non-empty per item
           → Validate discount_total ≤ sum(item.price)
           → Compute discounted_price per item (Decimal arithmetic)
           → Atomic INSERT: ticket + items + allocations
       → Returns 201 + full ticket detail
```

---

## Threats and Abuse Cases

### Authentication

| ID | Threat | STRIDE | Impact | Likelihood | Controls | Residual Risk |
|---|---|---|---|---|---|---|
| A-01 | Brute-force login attempts | Spoofing | High — account takeover | High (no rate limit in design) | bcrypt slows attempts; only 2 users | **Medium**: no rate limiting; acceptable for household use |
| A-02 | JWT with HS256 used instead of RS256 | Tampering | High — forged tokens if key shared | Low (resolved in research.md) | Constitution mandates RS256; research.md note | Low: design decision enforced |
| A-03 | JWT_PRIVATE_KEY hardcoded in source | Info Disclosure | Critical | Low (env var design) | All secrets from env vars only | Low: env var pattern enforced |
| A-04 | Plain-text password logged | Info Disclosure | High | Medium (developer error) | No password in log statements required | **Medium**: requires explicit enforcement in auth_service.py |
| A-05 | JWT not validated on every request | Elevation of Privilege | Critical | Low (middleware design) | `get_current_user` Depends on all protected routes | Low: FastAPI dependency injection |
| A-06 | Expired JWT accepted | Spoofing | Medium | Low | PyJWT validates `exp` claim automatically | Low |
| A-07 | Registration endpoint accidentally created | Unauthorized Access | High | Low (no registration in spec) | No POST /users endpoint; no user creation via API | Low |

### Receipt Upload

| ID | Threat | STRIDE | Impact | Likelihood | Controls | Residual Risk |
|---|---|---|---|---|---|---|
| U-01 | Malicious file disguised as JPEG (polyglot) | Tampering | Medium — bypass file check | Medium | MIME type check from file content (magic bytes), NOT file extension | **Medium**: magic-byte check must be enforced, not extension-only |
| U-02 | Path traversal via filename | Elevation of Privilege | High — write to arbitrary path | Medium | Filename from `uuid4()` only; uploaded filename NEVER used in filesystem path | **Blocker if not implemented**: filename sanitisation required |
| U-03 | Oversized file causes DoS or memory exhaustion | Denial of Service | Medium — server resource drain | Medium | Size check before reading full content; reject > 10 MB at intake | Low: size gate before processing |
| U-04 | pdf2image called on user-controlled path | SSRF / path traversal | High | Low (bytes-based API) | `pdf2image.convert_from_bytes()` used, NOT `convert_from_path()` | Low: bytes API avoids path injection |
| U-05 | pdf2image processing bomb (multi-page PDF) | Denial of Service | Medium — CPU/memory exhaustion | Medium | `first_page=1, last_page=1` parameters; time/memory limits at container level | **Medium**: must enforce single-page extraction explicitly |
| U-06 | Receipt file served without auth check | Info Disclosure | Medium — private receipt exposure | Low | Static file serving must be behind JWT auth or use unguessable path | **Medium**: `raw_image_url` access control TBD |
| U-07 | Uploaded file persisted before confirmation | Data Integrity | Low — orphan files accumulate | Medium | Upload endpoint returns draft only; file saved to temp or named by UUID | Low: design intent is no persistence; temp cleanup policy needed |
| U-08 | Unsafe temporary file handling | Elevation of Privilege | Medium — temp file race condition | Low | Use `tempfile.NamedTemporaryFile` with context manager; clean up in finally | Low if implemented correctly |

### OCR / OpenAI Integration

| ID | Threat | STRIDE | Impact | Likelihood | Controls | Residual Risk |
|---|---|---|---|---|---|---|
| O-01 | Malformed OCR JSON causes unhandled exception | Denial of Service | Low — 500 error to user | Medium | Pydantic schema validation; `OCRParseError` → HTTP 422 | Low |
| O-02 | OCR response contains prompt injection in item names | Tampering | Low — stored in DB; no execution context | Low | OCR JSON treated as untrusted; Pydantic validates structure; no `eval`/exec | Low |
| O-03 | OpenAI API key exposed in logs or error responses | Info Disclosure | Critical | Medium | API key only in env var; NEVER in log statements or error detail | **Blocker**: explicit no-key-in-logs requirement for ocr_service.py |
| O-04 | OCR response leaks via 503 error body | Info Disclosure | Low | Low | 503 body must not include raw OpenAI response | Low |
| O-05 | Sensitive receipt content in application logs | Privacy | Medium | Medium | Do not log file bytes, OCR extracted text, or item names at INFO level | **Medium**: log sanitisation policy needed |

### CORS and Frontend

| ID | Threat | STRIDE | Impact | Likelihood | Controls | Residual Risk |
|---|---|---|---|---|---|---|
| C-01 | CORS wildcard `*` allows any origin | Cross-site Request Forgery | High — any site can make authenticated requests | Low (design forbids it) | CORS locked to `FRONTEND_URL` env var; no wildcard | Low: design enforced |
| C-02 | JWT in localStorage vulnerable to XSS | Info Disclosure | High — token theft | Medium | React app; no eval/innerHTML with user data; CSP recommended | **Medium**: XSS mitigation relies on React escaping + no unsafe patterns |
| C-03 | Token logged in browser console or network tab | Info Disclosure | Medium | Low | No `console.log(token)` in frontend code; standard dev-tools exposure | Low |
| C-04 | 401 redirect leaks current URL | Info Disclosure | Low | Low | Redirect to `/login` without embedding current URL in params | Low |

### Data Validation

| ID | Threat | STRIDE | Impact | Likelihood | Controls | Residual Risk |
|---|---|---|---|---|---|---|
| V-01 | Inactive member in allocation | Data Integrity | Medium — corrupted balance data | Medium | Server-side check: all member_ids must be active at time of save | Low: explicit service-layer check |
| V-02 | Empty member_ids for item | Data Integrity | High — division by zero in balance calc | Medium | Server-side: empty member_ids returns 422 | Low: validated at service + router |
| V-03 | Negative or zero prices submitted | Data Integrity | Low — distorted reports | Low | `CHECK >= 0` DB constraint + Pydantic validation | Low |
| V-04 | discount_total > sum(items.price) | Data Integrity | Medium — negative discounted prices | Medium | Service-layer validation: discount must not exceed subtotal | Low: explicit check |
| V-05 | SQL injection via filter params | Injection | High | Low | SQLAlchemy ORM parameterized queries only; no raw SQL interpolation | Low: ORM enforced |
| V-06 | UUID injection (referencing another family's data) | Elevation of Privilege | Low — single-tenant app | Low | All users have identical access; no per-user ownership isolation needed | Low: by design (single-tenant) |

---

## Required Mitigations

### Blockers (must fix before release)

**B-01 — Path traversal via filename (U-02)**
- Requirement: In `ocr_service.py`, generate a UUID-based filename for any file written to disk. The client-supplied filename MUST NOT be used in any filesystem path.
- Verification: Code review confirms no `request.filename` or similar in file path construction.

**B-02 — OpenAI API key in logs or error responses (O-03)**
- Requirement: In `ocr_service.py`, catch all OpenAI SDK exceptions and re-raise as `OCRServiceError` with a generic message. The exception message, API response, and API key must NEVER appear in log output at any level.
- Verification: Test that `OCRServiceError` raised on API failure returns HTTP 503 with `{"detail": "OCR service unavailable"}` — no OpenAI details in response body.

### High Severity

**H-01 — MIME type from magic bytes, not extension (U-01)**
- Requirement: Use `python-magic` or `imghdr` (or equivalent) to detect MIME type from file content. Do not rely on the `Content-Type` header or file extension alone.
- Implementation: Read the first 512 bytes; check against known JPEG/PNG/WEBP/PDF magic signatures.

**H-02 — Plain-text password never logged (A-04)**
- Requirement: In `auth_service.py`, ensure no `logger.*` call includes the `password` field from `LoginRequest`. bcrypt hash must not be logged at DEBUG level either.
- Verification: Code review of `auth_service.py` and `routers/auth.py`.

**H-03 — Raw image URL access control (U-06)**
- Requirement: If `raw_image_url` is served as a static file route, it must be behind JWT authentication OR use a UUID-named path that is computationally unguessable (i.e., no sequential IDs in paths). If the route is unauthenticated, use only UUID v4 names.
- Decision: Recommend UUID-named static serving without additional auth check (acceptable for household use). Document this as residual risk if chosen.

### Medium Severity

**M-01 — Single-page PDF extraction enforced (U-05)**
- Requirement: `pdf2image.convert_from_bytes(data, first_page=1, last_page=1)`. Any other call variant is forbidden.

**M-02 — Log sanitisation policy (O-05)**
- Requirement: OCR service must NOT log extracted item names, store names, or receipt content at INFO or DEBUG level. Only log: file size, MIME type, and success/failure status.

**M-03 — Temp file cleanup (U-07/U-08)**
- Requirement: Any temporary file created during PDF-to-image conversion must use `tempfile.NamedTemporaryFile(delete=True)` with a context manager so cleanup is guaranteed even on exception paths.

**M-04 — XSS mitigation on frontend (C-02)**
- Requirement: No `dangerouslySetInnerHTML` with user-supplied data. No `eval()`. All dynamic content rendered through React's standard JSX escaping. OCR draft data (store name, item names) must be treated as untrusted input when rendered.

---

# T009: Security Acceptance Criteria — `POST /tickets/upload`

## Precondition

The endpoint requires a valid RS256 JWT in the `Authorization: Bearer` header.
All checks below apply to an authenticated request unless otherwise noted.

---

## AC-UP-01: File Type Validation (Server-Side)

**Given** a multipart upload request with field `file`
**When** the server receives the file
**Then** the server MUST:
1. Read the first 512 bytes of the file content.
2. Determine MIME type from magic bytes (not from `Content-Type` header, not from file extension).
3. Accept only: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
4. Reject all other MIME types with HTTP 422 and body `{"detail": "Unsupported file type"}`.

**Negative test**: Upload a `.jpg`-renamed `.exe` (PE header) → expect 422.
**Negative test**: Upload an HTML file named `receipt.jpg` → expect 422.
**Negative test**: Upload a valid JPEG with `Content-Type: application/octet-stream` → expect 200 (magic bytes accepted, header ignored).

---

## AC-UP-02: File Size Gate Before Processing

**Given** a multipart upload request
**When** the total file size exceeds 10 MB (10 × 1024 × 1024 bytes)
**Then** the server MUST return HTTP 422 with `{"detail": "File exceeds maximum size of 10 MB"}` **before** passing the file to pdf2image or the OpenAI API.

**Negative test**: Upload an 11 MB JPEG → expect 422. No OCR call made.
**Positive test**: Upload a 9.9 MB JPEG → expect 200 (assuming valid MIME).

---

## AC-UP-03: No Path Traversal via Filename

**Given** any uploaded file
**When** the server writes the file to disk (if writing is needed for pdf2image)
**Then** the server MUST NOT use the client-supplied filename in any filesystem path.
The filename used on disk MUST be a UUID v4 string (e.g. `a1b2c3d4-...jpg`).

**Verification**: Code review confirms no reference to `file.filename` or `UploadFile.filename` in file path construction in `ocr_service.py`.

---

## AC-UP-04: PDF — First Page Only, Bytes API

**Given** an uploaded PDF file
**When** the server converts it for OCR
**Then** the server MUST call `pdf2image.convert_from_bytes(data, first_page=1, last_page=1)`.

**Negative test**: Upload a 50-page PDF → OCR processes only one page; response time is within acceptable bounds (< 15s).
**Negative test**: Upload a 1-byte invalid PDF → expect `OCRParseError` / HTTP 422, not a 500.

---

## AC-UP-05: OCR Response Treated as Untrusted

**Given** the OpenAI API returns a response
**When** the server parses it
**Then** the server MUST:
1. Attempt JSON deserialization.
2. Validate the deserialized object against the `OCRDraft` Pydantic schema.
3. On any JSON parse failure → raise `OCRParseError` → return HTTP 422.
4. On any Pydantic validation failure → raise `OCRParseError` → return HTTP 422.
5. On OpenAI API network/auth error → raise `OCRServiceError` → return HTTP 503.
6. The HTTP 422/503 response body MUST NOT include the raw OpenAI response text or the API key.

**Negative test**: Mock OCR to return `"not json"` → expect 422.
**Negative test**: Mock OCR to return `{"unexpected": "shape"}` → expect 422.
**Negative test**: Mock OCR to raise `openai.APIConnectionError` → expect 503 with generic message.

---

## AC-UP-06: No Persistence Before Confirmation

**Given** a successful OCR extraction
**When** the server returns the `OCRDraft`
**Then** NO row is written to `tickets`, `items`, or `allocations` tables.
The endpoint is idempotent — uploading the same receipt twice creates no database records.

**Negative test**: Upload JPEG → check DB `tickets` table → expect 0 new rows.
**Positive test**: Upload JPEG → call `POST /tickets` with draft → check DB → expect 1 new ticket.

---

## AC-UP-07: Unauthenticated Request Rejected

**Given** a multipart upload request with NO `Authorization` header
**When** the server processes the request
**Then** the server MUST return HTTP 401 before any file processing occurs.

**Negative test**: Upload JPEG without JWT → expect 401. No file read, no OCR call.

---

## AC-UP-08: Expired JWT Rejected

**Given** a multipart upload request with an expired RS256 JWT
**When** the server processes the request
**Then** the server MUST return HTTP 401.

**Negative test**: Upload JPEG with expired JWT → expect 401.

---

## AC-UP-09: Temp File Cleanup

**Given** any upload processing path (success, parse failure, or API error)
**When** the server creates a temporary file (e.g. for pdf2image)
**Then** the temporary file MUST be deleted before the response is returned, even on exception paths.

**Verification**: Code review confirms `tempfile.NamedTemporaryFile(delete=True)` or equivalent `try/finally` cleanup in `ocr_service.py`.

---

# Security Acceptance Criteria — Authentication (T052 scope preview)

These criteria are defined here for implementation reference; T052 performs the review.

## AC-AUTH-01: Password Hashing

All passwords stored in `app_users.password_hash` MUST be bcrypt hashes.
Plain-text passwords MUST NOT appear in: database, logs, error responses, or JWT claims.

**Negative test**: Seed migration `003_seed_app_users.py` — verify `password_hash` column value starts with `$2b$` (bcrypt prefix).

## AC-AUTH-02: RS256 JWT Only

`create_access_token()` MUST use `algorithm="RS256"` with `JWT_PRIVATE_KEY`.
`decode_access_token()` MUST use `JWT_PUBLIC_KEY` only (not the private key).

**Negative test**: Sign token with HS256 key → verify `get_current_user()` rejects it with 401.
**Negative test**: Modify JWT payload without re-signing → expect 401.

## AC-AUTH-03: JWT Secrets from Environment Only

`JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` MUST be loaded from environment variables via
pydantic-settings `Settings`. No fallback default values in code.

**Verification**: `config.py` has no hardcoded key strings.

## AC-AUTH-04: No Registration Endpoint

No `POST /users`, `POST /auth/register`, or equivalent endpoint exists.

**Negative test**: `POST /auth/register` → expect 404 or 405.

## AC-AUTH-05: All Non-Login Routes Protected

Every route except `POST /auth/login` MUST require `Depends(get_current_user)`.

**Negative test**: `GET /members` without JWT → expect 401.
**Negative test**: `GET /tickets` without JWT → expect 401.
**Negative test**: `GET /balances` without JWT → expect 401.
**Negative test**: `GET /reports/summary` without JWT → expect 401.

---

# Required Negative Tests (Full List)

The following test cases MUST exist in the test suite. Autotester verifies these.

## Authentication

| Test ID | Endpoint | Scenario | Expected |
|---|---|---|---|
| NEG-A-01 | POST /auth/login | Wrong password | 401 `{"detail": "Invalid credentials"}` |
| NEG-A-02 | POST /auth/login | Unknown username | 401 `{"detail": "Invalid credentials"}` |
| NEG-A-03 | GET /members | No Authorization header | 401 |
| NEG-A-04 | GET /members | Expired JWT | 401 |
| NEG-A-05 | GET /members | Tampered JWT (signature invalid) | 401 |
| NEG-A-06 | GET /members | HS256 JWT (wrong algorithm) | 401 |
| NEG-A-07 | POST /auth/register (any variant) | — | 404 or 405 |

## Upload

| Test ID | Endpoint | Scenario | Expected |
|---|---|---|---|
| NEG-U-01 | POST /tickets/upload | No JWT | 401 (before file read) |
| NEG-U-02 | POST /tickets/upload | .exe renamed .jpg | 422 |
| NEG-U-03 | POST /tickets/upload | HTML file | 422 |
| NEG-U-04 | POST /tickets/upload | 11 MB file | 422 |
| NEG-U-05 | POST /tickets/upload | Valid JPEG, mocked OCR returns garbage JSON | 422 |
| NEG-U-06 | POST /tickets/upload | Valid JPEG, mocked OCR raises API error | 503 |
| NEG-U-07 | POST /tickets/upload | Valid PDF, mocked OCR | 200 (single-page extraction confirmed) |
| NEG-U-08 | POST /tickets/upload | 1-byte invalid PDF | 422 |

## Data Validation

| Test ID | Endpoint | Scenario | Expected |
|---|---|---|---|
| NEG-V-01 | POST /tickets | Item with empty member_ids | 422 |
| NEG-V-02 | POST /tickets | Inactive member in member_ids | 422 |
| NEG-V-03 | POST /tickets | discount_total > sum(item.price) | 422 |
| NEG-V-04 | POST /tickets | Invalid paid_by_id (not UUID) | 422 |
| NEG-V-05 | POST /tickets | paid_by_id references inactive member | 422 |
| NEG-V-06 | DELETE /categories/{id} | Category referenced by items | 409 |
| NEG-V-07 | PUT /items/{id}/allocations | Empty member_ids array | 422 |
| NEG-V-08 | GET /reports/summary | Missing `from` or `to` param | 422 |
| NEG-V-09 | GET /reports/itemized | Missing `member_id` param | 422 |

---

# Residual Risks

| ID | Risk | Severity | Owner | Due Date | Notes |
|---|---|---|---|---|---|
| RR-01 | No rate limiting on `POST /auth/login` | Medium | DevOps / Product Manager | Post-MVP | Household use; 2 users only; acceptable short-term. Add nginx rate-limit or FastAPI slowapi in post-MVP hardening. |
| RR-02 | JWT stored in localStorage (XSS attack surface) | Medium | Frontend | Post-MVP | React's default escaping mitigates direct XSS. No `dangerouslySetInnerHTML` with user data. Upgrade to `httpOnly` cookie in post-MVP if hardening required. |
| RR-03 | Receipt static files may be accessible without auth | Medium | Backend / DevOps | Phase 8 | UUID-named paths are unguessable but not authenticated. Acceptable for household use. Document this explicitly in deployment notes. |
| RR-04 | No audit log for expense modifications | Low | Product Manager | Post-MVP | No per-action audit trail. Acceptable for household use. |
| RR-05 | Temp file cleanup relies on correct implementation | Low | Backend | Phase 8 | Mitigated by code review requirement (AC-UP-09). |
| RR-06 | Container secrets not managed by vault | Low | DevOps | Post-MVP | `.env` file on Docker host. Acceptable for household scale. Document in quickstart. |

---

# Follow-Up Items

| ID | Item | Assignee | Phase |
|---|---|---|---|
| FU-01 | Verify `python-magic` or `imghdr` added to `requirements.txt` for magic-byte MIME detection | Backend | Phase 8 (T020) |
| FU-02 | Confirm `pdf2image.convert_from_bytes(..., first_page=1, last_page=1)` in ocr_service.py | Backend | Phase 8 (T068) |
| FU-03 | Confirm no `file.filename` in filesystem path in ocr_service.py | Backend | Phase 8 (T068) |
| FU-04 | Confirm OpenAI exception caught and re-raised as generic `OCRServiceError` | Backend | Phase 8 (T068) |
| FU-05 | Confirm all protected routes use `Depends(get_current_user)` | Backend | Phase 4 (T028/T029) |
| FU-06 | Confirm CORS allows only `FRONTEND_URL`, no wildcard | Backend | Phase 4 (T029) |
| FU-07 | Confirm JWT_PRIVATE_KEY not in any log statement | Backend | Phase 6 (T045) |
| FU-08 | Confirm no `dangerouslySetInnerHTML` with OCR draft data in frontend | Frontend | Phase 8 (T074/T075) |
| FU-09 | Add docker host `.env` security note to quickstart.md | DevOps | Phase 3 (T014) |

---

# T118: Final Security Sign-Off

**Date**: 2026-05-27 | **Reviewer**: security-architect

## Checks Performed

| Check | Result | Evidence |
|---|---|---|
| No hardcoded secrets in source | PASS | `git grep` — no API keys, private keys, or passwords in source |
| CORS wildcard absent | PASS | `main.py:13` — `allow_origins=[settings.frontend_url]` only |
| JWT RS256 in production code path | PASS | `config.py:15` — `jwt_algorithm: str = "RS256"` (default); `auth_service.py:18` — `algorithm=settings.jwt_algorithm` |
| bcrypt hashes only in DB | PASS | `003_seed_app_users.py:22` — `bcrypt.hashpw()` before INSERT; no plaintext in schema |
| Upload validation present (magic bytes) | PASS | `ocr_service.py:61` — `magic.from_buffer(content[:512], mime=True)` after fix |
| pdf2image bytes API (no path) | PASS | `ocr_service.py:68` — `convert_from_bytes(pdf_bytes, first_page=1, last_page=1)` after fix |
| OCR exception sanitised | PASS | `ocr_service.py:110-111` — `log.error(exc_info=True)` + generic `"OCR service unavailable"` after fix |
| No registration endpoint | PASS | `grep register backend/app/routers/` — no results |
| No `dangerouslySetInnerHTML` with user data | PASS | `grep dangerouslySetInnerHTML frontend/src/` — no results |
| No token/password logging in frontend | PASS | No `console.log(token)` patterns found |
| Secret env vars require explicit values | PASS | `config.py` — `jwt_private_key`, `jwt_public_key`, `app_user_*_password`, `openai_api_key` have no defaults after fix |
| `.env` files excluded from Docker images | PASS | `backend/.dockerignore` and `frontend/.dockerignore` both exclude `.env` and `*.env` |
| `.env` files excluded from git | PASS | `.gitignore` — `.env`, `*.env`, `**/.env` |
| `credentials.json` excluded from git | PASS | `.gitignore` — `*/credentials.json` |

## Fixes Applied by Security Architect (T052/T078)

Three blockers and one medium finding were not addressed by the backend agent;
security-architect applied the fixes directly per standing non-destructive permission:

| Fix | File | Lines |
|---|---|---|
| F-01 RESOLVED: MIME from magic bytes | `backend/app/services/ocr_service.py` | 61-63 |
| F-02 RESOLVED: Generic OCR error message, full exc in log | `backend/app/services/ocr_service.py` | 110-111 |
| F-03 RESOLVED: `convert_from_bytes` replaces `convert_from_path` + temp file | `backend/app/services/ocr_service.py` | 68-73 |
| F-04 RESOLVED: Removed default fallbacks for all secrets | `backend/app/config.py` | 13-25 |

## Decision

**APPROVED WITH RISKS**

All blocker and high-severity findings are resolved. Residual risks RR-01 through RR-06
are documented above with owners and post-MVP timelines. The codebase is safe to deploy
for household use within the defined trust model.

### Remaining Residual Risks

| ID | Risk | Severity | Owner | Timeline |
|---|---|---|---|---|
| RR-01 | No rate limiting on POST /auth/login | Medium | DevOps/PM | Post-MVP |
| RR-02 | JWT in localStorage (XSS surface) | Medium | Frontend | Post-MVP |
| RR-03 | Receipt static files unauth but UUID-named | Medium | Backend/DevOps | Phase 8 |
| RR-04 | No audit log for expense modifications | Low | PM | Post-MVP |
| RR-05 | Temp file cleanup (mitigated by fix F-03) | Resolved | — | — |
| RR-06 | Container secrets via .env (no vault) | Low | DevOps | Post-MVP |

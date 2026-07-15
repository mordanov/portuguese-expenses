# API Contracts: Multi-Project Support

**Branch**: `002-multi-project-support` | **Date**: 2026-07-15
**Base URL**: `http://localhost:8000`
**Auth**: Bearer JWT (RS256) — all endpoints except `POST /auth/login` and
  `GET /projects/public-list` require a valid token.
**Project scope**: All scoped endpoints derive the active `project_id` from the JWT.
  Requests targeting a project the JWT does not belong to return 403.

This document covers **new and changed endpoints only**. Unchanged endpoints from
`specs/001-portuguese-drunk-sailors/contracts/api.md` remain in force unless explicitly
superseded here.

---

## Authentication (changes)

### `POST /auth/login` (modified)

Added optional `project_id` field for admin users.

**Request**:
```json
{
  "username": "string",
  "password": "string",
  "project_id": "uuid (optional, ignored for role=user accounts)"
}
```

**Response 200**:
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "role": "admin | user",
  "project_id": "uuid | null"
}
```

---

### `POST /auth/switch-project` *(new, admin only)*

Issue a new JWT scoped to a different project without re-authenticating.

**Request**:
```json
{ "project_id": "uuid" }
```

**Response 200**:
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "role": "admin",
  "project_id": "uuid"
}
```

**Response 403**: `{ "detail": "Admin role required" }`
**Response 404**: `{ "detail": "Project not found" }`

---

## Projects

### `GET /projects/public-list` *(new, no auth)*

Returns minimal project info for the login screen chooser.

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "bg_color": "#RRGGBB",
      "status": "open | closed"
    }
  ]
}
```

---

### `GET /projects` *(new, admin only)*

Full project list with all attributes.

**Response 200**:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "default_language": "pt",
      "bg_color": "#006600",
      "text_color": "#FFFFFF",
      "accent_color": "#FFD700",
      "status": "open",
      "created_at": "ISO8601"
    }
  ],
  "total": 2
}
```

---

### `POST /projects` *(new, admin only)*

Create a new project.

**Request**:
```json
{
  "name": "string",
  "default_language": "fr",
  "bg_color": "#003189",
  "text_color": "#FFFFFF",
  "accent_color": "#ED2939"
}
```

**Response 201**: Full project object (same schema as GET item).
**Response 409**: `{ "detail": "Project name already exists" }`

---

### `PUT /projects/{id}` *(new, admin only)*

Update project name, language, or colour scheme. All fields optional.

**Request** (all optional):
```json
{
  "name": "string",
  "default_language": "string",
  "bg_color": "#RRGGBB",
  "text_color": "#RRGGBB",
  "accent_color": "#RRGGBB"
}
```

**Response 200**: Updated project object.
**Response 404**: `{ "detail": "Project not found" }`

---

### `POST /projects/{id}/close` *(new, admin only)*

Close a project (makes it read-only).

**Response 200**: `{ "id": "uuid", "status": "closed" }`
**Response 404**: `{ "detail": "Project not found" }`
**Response 409**: `{ "detail": "Project already closed" }`

---

### `POST /projects/{id}/reopen` *(new, admin only)*

Re-open a closed project.

**Response 200**: `{ "id": "uuid", "status": "open" }`
**Response 404**: `{ "detail": "Project not found" }`
**Response 409**: `{ "detail": "Project already open" }`

---

### `POST /projects/suggest-colors` *(new, admin only)*

Request LLM-generated colour palette for a project name.

**Request**:
```json
{ "query": "France" }
```

**Response 200**:
```json
{
  "bg_color": "#003189",
  "text_color": "#FFFFFF",
  "accent_color": "#ED2939"
}
```

**Response 503**: `{ "detail": "Color suggestion service unavailable" }`

---

## Project Members

### `GET /projects/{id}/members` *(new, admin only)*

List members currently linked to the project.

**Response 200**:
```json
{
  "items": [
    { "id": "uuid", "name": "string", "is_active": true, "joined_at": "ISO8601" }
  ],
  "total": 8
}
```

---

### `POST /projects/{id}/members` *(new, admin only)*

Add an existing family member to the project.

**Request**:
```json
{ "member_id": "uuid" }
```

**Response 201**: `{ "member_id": "uuid", "project_id": "uuid", "joined_at": "ISO8601" }`
**Response 404**: `{ "detail": "Member not found" }`
**Response 409**: `{ "detail": "Member already in project" }`
**Response 403**: `{ "detail": "Project is closed" }`

---

### `DELETE /projects/{id}/members/{member_id}` *(new, admin only)*

Remove a member from the project. Historical allocations are preserved.

**Response 204**: No body.
**Response 404**: `{ "detail": "Member not in project" }`
**Response 403**: `{ "detail": "Project is closed" }`

---

## Changed Scoped Endpoints

All existing endpoints below now derive `project_id` implicitly from the JWT.
No URL changes. Queries are filtered to the active project.

| Endpoint group       | Change                                                        |
|----------------------|---------------------------------------------------------------|
| `GET /tickets`       | Implicit `WHERE project_id = :jwt_project_id`                 |
| `POST /tickets/...`  | `project_id` set from JWT; 403 if project is closed           |
| `GET /members`       | Returns only members linked to active project via join table  |
| `GET /categories`    | Implicit `WHERE project_id = :jwt_project_id`                 |
| `POST /categories`   | `project_id` set from JWT; 403 if project is closed           |
| `GET /balances`      | Scoped to active project tickets                              |
| `GET /reports/*`     | Scoped to active project tickets                              |

---

## Error Codes (additions)

| Code | Meaning                                          |
|------|--------------------------------------------------|
| 403  | Project is closed (write attempted on closed project) |
| 403  | Admin role required (non-admin on admin-only endpoint) |
| 503  | LLM colour suggestion service unavailable        |

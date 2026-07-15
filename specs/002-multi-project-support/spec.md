# Feature Specification: Multi-Project Support

**Feature Branch**: `002-multi-project-support`
**Created**: 2026-07-15
**Status**: Draft
**Input**: User description: "Turn portuguese-expenses into a multi-project expenses accounting app. Introduce a Project entity and link all current entities to it. Migration creates 'Portugal-2026' and links all existing data. UI exposes project colour scheme, LLM-suggested colours, and per-project ticket language."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Creates a New Project (Priority: P1)

An admin user opens the project management screen, clicks "New Project", types a name
(e.g., "France-2026"), optionally requests LLM-suggested colours for the name, reviews the
palette, adjusts it if desired, sets the default ticket language, and saves. The new project
immediately appears in the project chooser on the login screen.

**Why this priority**: Project creation is the entry point for all other multi-project work.
Without a project, no data can be scoped correctly.

**Independent Test**: An admin can create a project, observe LLM-suggested colours applied to
the UI shell, and confirm the project appears in the chooser — without touching any tickets
or members.

**Acceptance Scenarios**:

1. **Given** an admin on the "New Project" form, **When** they type "France" and click
   "Suggest colours", **Then** the system returns a palette (background colour, text colour,
   accent colour) appropriate for the query within 5 seconds.
2. **Given** a project name and valid colour values, **When** the admin saves, **Then** the
   project is persisted with the chosen palette and default ticket language.
3. **Given** a newly created project, **When** an admin opens the project chooser on the
   login screen, **Then** the new project appears in the list alongside existing projects.
4. **Given** a project creation form, **When** the admin saves without requesting colour
   suggestions, **Then** the project is saved with a sensible default palette.
5. **Given** a project name field, **When** the admin attempts to save with an empty name,
   **Then** the form is rejected with a validation message.

---

### User Story 2 — Admin Manages Project Members (Priority: P2)

An admin assigns one or more family members to a project and assigns the "user" role to
particular app accounts, linking each non-admin account to exactly one project. Members
who are not linked to a project are invisible in that project's allocation selectors.

**Why this priority**: Access control and per-project member visibility must be established
before non-admin users can work within a project.

**Independent Test**: An admin can link a family member and a non-admin app account to a
project; the non-admin user then logs in and sees only that project's data.

**Acceptance Scenarios**:

1. **Given** an existing family member and a project, **When** an admin links the member to
   the project, **Then** that member appears in the allocation selectors for tickets within
   that project.
2. **Given** a non-admin app account, **When** an admin sets their project to "France-2026",
   **Then** that user can only view and create tickets belonging to "France-2026".
3. **Given** a non-admin user whose account has no project assigned, **When** they attempt
   to log in, **Then** they see a clear message that no project is assigned yet.

---

### User Story 3 — Project-Scoped Ticket Entry (Priority: P3)

When a user enters a new ticket, it is automatically scoped to their current project. The
OCR and ticket language are set from the project's default language. Admins working in the
project chooser context create tickets within the selected project.

**Why this priority**: Tickets are the primary data entry point and must carry correct
project context to keep data isolated across projects.

**Independent Test**: A user creates a ticket; the system records it under the active project
and uses the project's default language for OCR recognition, producing correct extractions.

**Acceptance Scenarios**:

1. **Given** a non-admin user logged into "France-2026", **When** they upload a receipt,
   **Then** the OCR request includes the project's default language (e.g., French) as context.
2. **Given** a ticket created by a "France-2026" user, **When** an admin views the ticket
   list filtered by "Portugal-2026", **Then** the "France-2026" ticket does not appear.
3. **Given** an admin who has selected "Portugal-2026" in the project chooser, **When** they
   create a ticket, **Then** the ticket is recorded under "Portugal-2026".

---

### User Story 4 — Admin Switches Between Projects (Priority: P4)

After login the admin sees a project chooser. They select a project and the entire app
(ticket list, balances, reports, member selectors) refreshes to show only data for that
project. The active project is indicated in the navigation bar. The admin can switch projects
at any time without logging out.

**Why this priority**: Admins need to operate across all projects; a seamless project context
switch is essential for day-to-day use.

**Independent Test**: An admin can switch from "Portugal-2026" to "France-2026" and confirm
that only France tickets, balances, and members are displayed; switching back shows Portugal
data.

**Acceptance Scenarios**:

1. **Given** an admin on the login screen, **When** they select a project from the chooser
   and log in, **Then** all views (tickets, balances, reports) display only that project's
   data.
2. **Given** a logged-in admin, **When** they select a different project from the navbar
   chooser, **Then** the page reloads within the new project context without requiring
   re-authentication.
3. **Given** an admin who switched projects, **When** they navigate to balances, **Then**
   balances reflect only the currently active project's tickets.

---

### User Story 5 — Project Colour Scheme Applied to UI (Priority: P5)

When a user is active in a project, the application shell (navbar, header, accent colours)
reflects the project's configured colour scheme. Switching projects updates the colour scheme
immediately.

**Why this priority**: Visual differentiation reduces the risk of accidentally entering data
into the wrong project.

**Independent Test**: With two projects configured with different palettes, switching between
them should visually update the app shell to the correct palette in under one second.

**Acceptance Scenarios**:

1. **Given** "Portugal-2026" configured with a green/red palette and "France-2026" with
   blue/white/red, **When** an admin switches to "France-2026", **Then** the navbar and
   header switch to the France palette immediately.
2. **Given** a project with a custom text colour, **When** the project is active, **Then**
   all navigation text uses the configured text colour.

---

### User Story 6 — Data Migration to Portugal-2026 (Priority: P6)

A one-time migration creates the "Portugal-2026" project with Portuguese as the default
ticket language and links all existing tickets, items, allocations, categories, and family
members to it. All existing non-admin app accounts are linked to "Portugal-2026". After
migration the application behaves as if it was always multi-project, with zero data loss.

**Why this priority**: The existing dataset must be preserved and correctly attributed before
any new project can be introduced.

**Independent Test**: After running the migration, querying tickets filtered to
"Portugal-2026" returns all previously existing tickets; querying any other project returns
nothing; all non-admin users can still access their data.

**Acceptance Scenarios**:

1. **Given** the migration has run, **When** an admin filters the ticket list to
   "Portugal-2026", **Then** all pre-migration tickets appear.
2. **Given** the migration has run, **When** a non-admin user logs in, **Then** they are
   automatically scoped to "Portugal-2026" and see their previous data.
3. **Given** the migration has run, **When** an admin inspects family members for
   "Portugal-2026", **Then** all pre-migration family members are linked to it.

---

### Edge Cases

- What happens when an admin attempts to delete a project that still has tickets?
  → Deletion is blocked; the admin must reassign or archive the project.
- What happens when the LLM colour suggestion service is unavailable?
  → A default neutral palette is applied; the admin can enter colours manually.
- What happens when a non-admin user's linked project is deleted?
  → The user account is locked out with a clear "no active project" message until an
  admin reassigns them.
- What happens when the same family member name exists in two projects?
  → Family members are project-scoped; duplicate names across projects are allowed.
- What happens when the admin creates a project with a colour contrast ratio that fails
  accessibility guidelines?
  → A visible warning is shown, but saving is not blocked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST introduce a `Project` entity with attributes: name (unique),
  default ticket language, background colour, text colour, accent colour, and creation date.
- **FR-002**: All `Ticket`, `Item`, `Allocation`, `FamilyMember`, and `Category` records
  MUST be linked to exactly one `Project`.
- **FR-003**: Each `AppUser` MUST carry a role (`admin` or `user`) and, if role is `user`,
  MUST be linked to exactly one `Project`.
- **FR-004**: Admin users MUST be able to access all projects via a project chooser on the
  login screen and via a navbar switcher once authenticated.
- **FR-005**: Non-admin users MUST be scoped to their assigned project automatically; they
  MUST NOT be able to view or modify data belonging to other projects.
- **FR-006**: Admins MUST be able to create, rename, and configure the colour scheme of a
  project through a project management UI.
- **FR-007**: The system MUST offer an LLM-powered colour suggestion endpoint: given a
  project name string, it returns a suggested background colour, text colour, and accent
  colour.
- **FR-008**: The project's default ticket language MUST be passed to the OCR service as
  context when processing uploads within that project.
- **FR-009**: The application shell (navbar, header) MUST apply the active project's colour
  scheme; switching projects MUST update the palette without page reload.
- **FR-010**: The migration MUST create a `Portugal-2026` project with `pt` as the default
  ticket language and link all existing `Ticket`, `Item`, `Allocation`, `FamilyMember`, and
  `Category` records to it via an Alembic migration.
- **FR-011**: The migration MUST link all existing `AppUser` records with role `user` to the
  `Portugal-2026` project.
- **FR-012**: All list and reporting queries MUST be filtered by the active project at the
  database level.
- **FR-013**: Admins MUST be able to assign a family member to a project and link a `user`
  role app account to a project.
- **FR-014**: Project deletion MUST be blocked while the project contains any tickets.
- **FR-015**: The project chooser on the login screen MUST display project name and apply the
  project's background colour as a visual cue.

### Key Entities

- **Project**: Represents one trip or expense-tracking context. Attributes: id (UUID), name
  (unique string), default_language (IETF language tag, e.g. `pt`, `fr`), bg_color (hex),
  text_color (hex), accent_color (hex), created_at.
- **AppUser** (updated): Gains `role` (`admin` | `user`) and nullable `project_id` FK
  (required when role = `user`).
- **FamilyMember** (updated): Gains `project_id` FK — scoped to exactly one project.
- **Category** (updated): Gains `project_id` FK — scoped to exactly one project.
- **Ticket** (updated): Gains `project_id` FK.
- **Item / Allocation**: Inherit project scope transitively through their parent Ticket and
  Item respectively; no direct `project_id` column needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a new project, receive LLM colour suggestions, and have
  the project ready for ticket entry within 2 minutes of starting the form.
- **SC-002**: The colour suggestion call returns a palette within 5 seconds under normal
  conditions.
- **SC-003**: Switching the active project updates the full UI context (data + colour scheme)
  within 1 second on the client.
- **SC-004**: After migration, 100% of pre-migration tickets, members, and categories are
  accessible within "Portugal-2026" with zero data loss.
- **SC-005**: All project-scoped queries return only data belonging to the active project —
  zero cross-project data leakage in any view or report.
- **SC-006**: A non-admin user's login-to-data flow requires zero extra steps compared to the
  pre-multi-project experience (they are auto-scoped).
- **SC-007**: The migration completes and leaves the database in a consistent state with no
  orphaned records.

## Assumptions

- The number of projects is small (single digits); no pagination of the project list is
  required for v1.
- Currency remains euros for all projects; multi-currency is out of scope.
- A family member belongs to exactly one project; cross-project member sharing is out of
  scope for v1.
- Categories are project-scoped; default categories are seeded per project on creation.
- The LLM colour suggestion is a best-effort feature; the UI must remain fully functional
  without it.
- The Alembic migration is the only sanctioned method for adding the `project_id` columns
  and back-filling the Portugal-2026 project; no manual SQL is allowed.
- Existing admin accounts retain admin role after migration; the migration does not
  downgrade any account.
- The IETF language tag stored in `default_language` is passed verbatim to the OCR prompt
  as a language hint; the OCR service interprets it.
- Project colour values are stored as 6-digit hex strings (e.g., `#3A7D44`); no opacity
  or CSS variable abstractions are required at the data layer.

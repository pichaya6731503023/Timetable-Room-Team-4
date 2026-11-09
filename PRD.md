# Product Requirements Document (PRD)

## 1. Product Overview

### Product Name
Identity & Academic Core - Timetable & Room (Team 4)

### Problem Statement
Students and staff do not have a reliable central system to view personal timetables and room availability status. Room and time allocation is still done manually (using spreadsheets or legacy tools). Students have to arrange their own schedules, which leads to problems such as duplicate room bookings, unnoticed schedule conflicts, and schedule changes not being communicated to other systems in a timely manner.

### Target Users
There are only 2 main groups:
- **Student** — views personal timetable and checks room usage schedules (read-only)
- **Staff (Room Planner)** — allocates class sections to rooms and time slots, and resolves schedule conflicts (read and write)

**Agreement:** This MVP version will not include an instructor role or Admin/Super-admin permissions.

### Product Goal
To give students a single, accurate system for viewing their weekly class schedule, and to help staff prevent duplicate room bookings or time conflicts in advance, by shifting from spreadsheet-based checking to an automatic conflict-detection system (with AI assistance for suggesting alternatives).

## 2. Scope

### In Scope
- Screens: My Timetable (Student), Room Schedule (Student/Staff), Room Management System for Staff
- Core Entities: Meeting, Room, Timetable, Conflict
- Viewing personal timetables and room usage schedules
- Management of meetings (CRUD) by staff via API (POST, PATCH, DELETE /meetings)
- Retrieval of timetable and room data (GET /timetables/me, GET /rooms, GET /rooms/{id}/schedule)
- Schedule conflict and over-capacity detection system with preset configuration (POST /conflicts/check)
- AI-powered suggestion system for alternative available time slots, with a deterministic fallback system
- Receiving section and enrollment data via the idempotent `enrollment.changed` event from the registration system (Team 03 Enrollment), accepting duplicated events and event replays
- Sending `schedule.changed` events to the Notification Hub and Data & Analytics

### Out of Scope
- Multi-campus / multi-building structure
- Instructor-specific availability conditions
- Booking of additional equipment/resources in rooms
- Production-level connection to notification and analytics systems (the MVP version will use Mock/Log data only)
- Audit Trail history or summary reporting Dashboard
- User permissions beyond Student and Staff
- Native mobile applications (Web Responsive support only)
- Real-time simultaneous multi-user editing
- AI features more complex than suggesting alternative available time slots

## 3. User Roles

### Student
- Logs in to view a personal timetable automatically generated from registered courses
- Can view the usage schedule of various classrooms (read-only)
- Sees notifications if there is a time conflict in their own timetable
- Cannot create, edit, or delete meetings

### Staff (Room Planner)
- Must have the `room-planning` Identity permission in order to edit data
- Can view the usage schedule of all classrooms
- Creates, edits, and deletes meetings (room and time allocation)
- Runs the schedule conflict detection system (duplicate time / over capacity)
- Requests new available time slot suggestions when a conflict occurs

## 4. User Journey

### Student
1. Log in
2. View the personal timetable, which is displayed automatically
3. Check schedule conflict notifications (if any)
4. View classroom schedules for further planning

### Staff
1. Log in
2. Select to view classroom usage schedules
3. Create/edit meetings (assign course, room, and time)
4. The system validates the data → confirms success, or shows an error and rejects the save (with an option to request a new alternative time)

## 5. Functional Requirements (FR)

- **FR-01:** Students can access a personal timetable automatically composed from their registered courses.
- **FR-02:** Students can view the schedule of each classroom (read-only).
- **FR-03:** The system automatically notifies students of conflicting class times in their personal timetable.
- **FR-04:** Staff can create a meeting (matching a section + room + time slot).
- **FR-05:** Staff can change the room or time of an existing meeting.
- **FR-06:** Staff can delete a meeting.
- **FR-07:** The system must always check for time overlap and room capacity before saving. If a problem is found, it must block the save and provide a clear reason.
- **FR-08:** Staff can request a new available time slot suggestion when a conflict occurs.
- **FR-09:** The system receives section and enrollment data from an external system (Team 03 Enrollment) via the `enrollment.changed` event, processing incoming events idempotently to handle duplicate delivery and event replays safely.
- **FR-10:** The system must send a `schedule.changed` event every time a meeting is created/edited/deleted.
- **FR-11:** The system updates student enrollments, recalculates section enrolled counts, and re-checks for room capacity conflicts or student schedule clashes upon receiving enrollment change data.

## 6. Non-Functional Requirements (NFR)

- **NFR-01 Performance:** The main web pages must load at a usable speed on a free-tier computing infrastructure.
- **NFR-02 Security:** Permissions (Student/Staff) must be enforced at both the Security Rules level and the Cloud Functions level. Students cannot write data.
- **NFR-03 Capacity:** Must smoothly support a realistic amount of data (dozens of classrooms, hundreds of sections/meetings).
- **NFR-04 Cost:** Must operate entirely on free-tier services (deployment budget of 0 THB).

**Additional requirement:** Conflict detection rules must operate deterministically and must not rely solely on AI, and must include validation of basic data correctness (e.g., end time must be after start time).

## 7. Business Rules (BR)

- **BR-01:** The same classroom cannot have overlapping meetings at the same time (absolute conflict).
- **BR-02:** The number of students enrolled in a course must not exceed the capacity of the assigned classroom.
- **BR-03:** A student's timetable is based only on their registered courses and cannot be edited by the student.
- **BR-04:** The right to create/edit/delete meeting schedules belongs to staff only.
- **BR-05:** If the AI time-suggestion system is unavailable, the fallback system (Deterministic Scan) must take over immediately.
- **BR-06:** A `schedule.changed` event must be sent every time meeting data is successfully created, updated, or deleted.
- **BR-07:** The system must process `enrollment.changed` events idempotently. Receiving duplicate events or replaying past events must not cause duplicate enrollment records or corrupt section enrolled counts.

## 8. Data Model

Uses **Cloudflare D1 (Serverless Relational SQL / SQLite)** at the edge, offering strict relational integrity, foreign keys, ACID compliance, and zero cold starts:

- **Users** (`users`): stores `id` (PK), `name`, `email` (UNIQUE), `role` (student | staff), `created_at`
- **Courses** (`courses`): stores `id` (PK), `course_code` (UNIQUE), `course_name`, `department`, `credits`, `created_at`
- **Sections** (`sections`): stores `id` (PK), `course_id` (FK -> courses.id), `section_number`, `capacity`, `semester`, `academic_year`
- **Rooms** (`rooms`): stores `id` (PK), `name` (UNIQUE), `capacity`, `building`, `created_at`
- **Meetings** (`meetings`): stores `id` (PK), `section_id` (FK -> sections.id), `room_id` (FK -> rooms.id), `day_of_week`, `start_time`, `end_time`, `status`, `created_by` (FK -> users.id), `created_at`, `updated_at`
- **Enrollments** (`enrollments`): stores `id` (PK), `student_id` (FK -> users.id), `section_id` (FK -> sections.id), `status`, `enrolled_at`

**Note:** Conflict data will not be stored statically in the database, but will instead be validated via deterministic SQL queries and Worker transactions at the time of saving to prevent stale data and race conditions.

## 9. Architecture

Uses a modern Edge Serverless architecture powered by Cloudflare:

- **Frontend:** React (SPA, hosted on Cloudflare Pages)
- **Backend:** Cloudflare Workers (TypeScript + Hono framework, handling REST APIs, conflict detection, deterministic fallback, and event dispatch)
- **Database:** Cloudflare D1 (Serverless edge SQLite with native transactions and foreign key constraints)
- **Authentication:** JWT / Cloudflare Access or Identity Provider (with student/staff role claims)

## 10. Technology Stack

**Frontend — React**
Team is already familiar with it; strong ecosystem; deploys globally with sub-millisecond static asset delivery to Cloudflare Pages.

**Backend — Cloudflare Workers (Hono)**
Ultra-low latency serverless execution at 300+ edge locations worldwide, 0ms cold start, native integration with Cloudflare D1.

**Database — Cloudflare D1**
Serverless SQLite database natively integrated into Cloudflare Workers; provides ACID transactions, relational foreign keys, zero management, and a generous free tier (5M reads/day, 100k writes/day, 5 GB storage).

**Auth — Cloudflare Access / JWT Auth**
Lightweight role-based access control verified at the Worker edge.

**Hosting — Cloudflare Pages**
Fast global CDN hosting with automated Git deployments and unlimited bandwidth on free tier.

## 11. System Interfaces (API / Interfaces)

### REST Endpoints
- **API-01:** GET `/api/timetables/me` — retrieve a student's personal timetable
- **API-02:** GET `/api/rooms` — retrieve list of all rooms with optional filtering (building, min_capacity, status)
- **API-03:** GET `/api/rooms/:id/schedule` — retrieve classroom usage schedule
- **API-04:** POST `/api/meetings` — create a new meeting (checks for conflicts before saving)
- **API-05:** PATCH/PUT `/api/meetings/:id` — edit/update a meeting
- **API-06:** DELETE `/api/meetings/:id` — delete a meeting
- **API-07:** POST `/api/conflicts/check` — check for schedule or capacity conflicts (with AI slot suggestions and deterministic fallback)

### Event & Integration Interfaces
- **API-08 (Inbound Event):** `enrollment.changed` — receives idempotent enrollment change data from Team 03 (Enrollment)
  - **Payload Schema:**
    ```json
    {
      "event_id": "evt_20260920_001",
      "event_name": "enrollment.changed",
      "student_id": "usr_std_001",
      "section_id": "sec_swe204_01",
      "action": "enrolled", // "enrolled" | "dropped" | "withdrawn"
      "timestamp": "2026-09-20T10:30:00Z"
    }
    ```
  - **Consumer Contract:** Idempotent execution (upserting enrollment state and synchronizing section seat count; accepting duplicate delivery and event replays without side effects).
- **API-09 (Outbound Event):** `schedule.changed` — notifies Notification Hub and Data & Analytics when a room/meeting schedule has changed

## 12. Security

- **Authentication:** JWT Bearer tokens verifying identity and roles (`student` | `staff`)
- **Authorization:** Enforced at the Worker edge middleware; students have read-only access, only staff can perform write operations (create/edit/delete meetings)
- **Data Protection:** Parameterized SQL queries preventing SQL injection, CORS configuration, and environment secrets managed securely via Cloudflare Secrets

## 13. Error Handling

- Rejects a save when an overlapping time is found (BR-01) with HTTP 409 Conflict and a clear diagnostic explanation
- Rejects a save when section enrollment exceeds room capacity (BR-02) with HTTP 400 Bad Request
- Uses D1 transactional batch queries (`db.batch()`) to guarantee atomic writes and eliminate race condition double-bookings
- If the AI suggestion service fails, the system immediately switches to the deterministic scan fallback (BR-05)

## 14. Deployment

- **Development:** Local testing with Miniflare / Wrangler (`wrangler d1 execute --local`)
- **Production:** Cloudflare Workers + D1 (`wrangler d1 execute --remote`, `wrangler deploy`)

## 15. Constraints

- **Budget:** 0 THB (100% Free-tier Cloudflare Workers & D1)
- **Timeline:** 1 semester
- **Team:** 3–5 students
- **Usage quota:** Well within Cloudflare Free Tier (100k requests/day, 5 GB D1 database storage)

## 16. Risks and Mitigations

- **Relational Integrity:** Fully solved by Cloudflare D1's native SQLite schema constraints, `FOREIGN KEY ... ON DELETE CASCADE`, and check constraints (`CHECK(start_time < end_time)`), which was a major limitation in Firestore.
- **Simultaneous double-booking race conditions:** Mitigated using Cloudflare D1 atomic transactions and strict conflict pre-check queries.
- **AI Service unavailability:** Mitigated by always having a deterministic fallback system in place (BR-05).
- **Duplicate Webhook Delivery & Event Replay:** Mitigated by idempotent database UPSERT (`ON CONFLICT(student_id, section_id) DO UPDATE`) and count aggregation queries.

## 17. Acceptance Criteria

- [ ] Students can log in and see a personal timetable matching their registered courses
- [ ] Students and staff can view classroom schedules (room lookup) without unauthorized modification
- [ ] Staff with `room-planning` role can create, update, and delete meetings
- [ ] The system correctly blocks duplicate time scheduling in the same room (BR-01, HTTP 409 Conflict)
- [ ] The system correctly blocks room assignments where capacity is insufficient (BR-02, HTTP 400 Bad Request)
- [ ] A `schedule.changed` event is sent whenever a schedule is successfully created/updated/deleted
- [ ] The AI time-suggestion system proposes alternative slots, and the deterministic fallback reliably suggests slots when AI is unavailable
- [ ] Passes all 7 core automated test cases as specified by the course curriculum:
  1. **personal schedule** — `GET /timetables/me` accurately aggregates registered sections and detects overlaps
  2. **room lookup** — `GET /rooms` and `GET /rooms/{id}/schedule` returns correct room metadata and active meeting schedules
  3. **create** — `POST /meetings` successfully allocates valid section, room, and time
  4. **update** — `PATCH /meetings/{id}` successfully modifies meeting time/room while enforcing conflict rules
  5. **time clash** — attempts to double-book a room are rejected with HTTP 409 Conflict
  6. **capacity clash** — attempts to assign a section exceeding room capacity are rejected with HTTP 400 Bad Request
  7. **enrollment-event replay** — replaying duplicate `enrollment.changed` events is handled idempotently without count corruption
- [ ] Users with Student privileges cannot write data to the database under any circumstances
- [ ] The system is deployed and usable via Cloudflare Pages & Workers (Free Tier)

## 18. Future Improvements

- Support for multi-campus/multi-building structures
- Add instructor-specific availability conditions
- System for booking additional equipment and resources within rooms
- Production-level connection to notification and analytics systems
- Edit history logging system and summary Dashboard
- Additional user permission levels (e.g., Admin, Department Head)
- Further development into a Native Mobile Application
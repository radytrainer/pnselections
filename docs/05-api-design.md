# API Design

The app uses **two API layers**:

1. **Direct Supabase client calls** (PostgREST, auto-generated from the schema) for simple CRUD/list/filter operations from Server Components and client components — protected entirely by RLS, no custom backend code needed.
2. **Next.js Route Handlers** (`app/api/**/route.ts`) for operations that need server-only secrets, multi-step orchestration, or business logic that shouldn't live in RLS: auth bridging, AI features, report generation, bulk import, and dashboard aggregates.

Use (1) by default; only add a Route Handler when (2) is required. This keeps the API surface small and avoids duplicating PostgREST.

## 1. Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/bridge` | Exchange a Firebase ID token for a Supabase JWT with custom claims (`role`, `ngo_id`). Calls the `auth-bridge` Supabase Edge Function internally. |
| POST | `/api/auth/refresh` | Re-run the bridge using a refreshed Firebase ID token. |
| POST | `/api/auth/logout` | Clear server session cookie. |

## 2. Students

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/students` | List/filter (query params: `cycle_id`, `province_id`, `district_id`, `status`, `gender`, `school_id`, `ngo_id`, `q` (fuzzy name search), `page`, `pageSize`) — implemented via Supabase client directly in most UI; this Route Handler exists for the **server-rendered table page** with combined filters + pagination metadata in one round trip |
| GET | `/api/students/:id` | Full student profile — joins documents, exam_results, interviews, home_visits, committee_decisions, ai_summaries |
| POST | `/api/students` | Create student (Selection Team / Program Manager / Super Admin) |
| PATCH | `/api/students/:id` | Update student profile fields |
| DELETE | `/api/students/:id` | Soft delete (`deleted_at = now()`) — never a hard delete |
| POST | `/api/students/import` | Bulk CSV/Excel import from Information Session sign-up sheets; validates rows, returns per-row success/error report |
| POST | `/api/students/:id/documents` | Upload a document (multipart) → Supabase Storage + `student_documents` row |
| GET | `/api/students/:id/documents/:docId/url` | Generate a short-lived signed URL for viewing a private document |

## 3. Exam Module

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/exams?cycle_id=&province_id=` | List exam results with rank |
| POST | `/api/exams` | Submit exam scores for a student (triggers rank/pass recalculation server-side) |
| PATCH | `/api/exams/:id` | Correct a score entry (audit-logged) |
| GET | `/api/exams/rankings?cycle_id=&province_id=` | Ranked leaderboard for a cycle/province |

## 4. Interviews

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/interviews?cycle_id=&student_id=` | List/fetch interview records |
| POST | `/api/interviews` | Submit interview scores + recommendation |
| PATCH | `/api/interviews/:id` | Update interview record |

## 5. Home Visits

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/home-visits?student_id=` | List visits for a student (supports re-visits) |
| POST | `/api/home-visits` | Create visit record |
| PATCH | `/api/home-visits/:id` | Update visit record |
| POST | `/api/home-visits/:id/media` | Upload house/family photo or report file |
| POST | `/api/home-visits/:id/generate-report` | **AI**: turn raw visit notes into a professional report draft (Claude API) |

## 6. Selection Committee

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/committee/queue?cycle_id=` | Students ready for committee review (home visit completed, no decision yet) |
| GET | `/api/committee/:studentId/dossier` | Consolidated read view: profile + exam + interview + home visit + AI recommendation |
| POST | `/api/committee/:studentId/notes` | Append a committee note |
| POST | `/api/committee/:studentId/decision` | Record decision (selected/waitlisted/rejected) |
| PATCH | `/api/committee/:studentId/approval` | Program Manager approves/rejects the committee's decision |

## 7. NGO & School Partners

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ngos` | List NGOs (with derived referred/selected counts) |
| POST | `/api/ngos` | Create NGO partner |
| PATCH | `/api/ngos/:id` | Update NGO partner (NGO Partner role can self-edit own org) |
| GET | `/api/ngos/:id/performance?cycle_id=` | Referred vs. selected stats for one NGO |
| GET | `/api/schools` | List school partners |
| POST | `/api/schools` | Create school partner |
| GET | `/api/schools/:id/performance?cycle_id=` | Referred vs. selected stats for one school |

## 8. Dashboard & GIS

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/summary?cycle_id=` | KPI cards: total/female/male/selected students, partner NGOs/schools, provinces covered |
| GET | `/api/dashboard/charts?cycle_id=` | Bundled chart data: by-province, gender distribution, selection funnel, year comparison, NGO contribution |
| GET | `/api/map/provinces?cycle_id=` | Per-province metrics for the choropleth (reads `mv_province_stats`) |
| GET | `/api/map/provinces/:provinceId?cycle_id=` | Province detail: schools, NGOs, student distribution, selection rate |

## 9. Reports

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reports/generate` | Body: `{ report_type, format, params }` → enqueues generation, returns `report_id` |
| GET | `/api/reports/:id` | Poll status / get `file_path` signed URL once ready |
| GET | `/api/reports` | List previously generated reports (audit trail of exports) |

## 10. AI Features

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/student-summary/:studentId` | Generate/refresh a student profile summary |
| POST | `/api/ai/home-visit-report/:visitId` | Generate a professional report from raw visit notes |
| POST | `/api/ai/recommendation/:studentId` | Generate Selected/Waitlisted/Rejected recommendation + explanation |
| POST | `/api/ai/ask` | Body: `{ question }` → NL-to-SQL data assistant; returns `{ answer, sql, rows }` |

Full request/response shapes and prompt design: [08-ai-integration.md](08-ai-integration.md).

## 11. Users & Roles (Admin)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List users + roles (Super Admin only) |
| POST | `/api/admin/users/invite` | Invite a new user (creates Firebase account placeholder + `users` row + role) |
| PATCH | `/api/admin/users/:id/roles` | Assign/revoke roles, link to NGO (for `ngo_partner` role) |
| PATCH | `/api/admin/users/:id/status` | Suspend/reactivate a user |

## 12. Conventions

- **Auth**: every Route Handler requires the Supabase JWT (set as an HTTP-only cookie by `/api/auth/bridge`); handlers re-derive the caller's role/ngo_id from the verified JWT, never trust client-supplied role fields.
- **Pagination**: `page` (1-indexed), `pageSize` (default 25, max 100); responses include `{ data, total, page, pageSize }`.
- **Errors**: `{ error: { code, message, details? } }` with standard HTTP status codes (400 validation, 401 unauthenticated, 403 RBAC denial, 404, 409 conflict, 500).
- **Idempotency**: bulk import and report generation accept an `Idempotency-Key` header to safely retry on network failure.
- **Rate limiting**: `/api/ai/*` endpoints are rate-limited per user (Vercel Edge Middleware + a Supabase-backed counter) to control Claude API cost.

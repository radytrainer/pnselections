# UI/UX Page Specifications

Design system: TailwindCSS + ShadCN UI components. Layout: persistent left sidebar (role-aware nav items), top bar (cycle selector, user menu, notifications). All list pages use TanStack Table (server-side pagination/sort/filter for scale); all charts use Recharts.

## 1. Login Page (`/login`)
- Logo + NGO branding
- "Sign in with Google" button (Firebase)
- Email/Password form (React Hook Form + zod validation)
- Forgot password link
- No self-signup — accounts are admin-invited only

## 2. Executive Dashboard (`/dashboard`)
- **Cycle selector** (top right) — switches all KPIs/charts to selected `selection_cycles.year`
- **KPI cards** (row of 7): Total Students, Female Students, Male Students, Selected Students, Partner NGOs, Partner Schools, Provinces Covered — each with a small trend delta vs. previous cycle
- **Charts grid**:
  - Students by Province (horizontal bar, sorted descending)
  - Gender Distribution (donut)
  - Selection Funnel (IS → Exam → Interview → Home Visit → Committee → Selected) — funnel/stepped bar showing drop-off counts and % at each stage
  - Year Comparison (grouped bar: total/selected per year, last 5 cycles)
  - NGO Contribution (horizontal bar: students referred per NGO, top 10 + "Other")
- **Quick links**: "Open Map", "Committee Queue", "Generate Report"
- Role visibility: Donor sees this page only (no PII tables anywhere in their nav)

## 3. Cambodia GIS Map (`/map`)
- Full-height React Leaflet map centered on Cambodia, one polygon per province from `cambodia-provinces.geojson`
- **Choropleth fill**: color scale (light → dark) bound to `total_students` for the selected cycle, legend in bottom-left
- **Hover tooltip** (per PRD spec): Province Name, Total Students, Male Students, Female Students, Exam Completed, Interview Completed, Home Visits Completed, Selected Students
- **Click** → navigates to `/map/[provinceId]`
- Toggle control: switch choropleth metric (Total Students / Selection Rate / NGO Count)

### 3.1 Province Detail Page (`/map/[provinceId]`)
- Header: province name (EN/KH), cycle selector
- Stat strip: total/male/female students, selection rate %
- **Schools** table (school name, referred, selected, selection rate)
- **NGO Partners** table (org name, referred, selected) with mini-map of NGO pins within the province
- **Student Distribution** chart (by district, by status)
- Link back to full map

## 4. Students List (`/students`)
- TanStack Table: Student Code, Name, Gender, Province, School, Status (badge), GPA, Exam Total, Last Updated
- Filter bar: Cycle, Province, District, Status, Gender, School, NGO, free-text search (debounced)
- Bulk actions (role-gated): Export selected, Bulk status update
- "New Student" button → `/students/new`
- Row click → `/students/[studentId]`

### 4.1 Student Profile (`/students/[studentId]`)
- Tabbed layout: **Overview** | **Exam** | **Interview** | **Home Visit** | **Documents** | **AI Summary**
- Overview: personal/academic/family info in a read-optimized card grid, status timeline (visual stepper of the 6 stages with completion checkmarks)
- Documents tab: thumbnail grid (photo, ID card, transcript, certificates) with secure view-only preview (signed URLs), upload control role-gated
- AI Summary tab: "Generate Summary" button → calls `/api/ai/student-summary/:id`, renders Claude's output with a regenerate option and timestamp/model version

### 4.2 Exam Entry (`/students/[studentId]/exam`)
- Form: Math / English / Logic / Computer score inputs (0–100), auto-computed Total + Pass/Fail badge, province/cycle rank shown read-only after save

### 4.3 Interview Entry (`/students/[studentId]/interview`)
- 5 scored sliders/selects (1–5): Communication, Leadership, Motivation, Confidence, Critical Thinking
- Comments textarea
- Recommendation select

### 4.4 Home Visit Entry (`/students/[studentId]/home-visit`)
- Mobile-first single-column form (used in-field): House Type, Family Income, Transportation, Electricity Access (toggle), Internet Access (toggle), Family Condition notes
- Photo capture/upload (house, family) with client-side compression before upload
- "Generate Report from Notes" AI action → drafts the Visit Report from the typed notes, editable before save
- Recommendation select
- Local draft auto-save (survives connectivity loss)

## 5. Selection Committee Queue (`/committee/queue`)
- Table of students with home visit completed, no decision yet, sorted by visit completion date
- Filter by province
- Row click → Dossier

### 5.1 Committee Dossier (`/committee/[studentId]`)
- Single consolidated read view: Profile summary + Exam scores/rank + Interview scores/recommendation + Home Visit summary/recommendation + **AI Recommendation** (Selected/Waitlisted/Rejected + explanation, clearly labeled as AI-assisted, not authoritative)
- Notes thread (append-only, author + timestamp)
- Decision form: Selected / Waitlisted / Rejected + Decision Date
- Program Manager-only: Approval Status control (Approve/Reject the committee's decision)

## 6. NGO Partners (`/ngos`, `/ngos/[ngoId]`)
- List: Org name, Province, Students Referred, Students Selected, Contact
- Detail: full profile, Projects list, map pin, performance chart (referred vs. selected by cycle)
- NGO Partner role: lands directly on their own `/ngos/[ngoId]` (self-service edit of contact info)

## 7. School Partners (`/schools`, `/schools/[schoolId]`)
- Mirrors NGO Partners structure: Referred/Selected stats, performance trend

## 8. Reports (`/reports`)
- Report builder form: Report Type (Province/Gender/Selection/NGO Performance/School Performance), Cycle, Province/NGO/School filter, Format (PDF/Excel/CSV)
- "Generate" → progress indicator → download link once ready
- History table of previously generated reports (who, when, type, re-download)

## 9. AI Data Assistant (`/ai-assistant`)
- Chat-style interface: user types a natural-language question
- Response shows: plain-language answer, the generated SQL (collapsible, for transparency/trust), and a results table
- Suggested example questions shown on empty state
- Every query logged to `ai_query_logs`; role-scoped (a Donor's questions are answered using aggregate-only data, never raw student PII)

## 10. Admin (`/admin/users`, `/admin/cycles`)
- Users: invite user (email + role + NGO scope if applicable), list with role badges, suspend/reactivate
- Cycles: create/edit selection cycle (year, dates, exam pass threshold, status lifecycle planning→active→closed→archived)

## Responsive / Field-Use Notes
- Home Visit and Interview entry forms are optimized first for tablet/mobile (large touch targets, single column, sticky save button) since these are completed in the field.
- All other pages are desktop-first (data-dense tables, multi-column dashboards) since they're used by office-based program/committee staff.

# Product Requirements Document (PRD)

## 1. Product Vision

The **Scholarship Selection Tracker System** digitizes the NGO Education Partnership's annual scholarship cycle — from initial information sessions through final committee approval — for students recruited from all 25 provinces of Cambodia. It replaces spreadsheet- and paper-based tracking with a single source of truth that supports field teams (exam, interview, home visit), a selection committee, partner NGOs and schools, and executive/donor reporting, while scaling to 50,000+ student records across multiple concurrent and historical selection cycles.

## 2. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Eliminate duplicate/paper data entry | 100% of student records created and tracked digitally |
| Reduce committee decision time | Time from home visit completion to committee decision < 14 days |
| Improve provincial equity visibility | Province-level selection rate visible on dashboard within 1 click |
| Enable data-driven NGO/school partnership decisions | NGO/School performance reports available per cycle |
| Reduce report preparation time | PDF/Excel province & donor reports generated in < 30 seconds |
| Support scale | System performs with 50,000+ student records and 10+ years of cycles without degradation |

## 3. Stakeholders / Personas

| Persona | Role in system | Primary needs |
|---|---|---|
| **Super Admin** | IT/operations lead | Full system control, user & role management, system configuration |
| **Program Manager** | Owns the annual cycle | Cross-province visibility, cycle setup, reporting, final oversight |
| **Selection Team** | Runs IS & entrance exams | Bulk student intake, exam score entry, ranking |
| **Interview Team** | Conducts motivation interviews | Interview scoring, comments, recommendations |
| **Home Visit Team** | Conducts household visits | Visit data + photo capture (often from mobile in the field), report drafting |
| **Committee Member** | Final decision-makers | Consolidated student view across all stages, decision recording |
| **NGO Partner** | Referring/local organization | Visibility into referred students' status and outcomes (scoped to their NGO) |
| **Read-only Donor** | Funder | High-level dashboards and reports, no PII-level access by default |

## 4. Business Process (Selection Pipeline)

Each student progresses through a fixed pipeline per **selection cycle** (one per year):

```
Stage 1: Information Session (IS)
   ↓
Stage 2: Entrance Exam
   ↓
Stage 3: Motivation Interview
   ↓
Stage 4: Home Visit
   ↓
Stage 5: Selection Committee Review
   ↓
Stage 6: Scholarship Approval
```

Student `status` reflects current pipeline position: `registered → exam_completed → interview_completed → home_visit_completed → committee_review → selected | waitlisted | rejected`. A student can be marked `rejected` or `dropped_out` at any stage; the pipeline does not force forward-only progress (a committee can send a student back for re-visit).

## 5. Functional Requirements

### 5.1 Student Management
Maintain a complete profile per student per cycle:
- **Personal**: Student ID (system-generated code), First/Last Name, Gender, DOB, computed Age, Phone, Province/District/Commune/Village (administrative hierarchy lookups)
- **Academic**: School (linked to School Partner), Grade, GPA, English Level
- **Family**: Father/Mother name, Occupation, Family monthly income, Number of siblings
- **Documents**: Student photo, ID card, transcript, certificates — stored in Supabase Storage with per-document access control

### 5.2 Exam Module
- Capture Math, English, Logic, Computer scores per student per cycle
- Auto-calculate **Total Score** (weighted or sum, configurable per cycle)
- Auto-calculate **Rank** (within province and within cycle, recalculated on each score change)
- Auto-derive **Pass Status** against a configurable cycle threshold

### 5.3 Interview Module
- Capture Communication, Leadership, Motivation, Confidence, Critical Thinking scores
- Free-text Comments
- Recommendation enum: Strongly Recommend / Recommend / Neutral / Not Recommend
- Linked to interviewer (user) and interview date

### 5.4 Home Visit Module
- Capture House Type, Family Income, Transportation, Electricity Access, Internet Access, Family Condition narrative
- Upload House Photos, Family Photos, Visit Report (PDF or generated via AI feature)
- Recommendation field, visit date, linked to visiting user
- Designed for field/offline-tolerant capture (mobile-first form, optimistic local save)

### 5.5 Selection Committee
- Consolidated read view of exam + interview + home visit + student profile for each candidate
- Decision: Selected / Waiting List / Rejected
- Committee Notes (free text, multiple committee members can append)
- Decision Date, Approval Status (Pending / Approved / Rejected) — separates committee recommendation from Program Manager's final approval

### 5.6 NGO Partner Management
- Organization Name, Contact Person, Phone, Email, Website, Province, District
- Projects (one-to-many), Notes
- Geolocation for map display
- Students referred / selected counts (derived)

### 5.7 School Partner Management
- School Name, Principal Name, Phone, Email, Province, District
- Derived statistics: Students Referred, Students Selected (per cycle and all-time)

### 5.8 User Roles & RBAC
8 roles as listed in §3, enforced via Firebase Authentication + Supabase Row-Level Security (see [09-security.md](09-security.md)).

### 5.9 Reporting & Export
- Province Reports, Gender Reports, Selection Reports, NGO Performance Reports, School Performance Reports
- Export formats: PDF, Excel (.xlsx), CSV
- Reports parameterized by cycle year and filterable by province/NGO/school

### 5.10 Executive Dashboard
KPI cards: Total Students, Female Students, Male Students, Selected Students, Partner NGOs, Partner Schools, Provinces Covered.
Charts: Students by Province, Gender Distribution, Selection Funnel (IS → Exam → Interview → Home Visit → Committee → Selected), Year-over-Year Comparison, NGO Contribution.

### 5.11 Cambodia GIS Map
Choropleth map of all 25 provinces, colored by student count, with hover tooltip (province name, total/male/female students, exam/interview/home-visit completion counts, selected count) and click-through to a province detail/analytics page (schools, NGO partners, student distribution, selection rate). See [07-ui-pages.md](07-ui-pages.md).

### 5.12 AI Features (Claude API)
1. Student Summary Generator
2. Home Visit Report Generator (notes → professional report)
3. Selection Recommendation Engine (Selected/Waitlisted/Rejected + explanation)
4. AI Data Assistant (natural language → SQL → results)

Full design in [08-ai-integration.md](08-ai-integration.md).

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Scale | 50,000+ student records, 25 provinces, 10+ years of cycles, concurrent field data entry from 14+ provincial teams |
| Performance | Dashboard aggregate queries < 1.5s p95 via materialized views; map render < 1s |
| Availability | 99.5% uptime target (Vercel + Supabase managed infra) |
| Data integrity | Soft delete only on core entities; full audit trail of create/update/delete |
| Security | Firebase Auth + Supabase RLS; encrypted storage for sensitive documents; signed URLs for file access |
| Offline tolerance | Home visit form supports local draft persistence (browser storage) for poor-connectivity field conditions |
| Localization | Khmer + English labels for provinces/districts/communes/villages; UI in English with Khmer name fields throughout |
| Auditability | Every mutation on `students`, `exam_results`, `interviews`, `home_visits`, `committee_decisions` logged to `audit_logs` |

## 7. Assumptions & Out of Scope (v1)

- Payment/disbursement tracking of scholarship funds is **out of scope** for v1 (flagged as a future enhancement).
- SMS/notification delivery to students/parents is out of scope for v1.
- Multi-language UI (full Khmer UI, not just data labels) is out of scope for v1.
- Mobile native apps are out of scope; the Next.js app must be responsive/mobile-web usable for field teams.

## 8. Glossary

- **Cycle**: One annual scholarship selection run (e.g., "2026 Selection Cycle").
- **IS**: Information Session, Stage 1 recruitment event.
- **Committee**: The Selection Committee Review board (Stage 5).
- **RLS**: Row-Level Security (Postgres/Supabase access control mechanism).

# Database ERD

Full DDL with all columns, constraints, and indexes is in [04-schema.sql](04-schema.sql). This diagram shows entities and relationships; attribute lists are abbreviated to the fields relevant to the relationship.

```mermaid
erDiagram
    PROVINCES ||--o{ DISTRICTS : contains
    DISTRICTS ||--o{ COMMUNES : contains
    COMMUNES ||--o{ VILLAGES : contains

    SELECTION_CYCLES ||--o{ STUDENTS : scopes
    PROVINCES ||--o{ STUDENTS : "residence"
    DISTRICTS ||--o{ STUDENTS : residence
    COMMUNES ||--o{ STUDENTS : residence
    VILLAGES ||--o{ STUDENTS : residence
    SCHOOL_PARTNERS ||--o{ STUDENTS : enrolls
    NGO_PARTNERS ||--o{ STUDENTS : refers

    STUDENTS ||--o{ STUDENT_DOCUMENTS : has
    STUDENTS ||--o| EXAM_RESULTS : "has (per cycle)"
    STUDENTS ||--o| INTERVIEWS : "has (per cycle)"
    STUDENTS ||--o{ HOME_VISITS : "has (1+ visits)"
    STUDENTS ||--o| COMMITTEE_DECISIONS : "has (per cycle)"
    STUDENTS ||--o{ AI_SUMMARIES : generates

    HOME_VISITS ||--o{ HOME_VISIT_MEDIA : has
    COMMITTEE_DECISIONS ||--o{ COMMITTEE_NOTES : has

    NGO_PARTNERS ||--o{ NGO_PROJECTS : runs
    PROVINCES ||--o{ NGO_PARTNERS : "based in"
    PROVINCES ||--o{ SCHOOL_PARTNERS : "based in"

    USERS ||--o{ USER_ROLES : assigned
    ROLES ||--o{ USER_ROLES : grants
    USERS ||--o{ USER_NGO_LINK : "scoped to (NGO Partner role)"
    NGO_PARTNERS ||--o{ USER_NGO_LINK : "scopes"

    USERS ||--o{ EXAM_RESULTS : "entered by"
    USERS ||--o{ INTERVIEWS : "conducted by"
    USERS ||--o{ HOME_VISITS : "conducted by"
    USERS ||--o{ COMMITTEE_NOTES : "authored by"
    USERS ||--o{ AI_QUERY_LOGS : asks
    USERS ||--o{ REPORTS : generates
    USERS ||--o{ AUDIT_LOGS : "performed by"

    SELECTION_CYCLES ||--o{ EXAM_RESULTS : scopes
    SELECTION_CYCLES ||--o{ INTERVIEWS : scopes
    SELECTION_CYCLES ||--o{ HOME_VISITS : scopes
    SELECTION_CYCLES ||--o{ COMMITTEE_DECISIONS : scopes

    STUDENTS {
        uuid id PK
        text student_code
        uuid cycle_id FK
        text first_name
        text last_name
        text gender
        date dob
        uuid province_id FK
        uuid district_id FK
        uuid commune_id FK
        uuid village_id FK
        uuid school_id FK
        uuid referred_by_ngo_id FK
        text status
        timestamptz deleted_at
    }

    EXAM_RESULTS {
        uuid id PK
        uuid student_id FK
        uuid cycle_id FK
        numeric math_score
        numeric english_score
        numeric logic_score
        numeric computer_score
        numeric total_score
        int rank_in_province
        text pass_status
    }

    INTERVIEWS {
        uuid id PK
        uuid student_id FK
        uuid cycle_id FK
        int communication_score
        int leadership_score
        int motivation_score
        int confidence_score
        int critical_thinking_score
        text recommendation
        uuid interviewer_id FK
    }

    HOME_VISITS {
        uuid id PK
        uuid student_id FK
        uuid cycle_id FK
        text house_type
        numeric family_income
        boolean electricity_access
        boolean internet_access
        text recommendation
        uuid visitor_id FK
    }

    COMMITTEE_DECISIONS {
        uuid id PK
        uuid student_id FK
        uuid cycle_id FK
        text decision
        text approval_status
        date decision_date
        uuid approved_by FK
    }

    NGO_PARTNERS {
        uuid id PK
        text organization_name
        uuid province_id FK
        uuid district_id FK
        numeric lat
        numeric lng
    }

    SCHOOL_PARTNERS {
        uuid id PK
        text school_name
        uuid province_id FK
        uuid district_id FK
    }

    USERS {
        uuid id PK
        text firebase_uid
        text email
        text full_name
        text status
    }

    ROLES {
        uuid id PK
        text name
    }

    SELECTION_CYCLES {
        uuid id PK
        int year
        text status
    }

    AUDIT_LOGS {
        uuid id PK
        text table_name
        uuid record_id
        text action
        uuid changed_by FK
        jsonb old_data
        jsonb new_data
    }
```

## Relationship Notes

- **1 student : 1 cycle.** A returning applicant in a later year gets a new `students` row carrying a stable `student_global_id` (UUID, not a PK) so longitudinal history can be queried without violating the cycle-scoped uniqueness of stage tables.
- **Stage tables (`exam_results`, `interviews`, `committee_decisions`) are effectively 1:1 with `students`** (one row per student per cycle), enforced via a `UNIQUE (student_id)` constraint — since `students` itself is already cycle-scoped, this is equivalent to one-per-student-per-cycle.
- **`home_visits` is 1:N** — a student may receive a follow-up/re-visit; the latest visit by `visit_date` is used downstream unless the committee explicitly references an earlier one.
- **Administrative hierarchy** (`provinces → districts → communes → villages`) is a self-contained reference dataset, seeded once (see [seed-data.sql](seed-data.sql)), and reused by `students`, `ngo_partners`, and `school_partners`.
- **`audit_logs` is polymorphic** (`table_name` + `record_id`) rather than FK'd to every table, by design — it must survive even if the source row is hard-deleted (which it never should be — see soft delete strategy in [04-schema.sql](04-schema.sql)).

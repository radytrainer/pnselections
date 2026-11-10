# 4-Week Development Roadmap

**Scope note:** four weeks is enough to ship a working, demoable MVP covering the core pipeline (auth → student intake → exam → interview → home visit → committee → dashboard/map) with one full vertical slice of AI. Full enterprise hardening (load testing at 50k+ students, complete report template library, AI assistant guardrail tuning, accessibility audit) is scheduled into the weeks immediately following — see [12-future-enhancements.md](12-future-enhancements.md) for what's intentionally deferred past week 4.

## Week 1 — Foundation

| Day | Work |
|---|---|
| 1–2 | Initialize Next.js 15 + TS + Tailwind + ShadCN project per [06-nextjs-structure.md](06-nextjs-structure.md); set up Supabase project, apply [04-schema.sql](04-schema.sql) + [seed-data.sql](seed-data.sql); set up Firebase project (Google + Email/Password providers) |
| 3 | Build the `auth-bridge` Edge Function; wire Firebase login UI → bridge → Supabase JWT session cookie; implement `middleware.ts` route gating |
| 4 | Implement RBAC helpers (`lib/rbac.ts`, `RoleGate`), seed the 8 roles + a test user per role |
| 5 | Students module: `students` list (TanStack Table, server pagination) + `StudentForm` create/edit + document upload to Storage |

**Exit criteria**: a user can log in with Google or email/password, land on a role-appropriate page, and create/view a student record with an uploaded photo.

## Week 2 — Core Pipeline Modules

| Day | Work |
|---|---|
| 6–7 | Exam module: score entry form, `recalc_exam_ranks` trigger verified, rankings view |
| 8 | Interview module: scoring form, recommendation field |
| 9–10 | Home Visit module: mobile-first form, photo upload, local draft auto-save, re-visit support |
| 11 | Selection Committee: queue page, dossier page (consolidated read view), decision + notes + approval flow |

**Exit criteria**: a test student can be walked through all 6 pipeline stages end-to-end by switching test-user roles, ending in a recorded, approved committee decision.

## Week 3 — Dashboard, Map, Partners, Reporting

| Day | Work |
|---|---|
| 12 | NGO Partner + School Partner CRUD and performance stat queries |
| 13 | Executive Dashboard: KPI cards + 5 charts wired to `mv_province_stats` and live queries |
| 14–15 | Cambodia GIS Map: load GeoJSON, choropleth + hover tooltip, click-through province detail page |
| 16 | Reporting: report builder UI + first two report types (Province, Selection) in PDF + CSV; Excel format added if time allows, else slips to week 4 buffer |

**Exit criteria**: dashboard and map reflect real seeded data correctly; at least 2 of 5 report types export successfully in 2 of 3 formats.

## Week 4 — AI Features, Hardening, UAT

| Day | Work |
|---|---|
| 17 | AI Feature 1 (Student Summary) + Feature 2 (Home Visit Report) — server-side Claude integration, stored outputs |
| 18 | AI Feature 3 (Selection Recommendation Engine) on the Committee Dossier |
| 19 | AI Feature 4 (Data Assistant): schema-scoped prompt, SQL validation layer, `ai_readonly` role + restricted views, rate limiting |
| 20 | Audit logging verification end-to-end, RLS policy review/pen-test pass (confirm Donor/NGO Partner scoping actually holds), fix gaps |
| 21 | Staging deploy, seed realistic multi-province sample data, UAT walkthrough with NGO program staff, bug triage |

**Exit criteria**: all 4 AI features functional behind the role guardrails in [08-ai-integration.md](08-ai-integration.md); RLS verified for every role in the matrix in [09-security.md](09-security.md); staging environment ready for a pilot cycle.

## Suggested Team Allocation (for a 4-week timeline)

| Role | Focus |
|---|---|
| 1 Full-stack lead | Architecture, auth bridge, RLS policies, deployment pipeline |
| 1–2 Frontend engineers | UI pages, forms, dashboard, map |
| 1 Backend/DB engineer | Schema, migrations, materialized views, report generation, AI proxy |
| 1 QA/Program staff liaison | UAT scripting with real field-team workflows, RBAC verification across all 8 roles |

## Risks to Flag Going In

- **GeoJSON accuracy**: confirm the chosen Cambodia province boundary dataset's property keys before week 3 (blocks the map task if discovered late) — see the note in [seed-data.sql](seed-data.sql).
- **Firebase↔Supabase auth bridge** is custom and security-critical; budget extra review time in week 1, not week 4.
- **Field connectivity**: validate the Home Visit form's offline-draft behavior on an actual low-connectivity test before declaring week 2 done — this is the workflow most likely to fail silently in the field.

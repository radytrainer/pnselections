# Future Scalability & Enhancement Recommendations

## 1. Scale Hardening (beyond MVP)

- **Partitioning**: once historical data spans many cycles, consider partitioning `students`, `exam_results`, `interviews`, `home_visits`, `committee_decisions` by `cycle_id` (range/list partitioning) to keep per-cycle queries fast and make archiving old cycles a cheap `DETACH PARTITION` instead of a delete.
- **Connection pooling**: confirm Supabase's pooled connection mode (`pgbouncer`, transaction mode) is used for all serverless Route Handler queries as concurrent field-team usage grows; monitor pool saturation during peak intake weeks (Information Session sign-up day, exam day).
- **Read replicas**: if donor/dashboard read traffic grows significantly, move dashboard/map aggregate queries to a Supabase read replica, keeping the primary free for transactional writes from field teams.
- **Materialized view strategy**: extend `mv_province_stats` with district-level and NGO/school-level materialized views as report complexity grows, rather than computing those aggregates ad hoc on every report generation.
- **Load testing**: simulate 50,000+ student records and concurrent field-team writes (k6/Artillery) against staging before each cycle's peak intake period.

## 2. Feature Roadmap (post-MVP)

| Enhancement | Why it's deferred from v1 |
|---|---|
| Scholarship disbursement/payment tracking | Distinct domain (finance) with its own approval/audit requirements; cleaner as a v2 module once selection workflow is stable |
| SMS/notification delivery to students/parents/committee (decision updates, visit scheduling) | Needs a vetted local SMS gateway (e.g. for Cambodia telecom carriers) and consent/data-handling review |
| Full Khmer-language UI (not just data labels) | Requires a translation/i18n pass (next-intl or similar) and Khmer-fluent UX review — labels-only Khmer (province/district/commune names) ships in v1 |
| Native mobile app for field teams | Current responsive web app should be validated in real field conditions first; a native app (offline-first, background sync) is justified only if connectivity issues prove the bigger blocker than UI |
| Donor self-service portal with richer historical analytics | v1 ships donor dashboards; a dedicated donor portal (saved views, scheduled email reports) is a natural v1.x extension |
| Alumni/longitudinal outcome tracking (post-scholarship academic/career outcomes) | Needs new data collection process design beyond the selection pipeline itself; `student_global_id` in the schema is specifically designed to make this addable later without a migration of existing data |
| In-app login/activity dashboard for admins (beyond Firebase's own logs) | Add a lightweight `login_events` table + ingestion if Firebase's built-in logs prove insufficient for the NGO's audit needs |
| Field-level encryption for highly sensitive columns (`family_income_monthly`, `phone`) | Add via `pgcrypto` if the NGO's data protection policy or a future compliance requirement (e.g. donor-mandated data handling standard) requires it beyond provider-level at-rest encryption |
| AI Data Assistant — conversational follow-ups / saved queries | v1 ships single-turn NL→SQL; multi-turn context and a "saved questions" library is a natural iteration once usage patterns are observed |
| Automated anomaly detection (e.g. flag provinces with unusually low selection rates for review) | Worth building once 2–3 cycles of real data exist to calibrate "unusual" against |

## 3. Architectural Evolution Triggers

- **If NGO partners need to log in and self-manage more than contact info** (e.g. their own field staff submitting referral data directly) → introduce an NGO-scoped sub-portal with its own intake form, still writing into the same `students` table but with a narrower RLS write policy.
- **If multiple country offices/programs eventually share this platform** → introduce a `programs`/`organizations` tenancy layer above `selection_cycles`, since the current schema assumes a single NGO Education Partnership instance.
- **If report volume/complexity outgrows on-demand generation** → move report generation to a background job queue (Supabase Edge Function + `pg_cron` or an external queue like Inngest/Trigger.dev) rather than synchronous Route Handler generation.
- **If the AI Data Assistant proves valuable enough to expose to NGO Partners/Donors more broadly** → invest in a more robust text-to-SQL guardrail (e.g. a constrained query-builder DSL instead of free-form SQL generation) rather than continuing to harden prompt-based validation indefinitely.

## 4. Suggested Review Cadence

- Re-run the load test and RLS policy audit before each year's cycle kicks off (data volume and role assignments both grow annually).
- Review Claude prompt outputs (summaries, recommendations, generated SQL) quarterly with program staff to catch drift and recalibrate system prompts as the dataset and committee practices evolve.

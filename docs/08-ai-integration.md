# AI Integration Design (Claude API)

**Hard rule:** the Anthropic API key lives only in server-side environment variables (`ANTHROPIC_API_KEY` on Vercel / Supabase Edge Function secrets). The browser never calls Claude directly — every feature below is invoked through a Next.js Route Handler or Supabase Edge Function, which calls Claude server-side and returns only the result to the client. This also lets every AI call be rate-limited, logged, and cost-monitored centrally.

Model: `claude-sonnet-4-6` for all four features (quality/cost balance for structured business text + SQL generation). Model name is stored per-record (`ai_summaries.model_version`, not hardcoded) so it can be upgraded without a migration.

## Feature 1 — Student Summary Generator

**Trigger**: `POST /api/ai/student-summary/:studentId` (button on Student Profile → AI Summary tab).

**Input assembled server-side** (never trust client-supplied profile data): student record + exam_results + interviews + home_visits, fetched with the service role, redacting nothing (internal staff use only — gated by the same RLS roles as the profile page itself).

**System prompt (sketch)**:
```
You are writing an internal, factual summary of a scholarship applicant for
NGO staff and committee members. Use only the structured data provided.
Do not speculate beyond the data. Write 150-250 words, neutral tone,
covering: academic performance, family/economic context, interview
impressions, and home visit observations. Do not make a selection
recommendation in this summary.
```

**Output**: stored in `ai_summaries` (`summary_type='profile_summary'`), displayed with a "Regenerate" action and the generation timestamp + model version visible to the user (transparency — never presented as if a human wrote it).

## Feature 2 — Home Visit Report Generator

**Trigger**: `POST /api/ai/home-visit-report/:visitId`, called from the Home Visit entry form's "Generate Report from Notes" action.

**Input**: the field worker's raw `family_condition_notes` plus the structured fields (house type, income, electricity/internet access, transportation).

**System prompt (sketch)**:
```
Convert the following field notes and structured household data into a
professional home visit report suitable for a selection committee. Sections:
Household Overview, Economic Situation, Living Conditions, Observations,
Visitor's Recommendation Context (restate the visitor's recommendation field
verbatim, do not alter it). Do not invent details not present in the input.
```

**Output**: returned as editable draft text in the form (not auto-saved) — the field worker reviews/edits before submitting; final text is stored as a `home_visit_media` record (`media_type='report'`, stored as a generated PDF/text file) plus referenced in `home_visits`. This keeps a human in the loop before anything becomes part of the official record.

## Feature 3 — Selection Recommendation Engine

**Trigger**: `POST /api/ai/recommendation/:studentId`, surfaced on the Committee Dossier page.

**Input**: full consolidated dossier (profile + exam scores/rank + interview scores/recommendation + home visit recommendation + family income context).

**System prompt (sketch)**:
```
You are an advisory assistant to a scholarship selection committee. Based on
the structured data provided (exam scores/rank, interview scores, home visit
findings, family economic context), output a JSON object:
{ "recommendation": "selected" | "waitlisted" | "rejected",
  "confidence": "low" | "medium" | "high",
  "explanation": "2-4 sentences citing specific data points" }
This is advisory only. The committee makes the final, binding decision.
```

**Output**: parsed JSON, stored in `ai_summaries` (`summary_type='selection_recommendation'`), rendered on the Dossier with a clear "AI-Assisted — Not a Final Decision" badge. The actual `committee_decisions.decision` field is only ever written by a human committee member action — there is no code path where the AI output writes directly to `committee_decisions`.

## Feature 4 — AI Data Assistant (Natural Language → SQL)

This is the highest-risk feature (arbitrary NL input → executed SQL) and needs explicit guardrails.

**Trigger**: `POST /api/ai/ask` `{ question: string }`.

**Pipeline**:
1. **Context assembly**: server builds a prompt containing only the *schema* (table/column names + types + short descriptions, no data) for the tables relevant to reporting: `students`, `exam_results`, `interviews`, `home_visits`, `committee_decisions`, `provinces`, `ngo_partners`, `school_partners`, `selection_cycles`, plus the caller's `role` and `ngo_id` claim.
2. **Generation**: Claude is instructed to output **only** a single read-only SQL statement against a fixed allowed-table list, using the provided schema, in a structured response (e.g. inside a `sql` field of a JSON object so it can't be confused with the answer text).
   ```
   You translate questions into a single PostgreSQL SELECT statement.
   Rules:
   - Only SELECT statements. Never INSERT/UPDATE/DELETE/DDL/DML other than SELECT.
   - Only reference these tables: {allowed_tables}.
   - Never reference: users, audit_logs, ai_query_logs, student_documents,
     home_visit_media, committee_notes (no PII documents or raw notes).
   - Always filter deleted_at IS NULL on tables that have it.
   - If the caller's role is "donor" or "ngo_partner", you may only return
     aggregate (COUNT/AVG/SUM/GROUP BY) results — never individual student
     rows. If the question requires row-level student data for that role,
     return { "error": "not_permitted" } instead of SQL.
   Respond with JSON: { "sql": "...", "explanation": "..." } or { "error": "..." }.
   ```
3. **Static validation (server, before execution)**: parse the returned SQL and reject if it is not a single statement, contains any keyword outside an allow-list (`SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, `ORDER BY`, `LIMIT`, aggregate functions), or references a table not in the allowed list. Reject on any semicolon-chaining attempt (basic injection/multi-statement defense in addition to using a non-superuser DB role).
4. **Execution**: run via a dedicated Postgres role (`ai_readonly`) that has `SELECT`-only grants on a restricted set of views (not the raw tables) so that even a validation bug can't expose more than intended — e.g. `v_students_public` (no `phone`, no `father_name`/`mother_name`, no `family_income_monthly` exact value — bucketed instead) for `donor`/`ngo_partner` roles, and full table access only when `role` is internal staff.
5. A hard `LIMIT 500` is appended server-side if the generated query has no limit.
6. Result + generated SQL + row count are logged to `ai_query_logs` (success or error) for audit and for tuning the prompt over time.
7. Optionally, a second Claude call summarizes the result rows into a one-sentence natural-language answer for display above the table.

**Example**: "How many female students were selected from Siem Reap in 2026?" →
```sql
select count(*) from students s
join committee_decisions cd on cd.student_id = s.id
join provinces p on p.id = s.province_id
join selection_cycles sc on sc.id = s.cycle_id
where s.gender = 'female' and cd.decision = 'selected'
  and p.name_en = 'Siem Reap' and sc.year = 2026
  and s.deleted_at is null;
```

**Example**: "Which province has the highest selection rate?" →
```sql
select p.name_en,
       count(*) filter (where cd.decision = 'selected')::numeric
         / nullif(count(*),0) as selection_rate
from students s
join provinces p on p.id = s.province_id
left join committee_decisions cd on cd.student_id = s.id
where s.deleted_at is null
group by p.name_en
order by selection_rate desc
limit 1;
```

## Cost & Reliability Controls

- Per-user rate limit on all `/api/ai/*` routes (e.g. 30 requests/hour) via Edge Middleware + a Supabase counter table.
- Cache `profile_summary` and `selection_recommendation` outputs; only regenerate on explicit user action or when underlying data changes materially.
- Timeouts + retry-once on Claude API errors; user-facing fallback message if the AI feature is unavailable — none of the four features are on any critical-path write operation, so a Claude outage never blocks the actual selection workflow.

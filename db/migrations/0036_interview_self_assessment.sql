-- Replace the 5 generic score columns with the 16 self-assessment questions
-- from the PN self-assessment form (rated 1–5 each, max total 80).
-- Scoring: 48–80 = A1, 40–47 = A2, <40 = not_recommended

alter table interviews
  drop column if exists communication_score,
  drop column if exists leadership_score,
  drop column if exists motivation_score,
  drop column if exists confidence_score,
  drop column if exists critical_thinking_score;

alter table interviews
  add column if not exists q1_score  int check (q1_score  between 1 and 5),
  add column if not exists q2_score  int check (q2_score  between 1 and 5),
  add column if not exists q3_score  int check (q3_score  between 1 and 5),
  add column if not exists q4_score  int check (q4_score  between 1 and 5),
  add column if not exists q5_score  int check (q5_score  between 1 and 5),
  add column if not exists q6_score  int check (q6_score  between 1 and 5),
  add column if not exists q7_score  int check (q7_score  between 1 and 5),
  add column if not exists q8_score  int check (q8_score  between 1 and 5),
  add column if not exists q9_score  int check (q9_score  between 1 and 5),
  add column if not exists q10_score int check (q10_score between 1 and 5),
  add column if not exists q11_score int check (q11_score between 1 and 5),
  add column if not exists q12_score int check (q12_score between 1 and 5),
  add column if not exists q13_score int check (q13_score between 1 and 5),
  add column if not exists q14_score int check (q14_score between 1 and 5),
  add column if not exists q15_score int check (q15_score between 1 and 5),
  add column if not exists q16_score int check (q16_score between 1 and 5);

-- Clear old recommendation values before updating the constraint
-- (existing rows used the old 5-field scoring system; grades will be re-entered)
update interviews set recommendation = null;

-- Update recommendation constraint to reflect computed grades
alter table interviews
  drop constraint if exists interviews_recommendation_check;

alter table interviews
  add constraint interviews_recommendation_check
  check (recommendation in ('A1', 'A2', 'not_recommended'));

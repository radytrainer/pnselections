-- Motivation Interview pass rule, adjustable per selection cycle.
-- Before this, the cutoff was hardcoded at 50% of the maximum score (40/80 with
-- 16 questions; A1 = 60%+, A2 = 50–59%, both "Passed"). The defaults below keep
-- that exact behaviour for existing cycles.
--
-- interview_pass_mode:
--   'percent' → pass when total / max * 100 >= interview_pass_value
--   'points'  → pass when total >= interview_pass_value (e.g. 40 out of 80)
alter table selection_cycles
  add column if not exists interview_pass_mode text not null default 'percent'
    check (interview_pass_mode in ('percent', 'points')),
  add column if not exists interview_pass_value numeric not null default 50
    check (interview_pass_value >= 0);

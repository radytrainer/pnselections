-- Selection Team can now conduct interviews too: record/edit the interview
-- (recommendation, comments) and its per-question scores. Same rights the
-- Interview Team has (0001 interviews_write/update, 0037 interview_answers_*).
-- Reading was already allowed for selection_team; the question bank itself
-- stays super_admin-only.

drop policy if exists interviews_write on interviews;
create policy interviews_write on interviews for insert with check (
  auth_role() in ('super_admin','program_manager','interview_team','selection_team')
);

drop policy if exists interviews_update on interviews;
create policy interviews_update on interviews for update using (
  auth_role() in ('super_admin','program_manager','interview_team','selection_team')
);

drop policy if exists interview_answers_write on interview_answers;
create policy interview_answers_write on interview_answers for insert with check (
  auth_role() in ('super_admin','program_manager','interview_team','selection_team')
);

drop policy if exists interview_answers_update on interview_answers;
create policy interview_answers_update on interview_answers for update using (
  auth_role() in ('super_admin','program_manager','interview_team','selection_team')
);

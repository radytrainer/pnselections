-- Allow selection_team to insert and update social assessments.
-- They can already read them (social_assessments_select includes all staff roles).

drop policy social_assessments_write on social_assessments;
create policy social_assessments_write on social_assessments for insert with check (
  auth_role() in ('super_admin', 'program_manager', 'home_visit_team', 'selection_team')
);

drop policy social_assessments_update on social_assessments;
create policy social_assessments_update on social_assessments for update using (
  auth_role() in ('super_admin', 'program_manager', 'home_visit_team', 'selection_team')
);

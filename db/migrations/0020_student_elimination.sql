-- Lets the home visit team eliminate a student straight from the social
-- form when the household clearly doesn't match the social criteria,
-- instead of waiting for committee review. Reuses the existing 'eliminated'
-- status (added in 0015) and records why.
alter table students add column elimination_reason text;

-- home_visit_team was missing from students_update even though the social
-- form already advances students.status (see socialFormService.saveSocialAssessment)
-- — without this, that status bump and the new eliminate action both
-- silently fail under RLS for that role.
drop policy if exists students_update on students;
create policy students_update on students for update using (
  auth_role() in ('super_admin','program_manager','selection_team','home_visit_team')
);

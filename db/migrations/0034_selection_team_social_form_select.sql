-- Grant selection_team read access to social_assessments.
-- Without this they cannot load an existing assessment, so the page
-- has no record id, and the save falls through to INSERT, hitting the
-- unique(student_id, visit_number) constraint with a 409 conflict.

drop policy social_assessments_select on social_assessments;
create policy social_assessments_select on social_assessments for select using (
  auth_role() in ('super_admin','program_manager','selection_team','home_visit_team','committee_member','donor')
);

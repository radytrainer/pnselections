-- home_visit_team may only update social assessments they personally
-- recorded (visitor_id = their own user id). super_admin, program_manager,
-- and selection_team retain full update access across all assessments.

drop policy social_assessments_update on social_assessments;
create policy social_assessments_update on social_assessments for update using (
  auth_role() in ('super_admin', 'program_manager', 'selection_team')
  or (auth_role() = 'home_visit_team' and visitor_id = auth_user_id())
);

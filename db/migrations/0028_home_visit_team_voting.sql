-- home_visit_team members can now cast committee votes on students whose
-- social form they did not personally record. The "only for non-own-students"
-- restriction is enforced at the UI layer (committee/queue and [studentId]
-- pages check visitor_id against the current user); the RLS just unlocks
-- write access for the role alongside committee_member.
drop policy committee_ratings_insert on committee_ratings;
create policy committee_ratings_insert on committee_ratings for insert with check (
  auth_role() in ('committee_member','home_visit_team') and rated_by = auth_user_id()
);

drop policy committee_ratings_update on committee_ratings;
create policy committee_ratings_update on committee_ratings for update using (
  auth_role() in ('committee_member','home_visit_team') and rated_by = auth_user_id()
);

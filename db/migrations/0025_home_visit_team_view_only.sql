-- Narrows 0024: home_visit_team doesn't vote on committee_ratings after
-- all — they get read-only visibility into the full vote distribution
-- (like selection_team/super_admin/program_manager), not a vote restricted
-- to their own row. selection_team gains the actual decision power that
-- used to sit with super_admin/program_manager only.
drop policy committee_ratings_select on committee_ratings;
create policy committee_ratings_select on committee_ratings for select using (
  auth_role() in ('super_admin','program_manager','selection_team','home_visit_team','donor')
  or (auth_role() = 'committee_member' and rated_by = auth_user_id())
);

drop policy committee_ratings_insert on committee_ratings;
create policy committee_ratings_insert on committee_ratings for insert with check (
  auth_role() = 'committee_member' and rated_by = auth_user_id()
);

drop policy committee_ratings_update on committee_ratings;
create policy committee_ratings_update on committee_ratings for update using (
  auth_role() = 'committee_member' and rated_by = auth_user_id()
);

drop policy committee_select on committee_decisions;
create policy committee_select on committee_decisions for select using (
  auth_role() in ('super_admin','program_manager','selection_team','donor')
);
drop policy committee_write on committee_decisions;
create policy committee_write on committee_decisions for insert with check (
  auth_role() in ('super_admin','program_manager','selection_team')
);
drop policy committee_update on committee_decisions;
create policy committee_update on committee_decisions for update using (
  auth_role() in ('super_admin','program_manager','selection_team')
);

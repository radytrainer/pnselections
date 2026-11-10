-- home_visit_team gains full committee_member parity for voting: same
-- vote-on-your-own-row rules as committee_member (0018/0021), just with the
-- role list widened. committee_decisions deliberately stays untouched —
-- committee_member can vote but not decide, and home_visit_team mirrors
-- that split too.
drop policy committee_ratings_select on committee_ratings;
create policy committee_ratings_select on committee_ratings for select using (
  auth_role() in ('super_admin','program_manager','selection_team','donor')
  or (auth_role() in ('committee_member','home_visit_team') and rated_by = auth_user_id())
);

drop policy committee_ratings_insert on committee_ratings;
create policy committee_ratings_insert on committee_ratings for insert with check (
  auth_role() in ('committee_member','home_visit_team') and rated_by = auth_user_id()
);

drop policy committee_ratings_update on committee_ratings;
create policy committee_ratings_update on committee_ratings for update using (
  auth_role() in ('committee_member','home_visit_team') and rated_by = auth_user_id()
);

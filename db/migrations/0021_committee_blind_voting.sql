-- Committee members were able to read every member's rating row for a
-- student (committee_ratings_select had no rated_by restriction for that
-- role), which the UI then aggregated into an average/count visible to
-- committee_member too — defeating "each member votes independently."
-- Restrict that role to its own row; selection_team joins super_admin/
-- program_manager's existing read-only oversight of the full distribution
-- (they decide who gets selected based on which score got the most votes,
-- per the new vote-distribution chart on the dossier page).
drop policy committee_ratings_select on committee_ratings;
create policy committee_ratings_select on committee_ratings for select using (
  auth_role() in ('super_admin','program_manager','selection_team','donor')
  or (auth_role() = 'committee_member' and rated_by = auth_user_id())
);

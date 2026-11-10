-- Collapses the 4-criteria committee rating (financial_need/family_condition/
-- academic_performance/interview_fit) into a single 1-5 "overall" vote per
-- member per student, and restricts voting to committee_member only —
-- super_admin/program_manager get read-only oversight (the average score),
-- not a vote, mirroring their decision-making vs. rating split in the app.
-- No real ratings exist yet under the old 4-criteria rubric, so rows are
-- cleared rather than backfilled/averaged.
delete from committee_ratings;

alter table committee_ratings drop constraint committee_ratings_criterion_check;
alter table committee_ratings add constraint committee_ratings_criterion_check
  check (criterion = 'overall');
alter table committee_ratings alter column criterion set default 'overall';

drop policy committee_ratings_insert on committee_ratings;
create policy committee_ratings_insert on committee_ratings for insert with check (
  auth_role() = 'committee_member' and rated_by = auth_user_id()
);

drop policy committee_ratings_update on committee_ratings;
create policy committee_ratings_update on committee_ratings for update using (
  auth_role() = 'committee_member' and rated_by = auth_user_id()
);

-- Members vote (committee_ratings) but don't decide — strip their access to
-- committee_decisions entirely (select included, so they can't read a
-- decision even if a future UI bug stopped hiding it).
drop policy committee_select on committee_decisions;
create policy committee_select on committee_decisions for select using (
  auth_role() in ('super_admin','program_manager','donor')
);
drop policy committee_write on committee_decisions;
create policy committee_write on committee_decisions for insert with check (
  auth_role() in ('super_admin','program_manager')
);
drop policy committee_update on committee_decisions;
create policy committee_update on committee_decisions for update using (
  auth_role() in ('super_admin','program_manager')
);

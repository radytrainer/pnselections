-- social_assessments.visitor_id (0011) was never actually populated — the
-- app only ever sent visitor_name as free text — so there was no way to
-- tell which home_visit_team member recorded a given visit. Default it to
-- the inserting user so that becomes answerable from the row itself.
-- Existing rows stay NULL; there's no reliable way to backfill who actually
-- visited them.
alter table social_assessments alter column visitor_id set default auth_user_id();

-- home_visit_team may freely update a student record (status advances as
-- they fill out the social form, plus the 0020 elimination action), but
-- sending a case to committee_review is the one transition restricted to
-- students whose social form they personally recorded — they shouldn't be
-- able to push someone else's case forward.
drop policy students_update on students;
create policy students_update on students for update using (
  auth_role() in ('super_admin','program_manager','selection_team','home_visit_team')
) with check (
  auth_role() in ('super_admin','program_manager','selection_team')
  or (
    auth_role() = 'home_visit_team'
    and (
      status <> 'committee_review'
      or exists (
        select 1 from social_assessments sa
        where sa.student_id = students.id and sa.visitor_id = auth_user_id()
      )
    )
  )
);

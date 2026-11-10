-- Adds "declined" as a 5th committee decision / student status: distinct
-- from "rejected" (committee said no) and "eliminated" (case dropped
-- outright) — this is for a candidate the committee already selected, who
-- then turns down the scholarship themselves.
alter table committee_decisions drop constraint if exists committee_decisions_decision_check;
alter table committee_decisions add constraint committee_decisions_decision_check
  check (decision in ('selected','waitlisted','rejected','eliminated','declined'));

alter table students drop constraint if exists students_status_check;
alter table students add constraint students_status_check check (status in (
  'registered','exam_completed','interview_completed',
  'home_visit_completed','committee_review',
  'selected','waitlisted','rejected','eliminated','declined','dropped_out'
));

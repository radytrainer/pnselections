-- Adds "eliminated" as a 4th committee decision (distinct from "rejected" —
-- used when a case is dropped outright rather than not selected this cycle)
-- and a "poor_level" classification the committee assigns alongside its
-- decision (A+ down to B-, A+ being the most severe/poorest).
alter table committee_decisions drop constraint if exists committee_decisions_decision_check;
alter table committee_decisions add constraint committee_decisions_decision_check
  check (decision in ('selected','waitlisted','rejected','eliminated'));

alter table committee_decisions add column poor_level text
  check (poor_level in ('A+','A','A-','B+','B','B-'));

alter table students drop constraint if exists students_status_check;
alter table students add constraint students_status_check check (status in (
  'registered','exam_completed','interview_completed',
  'home_visit_completed','committee_review',
  'selected','waitlisted','rejected','eliminated','dropped_out'
));

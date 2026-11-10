-- Free-text comment for academic performance.
alter table social_assessments
  add column if not exists academic_note text;

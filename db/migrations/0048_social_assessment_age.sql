-- Student's age as reported by the home visitor, captured alongside Gender.
alter table social_assessments
  add column if not exists age integer;

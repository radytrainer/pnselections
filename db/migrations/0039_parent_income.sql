-- Father's/mother's individual salary or income, alongside their existing age/job fields.
alter table social_assessments
  add column if not exists father_income text,
  add column if not exists mother_income text;

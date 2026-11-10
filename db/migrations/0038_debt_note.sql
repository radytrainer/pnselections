-- Free-text reasoning behind the household's debt amount/status.
alter table social_assessments
  add column if not exists debt_note text;

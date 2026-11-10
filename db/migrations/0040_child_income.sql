-- Income contributed by up to three of the household's children, alongside parent income.
alter table social_assessments
  add column if not exists child1_income text,
  add column if not exists child2_income text,
  add column if not exists child3_income text;

-- Family composition captured on the first page of the social form, next to
-- Gender/Age. Informational only — not part of the poverty score.
-- No CHECK constraints (same as `age`): a stray value must not make a whole
-- home-visit save — possibly an offline one syncing later — fail.
alter table social_assessments
  add column if not exists child_rank integer,
  add column if not exists children_count integer,
  add column if not exists family_male_count integer,
  add column if not exists family_female_count integer,
  add column if not exists family_note text;

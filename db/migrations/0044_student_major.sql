-- Field of study captured alongside Academic Performance.
alter table social_assessments
  add column if not exists major text check (major in ('science', 'social_science'));

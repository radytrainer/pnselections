-- Free-text comments for each household asset category.
alter table social_assessments
  add column if not exists assets_furniture_note text,
  add column if not exists assets_transport_note text,
  add column if not exists assets_electronics_note text,
  add column if not exists assets_livestock_note text;

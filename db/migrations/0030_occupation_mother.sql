-- Add 'mother' (stay-at-home mother / housewife) as a valid parent occupation band.
-- Worth 2 pts in the scoring rubric, same as 'farmer'.

alter table social_assessments
  drop constraint social_assessments_parent_occupation_band_check;

alter table social_assessments
  add constraint social_assessments_parent_occupation_band_check
  check (parent_occupation_band in (
    'unemployed', 'daily_laborer', 'farmer', 'mother', 'small_business', 'stable_salaried'
  ));

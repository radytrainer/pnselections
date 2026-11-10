-- Split parent_occupation_band into per-parent fields.
-- The legacy column is kept (NULL on new rows) for backward-compat scoring.

alter table social_assessments
  add column father_occupation_band text check (father_occupation_band in (
    'unemployed', 'daily_laborer', 'farmer', 'mother', 'small_business', 'stable_salaried'
  )),
  add column mother_occupation_band text check (mother_occupation_band in (
    'unemployed', 'daily_laborer', 'farmer', 'mother', 'small_business', 'stable_salaried'
  ));

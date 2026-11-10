-- Lets the selection team manually flag a home visit as failed regardless of
-- its point score (e.g. household is ineligible for a reason the rubric
-- doesn't capture) rather than relying solely on the score > threshold rule.
alter table social_assessments
  add column if not exists manual_failed boolean not null default false;

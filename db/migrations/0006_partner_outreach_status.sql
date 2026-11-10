-- ============================================================================
-- Adds partner-relationship tracking to ngo_partners/school_partners so the
-- partner list pages can show an editable outreach status + last-contacted
-- date (mirrors a CRM-style partner table), per request.
-- ============================================================================

alter table ngo_partners
  add column outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','contacted','in_discussion','active_partner','inactive')),
  add column last_contacted_at date;

alter table school_partners
  add column outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','contacted','in_discussion','active_partner','inactive')),
  add column last_contacted_at date;

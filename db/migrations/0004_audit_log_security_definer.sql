-- ============================================================================
-- Fix: every insert/update on students, exam_results, interviews,
-- home_visits, committee_decisions, ngo_partners, school_partners, and users
-- fires trg_audit_* -> write_audit_log(), which inserts into audit_logs.
-- write_audit_log() was a plain (invoker-rights) function, so that insert ran
-- as the calling user's role and was rejected by audit_logs' RLS (which only
-- has a select policy, audit_admin_only — no insert policy for anyone).
-- Every write to an audited table failed with:
--   42501 new row violates row-level security policy for table "audit_logs"
-- Fix: mark the function security definer so the audit insert runs with the
-- privileges of the function owner (bypassing the caller's RLS), regardless
-- of who triggered it. search_path is pinned per Postgres's security-definer
-- guidance to prevent call-site search_path hijacking.
-- ============================================================================

create or replace function write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select id into v_user from users where firebase_uid = (auth.jwt() ->> 'sub');
  if (tg_op = 'INSERT') then
    insert into audit_logs(table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, new.id, 'insert', v_user, to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    insert into audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
    values (tg_table_name, new.id, case when new.deleted_at is not null and old.deleted_at is null
              then 'soft_delete' else 'update' end,
            v_user, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

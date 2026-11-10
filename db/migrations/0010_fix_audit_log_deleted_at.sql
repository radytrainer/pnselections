-- write_audit_log()'s UPDATE branch referenced new.deleted_at/old.deleted_at
-- directly. PL/pgSQL binds NEW/OLD to the triggering table's concrete row
-- type at first compile, so that field reference is resolved (and fails)
-- for every audited table that has no deleted_at column at all —
-- exam_results, interviews, home_visits, committee_decisions — breaking
-- inserts/updates on all of them with:
--   42703 record "new" has no field "deleted_at"
-- Fix: look the column up through to_jsonb()->>'deleted_at' instead of a
-- direct attribute reference. JSONB key lookup returns null for a missing
-- key rather than failing to resolve, so it works uniformly across tables
-- with and without the column.

create or replace function write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_new_deleted_at text;
  v_old_deleted_at text;
begin
  select id into v_user from users where firebase_uid = (auth.jwt() ->> 'sub');
  if (tg_op = 'INSERT') then
    insert into audit_logs(table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, new.id, 'insert', v_user, to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    v_new_deleted_at := to_jsonb(new) ->> 'deleted_at';
    v_old_deleted_at := to_jsonb(old) ->> 'deleted_at';
    insert into audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
    values (tg_table_name, new.id, case when v_new_deleted_at is not null and v_old_deleted_at is null
              then 'soft_delete' else 'update' end,
            v_user, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

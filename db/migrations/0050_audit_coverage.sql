-- Audit log coverage for the Audit Logs page (Configuration → Audit Logs).
--
-- Before: only inserts/updates on a handful of tables were recorded
-- (students, exam_results, interviews, home_visits, committee_decisions,
-- partners, users, interview questions/answers). The home-visit social form,
-- committee votes, photos/documents, cycles, roles and selection-process
-- numbers were invisible, and hard deletes (Trash → Delete forever) left no
-- trace at all.
--
-- After:
--   * every audited table logs INSERT, UPDATE and DELETE (old row kept);
--   * tables keyed by something other than `id` (stats tables by cycle_id,
--     user_roles by user_id) are supported — record_id falls back to that key;
--   * updates that change nothing except updated_at are skipped (noise).

alter table audit_logs alter column record_id drop not null;
create index if not exists idx_audit_changed_at on audit_logs (changed_at desc);
create index if not exists idx_audit_table_changed_at on audit_logs (table_name, changed_at desc);

create or replace function write_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_row jsonb;
  v_key text;
  v_record uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return null;
  end if;

  select id into v_user from users where firebase_uid = (auth.jwt() ->> 'sub');

  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_key := coalesce(v_row ->> 'id', v_row ->> 'cycle_id', v_row ->> 'user_id', v_row ->> 'student_id');
  if v_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_record := v_key::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into audit_logs (table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, v_record, 'insert', v_user, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into audit_logs (table_name, record_id, action, changed_by, old_data, new_data)
    values (
      tg_table_name, v_record,
      case when (to_jsonb(new) ->> 'deleted_at') is not null and (to_jsonb(old) ->> 'deleted_at') is null
        then 'soft_delete' else 'update' end,
      v_user, to_jsonb(old), to_jsonb(new)
    );
  else
    insert into audit_logs (table_name, record_id, action, changed_by, old_data)
    values (tg_table_name, v_record, 'delete', v_user, to_jsonb(old));
  end if;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    -- already audited (now also on delete)
    'students', 'exam_results', 'interviews', 'home_visits', 'committee_decisions',
    'ngo_partners', 'school_partners', 'users', 'interview_questions', 'interview_answers',
    -- newly audited
    'social_assessments', 'committee_ratings', 'committee_notes', 'student_documents',
    'selection_cycles', 'user_roles', 'user_ngo_link', 'interview_categories',
    'information_session_stats', 'exam_center_stats', 'exam_result_stats',
    'interview_center_stats', 'interview_result_stats'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit_%1$s on %1$I', t);
      execute format(
        'create trigger trg_audit_%1$s after insert or update or delete on %1$I
           for each row execute function write_audit_log()',
        t
      );
    end if;
  end loop;
end;
$$;

-- Backup completeness: ai_query_logs is per-user under RLS, so a super_admin
-- backup (Configuration → Backup) silently missed everyone else's rows.
-- Let super_admin read them (policies are OR'd; nothing else changes).
do $$
begin
  if to_regclass('public.ai_query_logs') is not null then
    drop policy if exists ai_query_logs_admin_select on ai_query_logs;
    create policy ai_query_logs_admin_select on ai_query_logs for select using (auth_role() = 'super_admin');
  end if;
end;
$$;

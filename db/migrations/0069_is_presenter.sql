-- Who gave the information session: PNC staff, a partner, or alumni, plus
-- their names (free text). Null on sessions created before this was asked.

alter table information_sessions add column if not exists presenter_type text
  check (presenter_type is null or presenter_type in ('pnc_staff', 'partners', 'alumni'));
alter table information_sessions add column if not exists presenter_name text
  check (presenter_name is null or length(presenter_name) <= 200);

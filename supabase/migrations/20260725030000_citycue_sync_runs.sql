-- Sync observability. Every backend-populating script (events, ticketmaster,
-- viator, places, weather) writes one row here per run.
--
-- Why this exists: four scheduled GitHub Actions already write to this project,
-- and until now a silent failure was invisible — a Ticketmaster sync that
-- 401'd for a week looked identical, from the app's side, to a quiet week in
-- Oakland. CLAUDE.md #6 ("never breaks") is only checkable if freshness is
-- recorded, not assumed.
--
-- `detail` is written deliberately by each script (a short human summary or a
-- truncated error message), never a raw dump — this table is world-readable so
-- the app can show an honest "last checked" line, and no credential, key, or
-- URL with a secret in it belongs in it.

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('events', 'ticketmaster', 'viator', 'places', 'weather')),
  status text not null check (status in ('ok', 'partial', 'failed')),
  rows_written integer not null default 0,
  rows_pruned integer not null default 0,
  duration_ms integer not null default 0,
  detail text check (char_length(detail) <= 500),
  started_at timestamptz not null,
  finished_at timestamptz not null default now()
);

alter table public.sync_runs enable row level security;

drop policy if exists "sync_runs_public_read" on public.sync_runs;
create policy "sync_runs_public_read" on public.sync_runs
  for select using (true);

create index if not exists sync_runs_job_finished_idx on public.sync_runs (job, finished_at desc);

-- Latest run per job — what a freshness read actually wants, without pulling
-- the whole history to the client. security_invoker keeps the table's own RLS
-- policy in force rather than running as the view owner.
drop view if exists public.sync_status;
create view public.sync_status
with (security_invoker = on) as
select distinct on (job)
  job,
  status,
  rows_written,
  rows_pruned,
  duration_ms,
  started_at,
  finished_at
from public.sync_runs
order by job, finished_at desc;

grant select on public.sync_status to anon, authenticated;

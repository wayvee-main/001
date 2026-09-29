-- Concierge Edge Function observability — durable counterpart to the
-- console.log lines supabase/functions/concierge/index.ts already emits.
-- Function logs in the Supabase dashboard roll off and can't be aggregated;
-- this table is what actually answers TODO.md's "measure real Edge Function
-- response latency" and "track cost-per-plan weekly" once real traffic
-- exists. Written with the service-role key from inside the function itself
-- (best-effort, never blocks or fails the guest's response — see
-- index.ts's logRun) so no client-side code writes here at all.
--
-- Deliberately holds no guest text: rawText/moodTags never appear in this
-- table, only the shape of the outcome, matching sync_runs' "short summary,
-- never a raw dump" rule.

create table if not exists public.concierge_runs (
  id bigint generated always as identity primary key,
  outcome text not null check (
    outcome in ('ok', 'no_key', 'bad_request', 'invalid_input', 'rate_limited', 'upstream_error', 'malformed_completion', 'timeout')
  ),
  model text,
  duration_ms integer not null default 0,
  attempts integer not null default 1,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  upstream_status integer,
  created_at timestamptz not null default now()
);

alter table public.concierge_runs enable row level security;

-- World-readable like sync_status: no PII in this table, and the app/eval
-- harness both need to read it without handling a secret.
drop policy if exists "concierge_runs_public_read" on public.concierge_runs;
create policy "concierge_runs_public_read" on public.concierge_runs
  for select using (true);

create index if not exists concierge_runs_created_idx on public.concierge_runs (created_at desc);

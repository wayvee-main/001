-- Learning-signal capture for the Ask concierge (TODO.md Phase 3: "Add
-- learning-signal capture: accepted / replaced / completed / abandoned /
-- rated"). An append-only log of what a guest actually did with a plan the
-- concierge built, so ranking quality can eventually be judged against real
-- outcomes instead of the 50-scenario eval set alone.
--
-- Guest-first (CLAUDE.md #5): a signed-out guest's plan still works fully —
-- src/lib/concierge/signals.ts always writes a local log first via
-- plan-history.ts's storage pattern, and only mirrors here when signed in.
-- Nothing here ever gates or degrades the concierge itself; this table is
-- read by nothing at request time, only written to, same "never breaks"
-- posture as sync_runs and concierge_runs.

create table if not exists public.concierge_signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signal text not null check (signal in ('shown', 'accepted', 'refined', 'abandoned', 'completed', 'rated')),
  -- Which stop the signal is about, when it's about one specific stop rather
  -- than the plan as a whole (shown/refined/abandoned are plan-level).
  stop_kind text check (stop_kind in ('event', 'dinner', 'nightlife')),
  ref_id text check (char_length(ref_id) <= 120),
  intent text check (char_length(intent) <= 40),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.concierge_signals enable row level security;

revoke all on public.concierge_signals from anon;

-- Append-only from the client's own point of view: a guest can log and read
-- their own signals, never edit or delete history after the fact.
grant select, insert on public.concierge_signals to authenticated;

drop policy if exists "Users log their own concierge signals" on public.concierge_signals;
create policy "Users log their own concierge signals"
  on public.concierge_signals for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read their own concierge signals" on public.concierge_signals;
create policy "Users read their own concierge signals"
  on public.concierge_signals for select to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists concierge_signals_user_created_idx on public.concierge_signals (user_id, created_at desc);

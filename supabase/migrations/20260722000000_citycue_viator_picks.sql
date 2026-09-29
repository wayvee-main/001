-- Viator affiliate picks: backend-populated real tour/experience listings,
-- pulled from Viator's Partner API by scripts/sync-viator.ts (never called
-- client-side — the API key is a partner secret, kept out of the app bundle).
-- Same pattern as public.events: the sync script is the source of truth,
-- the client just reads whatever's here.

create table if not exists public.viator_picks (
  id text primary key, -- Viator productCode
  title text not null,
  description text not null,
  image text not null,
  price_from numeric,
  currency text,
  duration_label text,
  rating numeric,
  review_count integer,
  destination text not null, -- 'Oakland' | 'East Bay' | 'San Francisco' | 'Napa Valley'
  booking_url text not null, -- productUrl with pid/mcid/campaign tracking params appended
  updated_at timestamptz not null default now()
);

alter table public.viator_picks enable row level security;

drop policy if exists "viator_picks_public_read" on public.viator_picks;
create policy "viator_picks_public_read" on public.viator_picks
  for select using (true);

create index if not exists viator_picks_destination_idx on public.viator_picks (destination);

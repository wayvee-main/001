-- CityCue events: backend-populated event listings (see DATA.md).
-- The app bundles a snapshot of these rows and overlays whatever this table
-- returns at runtime, so the table can be updated without a redeploy.

create table if not exists public.events (
  id text primary key,
  starts_at timestamptz not null,
  name text not null,
  time_label text not null,
  price_label text not null,
  travel text not null,
  vibe_tags text[] not null default '{}',
  cats text[] not null default '{}',
  date_label text not null,
  venue text not null,
  venue_id text,
  addr text not null,
  lineup text not null,
  know text not null,
  price_from text not null,
  all_in text not null,
  ticketed boolean not null default false,
  ticket_url text,
  ticket_provider text,
  source_url text not null,
  verified_label text not null,
  image text not null,
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events
  for select using (true);

create index if not exists events_starts_at_idx on public.events (starts_at);

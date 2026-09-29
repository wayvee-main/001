-- Wayvee — initial schema.
--
-- Squashed from the 17 CityCue migrations, plus the city dimension that the
-- old schema never had. Paste this whole file into the Supabase SQL Editor of
-- a NEW project and run it once.
--
-- What changed versus the CityCue schema:
--   * public.cities is new. It holds the per-city config that used to be
--     hardcoded in five separate script constants (weather anchor, places
--     bbox, viator destination priority, timezone). Adding a city is now an
--     INSERT, not a code change.
--   * events / places / weather_hourly / viator_picks / sync_runs all carry a
--     `city` FK. Without it, each sync script's prune step would delete every
--     other city's rows on the next run.
--   * weather_hourly's primary key moves from (starts_at) to (city, starts_at).
--     Two cities share the same clock hour, so the old PK would collide.
--   * user_preferences.city records the guest's active city.
--   * The incremental `alter table ... add column` steps from the migration
--     history are folded into the create statements.
--   * The `city` columns carry `default 'oakland'` on purpose: it lets the
--     CURRENT sync scripts, which know nothing about cities, write to this
--     schema unmodified. Drop the default once they pass a city explicitly.
--   * The auth.users backfill is dropped — a new project has no prior users.

-- ---------------------------------------------------------------------------
-- Cities
-- ---------------------------------------------------------------------------

create table if not exists public.cities (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  name text not null,
  region text,
  timezone text not null,

  -- Weather sync anchor point (scripts/sync-weather.ts).
  anchor_lat double precision not null,
  anchor_lon double precision not null,

  -- Places sync bounding box (scripts/sync-places.ts).
  bbox_min_lat double precision not null,
  bbox_min_lon double precision not null,
  bbox_max_lat double precision not null,
  bbox_max_lon double precision not null,

  -- Ordered Viator destination priority (src/lib/viator.ts DESTINATION_PRIORITY).
  viator_destinations text[] not null default '{}',

  -- Gate: syncs and the city picker only consider launched cities.
  launched boolean not null default false,
  created_at timestamptz not null default now(),

  constraint cities_bbox_ordered check (
    bbox_min_lat < bbox_max_lat and bbox_min_lon < bbox_max_lon
  )
);

alter table public.cities enable row level security;

drop policy if exists "cities_public_read" on public.cities;
create policy "cities_public_read" on public.cities
  for select using (true);

create index if not exists cities_launched_idx on public.cities (launched);

-- The greater San Francisco Bay. Bounding boxes are deliberately tight around
-- each city's built-up area rather than its legal limits: the places sync
-- queries Overture and Overpass by bbox, and a box drawn around a whole county
-- pulls in thousands of rows nobody will ever be shown.
--
-- `launched` gates the syncs, so a city here is inert until it is flipped on.
--
-- Only Oakland is launched, and that is a client limitation rather than a
-- backend one. The app does not yet filter its catalog reads by city:
-- src/lib/places.ts, events-remote.ts, viator.ts and weather.ts all select
-- without a city predicate, and events merge by id into the bundled Oakland
-- catalog. Launching a second city today would interleave two cities into one
-- undifferentiated feed — and, for weather, two readings for the same hour.
--
-- Flip a city on once the client picks an active city and filters on it.
-- Nothing else here needs to change: the syncs already run per launched city.
--
-- viator_destinations are Viator's own destination names, not free text. The
-- two below are known-good; verify any you add against Viator's destination
-- taxonomy or that city's Viator sync will quietly return nothing.
insert into public.cities (
  slug, name, region, timezone,
  anchor_lat, anchor_lon,
  bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,
  viator_destinations, launched
) values
  ('san-francisco', 'San Francisco', 'CA', 'America/Los_Angeles',
   37.7749, -122.4194, 37.700, -122.520, 37.840, -122.350,
   array['San Francisco', 'Napa'], false),

  ('oakland', 'Oakland', 'CA', 'America/Los_Angeles',
   37.8032, -122.2716, 37.705, -122.335, 37.875, -122.110,
   array['Oakland & East Bay', 'San Francisco', 'Napa'], true),

  ('berkeley', 'Berkeley', 'CA', 'America/Los_Angeles',
   37.8715, -122.2730, 37.840, -122.330, 37.910, -122.230,
   array['Oakland & East Bay'], false),

  ('san-jose', 'San Jose', 'CA', 'America/Los_Angeles',
   37.3382, -121.8863, 37.210, -122.020, 37.450, -121.730,
   array['San Jose'], false),

  ('palo-alto', 'Palo Alto', 'CA', 'America/Los_Angeles',
   37.4419, -122.1430, 37.390, -122.200, 37.480, -122.090,
   array[]::text[], false),

  ('san-mateo', 'San Mateo', 'CA', 'America/Los_Angeles',
   37.5630, -122.3255, 37.510, -122.380, 37.610, -122.260,
   array[]::text[], false),

  ('walnut-creek', 'Walnut Creek', 'CA', 'America/Los_Angeles',
   37.9101, -122.0652, 37.860, -122.110, 37.960, -122.000,
   array['Oakland & East Bay'], false),

  ('napa', 'Napa', 'CA', 'America/Los_Angeles',
   38.2975, -122.2869, 38.240, -122.350, 38.360, -122.220,
   array['Napa'], false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Account-owned tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Guest' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  taste_tags text[] not null default '{}',
  dismissed_insight_keys text[] not null default '{}',
  preferred_delivery_provider text not null default 'Uber Eats',

  -- The guest's active city. Null means "not chosen yet"; the client falls
  -- back to its default rather than assuming.
  city text references public.cities(slug) on delete set null,

  -- Optional, guest-entered stay context. Free text, never a hotel database.
  stay_property_name text check (char_length(stay_property_name) <= 120),
  stay_check_in date,
  stay_check_out date,

  -- Trip pacing + budget (the Create tab's pickers). Null = not chosen yet.
  pace_preference text check (pace_preference in ('Relaxed', 'Packed')),
  budget_preference text check (budget_preference in ('$', '$$', '$$$')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('event', 'restaurant', 'venue', 'night', 'crawl', 'pick')),
  item_id text not null check (char_length(item_id) between 1 and 120),
  city text references public.cities(slug) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_kind, item_id)
);

create table if not exists public.venue_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id text not null check (char_length(venue_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table if not exists public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_kind text not null check (place_kind in ('restaurant', 'venue', 'place', 'night')),
  place_id text not null check (char_length(place_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, place_kind, place_id)
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_plans enable row level security;
alter table public.venue_follows enable row level security;
alter table public.saved_places enable row level security;

revoke all on public.profiles from anon;
revoke all on public.user_preferences from anon;
revoke all on public.user_plans from anon;
revoke all on public.venue_follows from anon;
revoke all on public.saved_places from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert, update, delete on public.user_plans to authenticated;
grant select, insert, update, delete on public.venue_follows to authenticated;
grant select, insert, update, delete on public.saved_places to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users read their own preferences" on public.user_preferences;
create policy "Users read their own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own preferences" on public.user_preferences;
create policy "Users create their own preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own preferences" on public.user_preferences;
create policy "Users update their own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own plans" on public.user_plans;
create policy "Users manage their own plans"
  on public.user_plans for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own venue follows" on public.venue_follows;
create policy "Users manage their own venue follows"
  on public.venue_follows for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own saved places" on public.saved_places;
create policy "Users manage their own saved places"
  on public.saved_places for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

-- left(..., 80) guards against unusually long OAuth metadata overflowing the
-- display_name check constraint.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    ),
    80
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    resolved_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catalog: events
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id text primary key,
  city text not null default 'oakland' references public.cities(slug) on delete cascade,
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
  -- Provenance, so each sync prunes only the rows it owns.
  source text not null default 'curated' check (source in ('curated', 'ticketmaster')),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events
  for select using (true);

create index if not exists events_city_starts_at_idx on public.events (city, starts_at);
create index if not exists events_city_source_idx on public.events (city, source);

-- ---------------------------------------------------------------------------
-- Catalog: viator_picks
-- ---------------------------------------------------------------------------

create table if not exists public.viator_picks (
  id text primary key, -- Viator productCode
  city text not null default 'oakland' references public.cities(slug) on delete cascade,
  title text not null,
  description text not null,
  image text not null,
  price_from numeric,
  currency text,
  duration_label text,
  rating numeric,
  review_count integer,
  destination text not null,
  booking_url text not null,
  free_cancellation boolean,
  flags text[],
  inclusions text[],
  availability_dates text[], -- ISO yyyy-mm-dd, next bookable dates
  updated_at timestamptz not null default now()
);

alter table public.viator_picks enable row level security;

drop policy if exists "viator_picks_public_read" on public.viator_picks;
create policy "viator_picks_public_read" on public.viator_picks
  for select using (true);

create index if not exists viator_picks_city_destination_idx on public.viator_picks (city, destination);

-- ---------------------------------------------------------------------------
-- Catalog: places
-- ---------------------------------------------------------------------------

create table if not exists public.places (
  id text primary key,
  city text not null default 'oakland' references public.cities(slug) on delete cascade,
  name text not null,
  category text not null,
  address text,
  lat double precision not null,
  lon double precision not null,
  website text,
  phone text,
  image text,
  cuisine text,
  -- Verbatim OpenStreetMap opening_hours tag. Never synthesized — null means
  -- the source has no hours for this place.
  opening_hours text,
  confidence text not null default 'single_source',
  needs_review boolean not null default false,
  source_overture_id text,
  source_osm_id text,
  synced_at timestamptz not null default now()
);

alter table public.places enable row level security;

drop policy if exists "places_public_read" on public.places;
create policy "places_public_read" on public.places
  for select using (true);

create index if not exists places_city_category_idx on public.places (city, category);
create index if not exists places_city_cuisine_idx on public.places (city, cuisine);
create index if not exists places_city_synced_idx on public.places (city, synced_at);

comment on column public.places.opening_hours is
  'Verbatim OpenStreetMap opening_hours tag. Never synthesized — null means the source has no hours for this place.';

-- ---------------------------------------------------------------------------
-- Catalog: weather_hourly
-- ---------------------------------------------------------------------------
-- Primary key is (city, starts_at): two cities share the same clock hour, so
-- starts_at alone would collide as soon as a second city launches.

create table if not exists public.weather_hourly (
  city text not null default 'oakland' references public.cities(slug) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  temperature_f integer not null,
  short_forecast text not null,
  precip_probability integer check (precip_probability between 0 and 100),
  wind_label text,
  is_daytime boolean not null,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  primary key (city, starts_at)
);

alter table public.weather_hourly enable row level security;

drop policy if exists "weather_hourly_public_read" on public.weather_hourly;
create policy "weather_hourly_public_read" on public.weather_hourly
  for select using (true);

create index if not exists weather_hourly_city_starts_idx on public.weather_hourly (city, starts_at);

-- ---------------------------------------------------------------------------
-- Observability: sync_runs + sync_status
-- ---------------------------------------------------------------------------
-- `detail` is a short human summary or truncated error, never a raw dump —
-- this table is world-readable, so no credential or secret-bearing URL goes in.

create table if not exists public.sync_runs (
  id bigint generated always as identity primary key,
  job text not null check (job in ('events', 'ticketmaster', 'viator', 'places', 'weather')),
  city text references public.cities(slug) on delete cascade,
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

create index if not exists sync_runs_job_city_finished_idx on public.sync_runs (job, city, finished_at desc);

-- Latest run per (job, city). security_invoker keeps the table's own RLS in
-- force rather than running as the view owner.
drop view if exists public.sync_status;
create view public.sync_status
with (security_invoker = on) as
select distinct on (job, city)
  job,
  city,
  status,
  rows_written,
  rows_pruned,
  duration_ms,
  started_at,
  finished_at
from public.sync_runs
order by job, city, finished_at desc;

grant select on public.sync_status to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Observability: concierge_runs
-- ---------------------------------------------------------------------------
-- Holds no guest text — only the shape of the outcome.

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

drop policy if exists "concierge_runs_public_read" on public.concierge_runs;
create policy "concierge_runs_public_read" on public.concierge_runs
  for select using (true);

create index if not exists concierge_runs_created_idx on public.concierge_runs (created_at desc);

-- ---------------------------------------------------------------------------
-- Learning signals
-- ---------------------------------------------------------------------------
-- Append-only from the client's point of view: a guest logs and reads their
-- own signals, never edits history after the fact.

create table if not exists public.concierge_signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signal text not null check (signal in ('shown', 'accepted', 'refined', 'abandoned', 'completed', 'rated')),
  stop_kind text check (stop_kind in ('event', 'dinner', 'nightlife')),
  ref_id text check (char_length(ref_id) <= 120),
  intent text check (char_length(intent) <= 40),
  city text references public.cities(slug) on delete set null,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.concierge_signals enable row level security;

revoke all on public.concierge_signals from anon;

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

-- Wayvee account-owned data. Run with `supabase db push` or paste this file
-- into the Supabase SQL Editor once for an existing hosted project.

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (char_length(event_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.venue_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id text not null check (char_length(venue_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table if not exists public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_kind text not null check (place_kind in ('restaurant', 'venue')),
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Guest'
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

-- Backfill rows for users created before this migration.
insert into public.profiles (id, display_name, avatar_url)
select
  id,
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Guest'
  ),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;
-- Keep profile creation resilient to unusually long OAuth metadata and prevent
-- direct RPC execution of functions intended only for database triggers.

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

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
-- Wayvee events: backend-populated event listings (see DATA.md).
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
-- Optional, guest-entered stay context (property name + dates), used to power
-- "night X of Y" framing on Home. Free text, never a curated hotel database â€”
-- Wayvee has no affiliation with any specific hotel brand. Always skippable;
-- null columns just mean no stay is linked yet.

alter table public.user_preferences
  add column if not exists stay_property_name text check (char_length(stay_property_name) <= 120),
  add column if not exists stay_check_in date,
  add column if not exists stay_check_out date;
-- Viator affiliate picks: backend-populated real tour/experience listings,
-- pulled from Viator's Partner API by scripts/sync-viator.ts (never called
-- client-side â€” the API key is a partner secret, kept out of the app bundle).
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
-- Real per-product detail: inclusions/cancellation/flags from Viator's
-- /products/{code} endpoint, and next bookable dates from
-- /availability/schedules/{code} â€” both non-transactional, so available
-- to the Affiliate Partner API tier this app uses. Populated by the same
-- scripts/sync-viator.ts run that fills the base row; never fabricated
-- client-side. Booking (and any per-date/per-guest exact pricing) still
-- happens on viator.com.

alter table public.viator_picks
  add column if not exists free_cancellation boolean,
  add column if not exists flags text[],
  add column if not exists inclusions text[],
  add column if not exists availability_dates text[]; -- ISO yyyy-mm-dd, next bookable dates
-- Bulk-sourced restaurants/bars/venues from open geodata (Overture Maps +
-- OpenStreetMap), pulled by scripts/sync-places.ts. Same "sync script writes,
-- client just reads" pattern as public.viator_picks and public.events â€”
-- no scraping of Yelp/Google, both sources are explicitly licensed for
-- commercial use (Overture: CDLA-Permissive-2.0, OSM: ODbL).
--
-- This is intentionally a thinner record than public restaurant data curated
-- by hand elsewhere in the app (see src/lib/data.ts) â€” no menus, no photos in
-- most cases, no editorial copy. confidence/needs_review exist so the UI and
-- any future manual QC pass can tell a cross-confirmed record apart from a
-- single-source one instead of presenting both with equal certainty.

create table if not exists public.places (
  id text primary key, -- stable synthetic id, see scripts/sync-places.ts
  name text not null,
  category text not null, -- normalized: 'restaurant' | 'bar' | 'night_club' | 'cafe' | 'brewery' | 'bakery' | 'pub' | 'wine_bar' | 'other'
  address text,
  lat double precision not null,
  lon double precision not null,
  website text,
  phone text,
  image text, -- rare â€” only populated when OSM's wikimedia_commons/image tag has one
  confidence text not null default 'single_source', -- 'cross_confirmed' | 'overture_only' | 'osm_only'
  needs_review boolean not null default false, -- the two sources disagreed on something worth a human look
  source_overture_id text,
  source_osm_id text,
  synced_at timestamptz not null default now()
);

alter table public.places enable row level security;

drop policy if exists "places_public_read" on public.places;
create policy "places_public_read" on public.places
  for select using (true);

create index if not exists places_category_idx on public.places (category);
-- Cuisine is a separate, orthogonal dimension from category (a "restaurant"
-- can be Thai, Ethiopian, Mexican, etc.; a "bar" or "cafe" usually has none).
-- Nullable â€” omitted rather than guessed when neither source tags it.
alter table public.places add column if not exists cuisine text;

create index if not exists places_cuisine_idx on public.places (cuisine);
-- Widens saved_places to cover places directory entries and nightlife spots,
-- not just curated restaurants/venues â€” the client now surfaces a Save
-- action on those detail screens too (events already have their own
-- user_plans table, so 'event' intentionally stays out of this constraint).
alter table public.saved_places drop constraint if exists saved_places_place_kind_check;
alter table public.saved_places add constraint saved_places_place_kind_check
  check (place_kind in ('restaurant', 'venue', 'place', 'night'));
-- Trip pacing + budget preferences (Create tab's "Plan my stay" pickers),
-- synced across devices once signed in. Same fixed option sets already
-- shown in src/app/(tabs)/create.tsx â€” not a new vocabulary. Null columns
-- just mean the guest hasn't chosen yet, so the UI falls back to its
-- existing defaults (Relaxed / $$).

alter table public.user_preferences
  add column if not exists pace_preference text check (pace_preference in ('Relaxed', 'Packed')),
  add column if not exists budget_preference text check (budget_preference in ('$', '$$', '$$$'));
-- Ticketmaster as a second event source (see DATA.md).
--
-- Rows in public.events now record their provenance so each sync script prunes
-- only the rows it owns: sync-events.ts owns 'curated' (the hand-verified
-- bundle in src/lib/events.ts), sync-ticketmaster.ts owns 'ticketmaster'.
-- Without this split, whichever script ran last would delete the other's rows.
-- Every pre-existing row came from the curated bundle, so the default is right.

alter table public.events
  add column if not exists source text not null default 'curated';

alter table public.events
  drop constraint if exists events_source_check;

alter table public.events
  add constraint events_source_check check (source in ('curated', 'ticketmaster'));

create index if not exists events_source_idx on public.events (source);
-- Machine-readable opening hours for the bulk places directory.
--
-- "Right now is live" (CLAUDE.md #3) names open-now as a first-class signal,
-- but until now nothing in the backend carried hours in a form code could read:
-- the curated catalog in src/lib/data.ts stores prose ("Lunch and dinner
-- daily") and public.places stored nothing at all. OpenStreetMap tags real
-- hours on a good share of Oakland food/drink venues, so this column carries
-- OSM's `opening_hours` value **verbatim** â€” never normalized, never guessed,
-- never back-filled from a category default.
--
-- Nullable on purpose: a place with no OSM hours tag stays null, and the client
-- renders "Hours not listed" rather than an assumed schedule (CLAUDE.md, no
-- invented data). src/lib/hours.ts parses the common subset of the syntax and
-- returns "unknown" for anything it cannot read with certainty.

alter table public.places add column if not exists opening_hours text;

comment on column public.places.opening_hours is
  'Verbatim OpenStreetMap opening_hours tag (https://wiki.openstreetmap.org/wiki/Key:opening_hours). Never synthesized â€” null means the source has no hours for this place.';
-- Hourly weather for the Downtown Oakland anchor, from the US National Weather
-- Service API (api.weather.gov â€” public domain, no key, no rate-limit tier).
-- Populated by scripts/sync-weather.ts; same "sync script writes, client just
-- reads" pattern as public.events / public.places / public.viator_picks.
--
-- Why the backend and not a client fetch:
--   * CLAUDE.md #6 â€” the client never depends on a third-party host being up.
--     A stale row is still a real, attributable forecast; a failed client fetch
--     would be a blank spot in the UI on every cold launch.
--   * One shared fetch per hour for every guest instead of one per device, which
--     is also what api.weather.gov's usage guidance asks for.
--
-- Rows are the NWS forecast periods themselves, unaltered: no averaging across
-- periods, no derived "feels like" the source didn't publish, no icon guessing.
-- Anything NWS omits stays null.

create table if not exists public.weather_hourly (
  starts_at timestamptz primary key,
  ends_at timestamptz not null,
  temperature_f integer not null,
  short_forecast text not null, -- NWS `shortForecast`, e.g. 'Partly Cloudy'
  precip_probability integer check (precip_probability between 0 and 100),
  wind_label text, -- NWS `windSpeed` string, e.g. '10 mph'
  is_daytime boolean not null,
  source_url text not null, -- the exact forecastHourly endpoint this row came from
  fetched_at timestamptz not null default now()
);

alter table public.weather_hourly enable row level security;

drop policy if exists "weather_hourly_public_read" on public.weather_hourly;
create policy "weather_hourly_public_read" on public.weather_hourly
  for select using (true);
-- Sync observability. Every backend-populating script (events, ticketmaster,
-- viator, places, weather) writes one row here per run.
--
-- Why this exists: four scheduled GitHub Actions already write to this project,
-- and until now a silent failure was invisible â€” a Ticketmaster sync that
-- 401'd for a week looked identical, from the app's side, to a quiet week in
-- Oakland. CLAUDE.md #6 ("never breaks") is only checkable if freshness is
-- recorded, not assumed.
--
-- `detail` is written deliberately by each script (a short human summary or a
-- truncated error message), never a raw dump â€” this table is world-readable so
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

-- Latest run per job â€” what a freshness read actually wants, without pulling
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
-- Concierge Edge Function observability â€” durable counterpart to the
-- console.log lines supabase/functions/concierge/index.ts already emits.
-- Function logs in the Supabase dashboard roll off and can't be aggregated;
-- this table is what actually answers TODO.md's "measure real Edge Function
-- response latency" and "track cost-per-plan weekly" once real traffic
-- exists. Written with the service-role key from inside the function itself
-- (best-effort, never blocks or fails the guest's response â€” see
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
-- Learning-signal capture for the Ask concierge (TODO.md Phase 3: "Add
-- learning-signal capture: accepted / replaced / completed / abandoned /
-- rated"). An append-only log of what a guest actually did with a plan the
-- concierge built, so ranking quality can eventually be judged against real
-- outcomes instead of the 50-scenario eval set alone.
--
-- Guest-first (CLAUDE.md #5): a signed-out guest's plan still works fully â€”
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
-- Widens user_plans to cover restaurant/venue/night/crawl/pick pins, not just
-- events â€” every detail screen now offers "Add to plan", not only events â€”
-- same shape as saved_places_kinds (place_kind, place_id) so the client uses
-- one serialization idiom (`${kind}:${id}`) across saves and plans alike.
alter table public.user_plans add column if not exists item_kind text;
alter table public.user_plans add column if not exists item_id text;

update public.user_plans set item_kind = 'event', item_id = event_id where item_kind is null;

alter table public.user_plans alter column item_kind set not null;
alter table public.user_plans alter column item_id set not null;

alter table public.user_plans add constraint user_plans_item_kind_check
  check (item_kind in ('event', 'restaurant', 'venue', 'night', 'crawl', 'pick'));
alter table public.user_plans add constraint user_plans_item_id_length_check
  check (char_length(item_id) between 1 and 120);

alter table public.user_plans drop constraint user_plans_pkey;
alter table public.user_plans add primary key (user_id, item_kind, item_id);

alter table public.user_plans drop column event_id;

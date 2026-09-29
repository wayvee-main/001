-- Hourly weather for the Downtown Oakland anchor, from the US National Weather
-- Service API (api.weather.gov — public domain, no key, no rate-limit tier).
-- Populated by scripts/sync-weather.ts; same "sync script writes, client just
-- reads" pattern as public.events / public.places / public.viator_picks.
--
-- Why the backend and not a client fetch:
--   * CLAUDE.md #6 — the client never depends on a third-party host being up.
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

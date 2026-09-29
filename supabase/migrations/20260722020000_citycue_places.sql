-- Bulk-sourced restaurants/bars/venues from open geodata (Overture Maps +
-- OpenStreetMap), pulled by scripts/sync-places.ts. Same "sync script writes,
-- client just reads" pattern as public.viator_picks and public.events —
-- no scraping of Yelp/Google, both sources are explicitly licensed for
-- commercial use (Overture: CDLA-Permissive-2.0, OSM: ODbL).
--
-- This is intentionally a thinner record than public restaurant data curated
-- by hand elsewhere in the app (see src/lib/data.ts) — no menus, no photos in
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
  image text, -- rare — only populated when OSM's wikimedia_commons/image tag has one
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

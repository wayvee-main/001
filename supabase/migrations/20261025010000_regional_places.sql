-- Regional collection is independent of launched cities and the capped places
-- catalog. Nothing in this migration changes or prunes either existing table.
create table if not exists public.regional_places (
  id text primary key,
  region text not null default 'sf-bay-area' check (region = 'sf-bay-area'),
  city text not null default 'sf-bay-area',
  county text,
  name text not null check (length(name) between 1 and 300),
  category text not null,
  cuisine text,
  address text,
  lat double precision not null check (lat between 36.8 and 39.0),
  lon double precision not null check (lon between -123.7 and -121.0),
  website text,
  phone text,
  image text,
  opening_hours text,
  confidence text not null default 'osm_only',
  needs_review boolean not null default false,
  detail_content jsonb,
  source_overture_id text,
  source_osm_id text,
  source_osm_ids text[] not null default '{}',
  source_url text,
  source_license text,
  source_data_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.regional_places enable row level security;
create policy regional_places_public_read on public.regional_places for select using (true);
revoke all on public.regional_places from anon, authenticated;
grant select on public.regional_places to anon, authenticated;
grant all on public.regional_places to service_role;
create index if not exists regional_places_lat_lon_idx on public.regional_places (lat, lon);
create index if not exists regional_places_lon_lat_idx on public.regional_places (lon, lat);
create index if not exists regional_places_osm_ids_idx on public.regional_places using gin (source_osm_ids);
create index if not exists regional_places_county_idx on public.regional_places (county, category);
comment on table public.regional_places is 'Source-backed regional identity pool. Collection coverage does not launch city catalogs. No automatic pruning.';
comment on column public.regional_places.city is 'Source locality slug, retained catalog city, or sf-bay-area when no locality was published; not a launched-city foreign key.';
comment on column public.regional_places.source_osm_ids is 'Typed OSM aliases such as node/123 and way/123. Numeric IDs alone are ambiguous across OSM element types.';
comment on column public.regional_places.opening_hours is 'Verbatim published OSM opening_hours; never inferred.';

create table if not exists public.regional_collection_batches (
  id text primary key,
  region text not null default 'sf-bay-area' check (region = 'sf-bay-area'),
  county text not null,
  min_lat double precision not null,
  min_lon double precision not null,
  max_lat double precision not null,
  max_lon double precision not null,
  priority integer not null default 20,
  depth integer not null default 0 check (depth between 0 and 4),
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed', 'split')),
  attempts integer not null default 0,
  place_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_completed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  check (min_lat < max_lat and min_lon < max_lon)
);
alter table public.regional_collection_batches enable row level security;
revoke all on public.regional_collection_batches from anon, authenticated;
grant all on public.regional_collection_batches to service_role;
create index if not exists regional_batches_due_idx on public.regional_collection_batches (next_attempt_at, priority) where status <> 'split';

create table if not exists public.regional_collection_runs (
  id bigint generated always as identity primary key,
  region text not null default 'sf-bay-area',
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'partial', 'failed')),
  source_requests integer not null default 0,
  source_bytes bigint not null default 0,
  batches_completed integer not null default 0,
  rows_written integer not null default 0,
  detail text
);
alter table public.regional_collection_runs enable row level security;
revoke all on public.regional_collection_runs from anon, authenticated;
grant all on public.regional_collection_runs to service_role;
grant usage, select on sequence public.regional_collection_runs_id_seq to service_role;

-- Only collector-supplied identity fields are accepted. This write path cannot
-- erase detail_content, venue photos, source aliases, or existing nonnull goods.
create or replace function public.upsert_regional_places(p_rows jsonb)
returns integer language plpgsql set search_path = '' as $$
declare written integer;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'p_rows must be an array of at most 500 identities' using errcode = '22023';
  end if;
  insert into public.regional_places as current (
    id, name, category, cuisine, address, lat, lon, website, phone,
    opening_hours, confidence, needs_review, city, county, source_osm_id,
    source_osm_ids, source_url, source_license, source_data_at, synced_at
  )
  select x.id, x.name, x.category, x.cuisine, x.address, x.lat, x.lon,
    x.website, x.phone, x.opening_hours, coalesce(x.confidence, 'osm_only'),
    coalesce(x.needs_review, false), coalesce(x.city, 'sf-bay-area'), x.county,
    x.source_osm_id, coalesce(x.source_osm_ids, '{}'), x.source_url,
    'ODbL-1.0', x.source_data_at, coalesce(x.synced_at, now())
  from jsonb_to_recordset(p_rows) as x(
    id text, name text, category text, cuisine text, address text,
    lat double precision, lon double precision, website text, phone text,
    opening_hours text, confidence text, needs_review boolean, city text,
    county text, source_osm_id text, source_osm_ids text[], source_url text,
    source_data_at timestamptz, synced_at timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    category = excluded.category,
    cuisine = coalesce(excluded.cuisine, current.cuisine),
    address = coalesce(excluded.address, current.address),
    lat = excluded.lat, lon = excluded.lon,
    website = coalesce(excluded.website, current.website),
    phone = coalesce(excluded.phone, current.phone),
    opening_hours = coalesce(excluded.opening_hours, current.opening_hours),
    confidence = case when current.source_overture_id is not null then 'cross_confirmed' else excluded.confidence end,
    needs_review = current.needs_review or excluded.needs_review,
    city = case when excluded.city = 'sf-bay-area' then current.city else excluded.city end,
    county = coalesce(excluded.county, current.county),
    source_osm_id = coalesce(current.source_osm_id, excluded.source_osm_id),
    source_osm_ids = array(select distinct unnest(current.source_osm_ids || excluded.source_osm_ids)),
    source_url = coalesce(excluded.source_url, current.source_url),
    source_license = case when current.source_overture_id is not null then 'CDLA-Permissive-2.0; ODbL-1.0' else excluded.source_license end,
    source_data_at = excluded.source_data_at,
    synced_at = excluded.synced_at;
  get diagnostics written = row_count;
  return written;
end;
$$;
revoke all on function public.upsert_regional_places(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_regional_places(jsonb) to service_role;

-- A POST body avoids long REST URLs when matching thousands of typed aliases.
-- Bounding candidates and aliases are paged, so cross-tile duplicates and moved
-- source IDs can retain their original canonical ID without fetching the pool.
create or replace function public.regional_identity_candidates(
  p_bounds jsonb, p_source_ids text[], p_offset integer default 0
)
returns table (
  id text, name text, category text, address text, lat double precision,
  lon double precision, website text, phone text, city text,
  source_osm_id text, source_osm_ids text[], source_overture_id text,
  needs_review boolean
)
language plpgsql stable set search_path = '' as $$
begin
  if p_source_ids is null or cardinality(p_source_ids) > 4000
    or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'Invalid identity candidate page' using errcode = '22023';
  end if;
  return query
    select r.id, r.name, r.category, r.address, r.lat, r.lon, r.website,
      r.phone, r.city, r.source_osm_id, r.source_osm_ids, r.source_overture_id,
      r.needs_review
    from public.regional_places r
    where (r.lat between (p_bounds->>'min_lat')::double precision and (p_bounds->>'max_lat')::double precision
      and r.lon between (p_bounds->>'min_lon')::double precision and (p_bounds->>'max_lon')::double precision)
      or r.source_osm_ids && p_source_ids
    order by r.id limit 1000 offset p_offset;
end;
$$;
revoke all on function public.regional_identity_candidates(jsonb, text[], integer) from public, anon, authenticated;
grant execute on function public.regional_identity_candidates(jsonb, text[], integer) to service_role;

-- Re-running this seed copies newly verified goods, without changing the old
-- catalog or overwriting richer regional content with nulls.
create or replace function public.seed_regional_places_from_catalog()
returns integer language plpgsql set search_path = '' as $$
declare written integer;
begin
  insert into public.regional_places as current (
    id, city, name, category, cuisine, address, lat, lon, website, phone, image,
    opening_hours, confidence, needs_review, detail_content, source_overture_id,
    source_osm_id, source_license, synced_at
  )
  select p.id, p.city, p.name, p.category, p.cuisine, p.address, p.lat, p.lon,
    p.website, p.phone, p.image, p.opening_hours, p.confidence, p.needs_review,
    p.detail_content, p.source_overture_id, p.source_osm_id,
    case when p.source_overture_id is not null and p.source_osm_id is not null then 'CDLA-Permissive-2.0; ODbL-1.0'
      when p.source_overture_id is not null then 'CDLA-Permissive-2.0' else 'ODbL-1.0' end,
    p.synced_at
  from public.places p
  where p.lat between 36.8 and 39.0 and p.lon between -123.7 and -121.0
  on conflict (id) do update set
    image = coalesce(current.image, excluded.image),
    detail_content = coalesce(current.detail_content, excluded.detail_content)
  where (current.image is null and excluded.image is not null)
    or (current.detail_content is null and excluded.detail_content is not null);
  get diagnostics written = row_count;
  return written;
end;
$$;
revoke all on function public.seed_regional_places_from_catalog() from public, anon, authenticated;
grant execute on function public.seed_regional_places_from_catalog() to service_role;

-- Invoker security retains the public table's read policy. No query locations
-- are written to a table or collector log. Stable ordering supports pagination.
create or replace function public.nearby_regional_places(
  p_lat double precision,
  p_lon double precision,
  p_radius_miles double precision default 5,
  p_limit integer default 80,
  p_offset integer default 0
)
returns table (
  id text, name text, category text, cuisine text, address text,
  lat double precision, lon double precision, website text, phone text,
  image text, opening_hours text, confidence text, needs_review boolean,
  detail_content jsonb, city text, distance_miles double precision
)
language plpgsql stable set search_path = '' as $$
declare lat_pad double precision; lon_pad double precision;
begin
  if p_lat is null or not (p_lat between -90 and 90)
    or p_lon is null or not (p_lon between -180 and 180)
    or p_radius_miles is null or not (p_radius_miles between 0.25 and 25)
    or p_limit is null or p_limit not between 1 and 200
    or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'Invalid coordinates, radius (0.25-25), limit (1-200), or offset (0-10000)' using errcode = '22023';
  end if;
  lat_pad := p_radius_miles / 69.0;
  -- Use the most poleward bounding latitude for a conservative longitude box.
  lon_pad := least(180.0, p_radius_miles / (69.0 * greatest(0.000001, cos(radians(least(89.9999, abs(p_lat) + lat_pad))))));
  return query
    select q.id, q.name, q.category, q.cuisine, q.address, q.lat, q.lon,
      q.website, q.phone, q.image, q.opening_hours, q.confidence,
      q.needs_review, q.detail_content, q.city, q.distance_miles
    from (
      select r.*, 2 * 3958.7613 * asin(sqrt(least(1.0,
        power(sin(radians(r.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lon - p_lon) / 2), 2)
      ))) as distance_miles
      from public.regional_places r
      where not r.needs_review
        and r.lat between p_lat - lat_pad and p_lat + lat_pad
        and r.lon between p_lon - lon_pad and p_lon + lon_pad
    ) q
    where q.distance_miles <= p_radius_miles
    order by q.distance_miles, q.id
    limit p_limit offset p_offset;
end;
$$;
revoke all on function public.nearby_regional_places(double precision, double precision, double precision, integer, integer) from public;
grant execute on function public.nearby_regional_places(double precision, double precision, double precision, integer, integer) to anon, authenticated, service_role;

-- Safe initial copy; collection can continue independently after deployment.
select public.seed_regional_places_from_catalog();
notify pgrst, 'reload schema';

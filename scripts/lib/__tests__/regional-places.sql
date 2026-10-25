-- Run after migrations in a disposable PostgreSQL/Supabase development DB.
-- The enclosing transaction leaves no fixture records behind.
begin;

insert into public.regional_places
  (id, name, category, lat, lon, image, detail_content, source_osm_ids)
values
  ('test:regional:rich', 'Regional Test Cafe', 'cafe', 37.77, -122.42,
    'https://cafe.example/owned.jpg', '{"version":1,"menu":{"items":[{"name":"Soup"}]}}', array['node/111']),
  ('test:regional:second', 'Regional Test Park', 'park', 37.7701, -122.42, null, null, '{}'),
  ('test:regional:far', 'Regional Test Museum', 'museum', 37.80, -122.42, null, null, '{}');
insert into public.regional_places (id, name, category, lat, lon, needs_review)
values ('test:regional:review', 'Needs review', 'cafe', 37.77, -122.42, true);

do $$
declare found text[]; result integer;
begin
  if not has_table_privilege('anon', 'public.regional_places', 'SELECT')
    or has_table_privilege('anon', 'public.regional_places', 'INSERT')
    or has_table_privilege('authenticated', 'public.regional_places', 'DELETE')
    or has_table_privilege('anon', 'public.regional_collection_batches', 'SELECT') then
    raise exception 'regional table access is incorrect';
  end if;
  if has_function_privilege('anon', 'public.upsert_regional_places(jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.upsert_regional_places(jsonb)', 'EXECUTE') then
    raise exception 'regional write function access is incorrect';
  end if;
  select array_agg(id order by distance_miles, id) into found
    from public.nearby_regional_places(37.77, -122.42, 0.25, 200, 0)
    where id like 'test:regional:%';
  if found is distinct from array['test:regional:rich', 'test:regional:second'] then
    raise exception 'nearby exact radius / ordering / review filter is incorrect: %', found;
  end if;
  select array_agg(id) into found
    from public.nearby_regional_places(37.77, -122.42, 0.25, 1, 1);
  if found is distinct from array['test:regional:second'] then
    raise exception 'nearby pagination is incorrect';
  end if;
  begin
    perform public.nearby_regional_places('NaN'::double precision, -122.42);
    raise exception 'NaN coordinate was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.nearby_regional_places(37.77, -122.42, 26);
    raise exception 'unbounded radius was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.nearby_regional_places(37.77, -122.42, 5, 201);
    raise exception 'unbounded page was accepted';
  exception when invalid_parameter_value then null;
  end;
  result := public.upsert_regional_places('[{
    "id":"test:regional:rich", "name":"Regional Test Cafe", "category":"cafe",
    "lat":37.77, "lon":-122.42, "image":null, "detail_content":null,
    "source_osm_id":"way/222", "source_osm_ids":["way/222"]
  }]');
  if result <> 1 or not exists (
    select from public.regional_places where id = 'test:regional:rich'
      and image = 'https://cafe.example/owned.jpg' and detail_content->>'version' = '1'
      and source_osm_ids @> array['node/111', 'way/222']
  ) then raise exception 'identity upsert erased rich goods or aliases'; end if;
  select array_agg(id) into found from public.regional_identity_candidates(
    '{"min_lat":38.8,"max_lat":38.9,"min_lon":-123,"max_lon":-122.9}', array['way/222'], 0);
  if found is distinct from array['test:regional:rich'] then
    raise exception 'global alias lookup failed for a moved source';
  end if;
end;
$$;

set local role anon;
select id from public.nearby_regional_places(37.77, -122.42, 0.25, 200, 0)
where id like 'test:regional:%';
reset role;
rollback;

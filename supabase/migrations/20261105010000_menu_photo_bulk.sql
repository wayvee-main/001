-- Temporary, bounded acceleration authorized for the November 5 collection.
-- Existing place goods survive. Metadata and validated-file fingerprints live
-- in Postgres; image bytes continue to be served by their original sources.
create table if not exists public.regional_enrichment_settings (
 id boolean primary key default true check(id),
 burst_until timestamptz not null,
 image_target integer not null default 10000 check(image_target>0)
);
insert into public.regional_enrichment_settings(id,burst_until,image_target)
 values(true,'2026-11-06T08:00:00Z',10000) on conflict(id) do nothing;
alter table public.regional_enrichment_settings enable row level security;
revoke all on public.regional_enrichment_settings from anon,authenticated;
grant all on public.regional_enrichment_settings to service_role;

alter table public.regional_enrichment_jobs add column if not exists coverage jsonb not null default '{}'::jsonb;

create table if not exists public.regional_photo_assets (
 sha256 text primary key check(sha256 ~ '^[0-9a-f]{64}$'),
 url text not null check(url ~ '^https://'),
 width integer not null check(width between 300 and 8192),
 height integer not null check(height between 180 and 8192),
 byte_size integer not null check(byte_size between 1 and 5000000),
 verified_at timestamptz not null default now()
);
create table if not exists public.regional_place_photos (
 place_id text not null references public.regional_places(id) on delete cascade,
 sha256 text not null references public.regional_photo_assets(sha256) on delete cascade,
 source_url text not null check(source_url ~ '^https?://'),
 caption text,provider text,verified_at timestamptz not null default now(),
 primary key(place_id,sha256)
);
alter table public.regional_photo_assets enable row level security;
alter table public.regional_place_photos enable row level security;
revoke all on public.regional_photo_assets,public.regional_place_photos from anon,authenticated;
grant all on public.regional_photo_assets,public.regional_place_photos to service_role;

create or replace function public.begin_regional_enrichment(p_limit integer default 3000)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 h text := 'hour:'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24');
 d text := 'day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD');
 hr integer;dr integer;amount integer;run uuid;settings regional_enrichment_settings;burst boolean;
begin
 if p_limit is null or p_limit<0 or p_limit>6000 then raise exception 'Request limit must be between 0 and 6000';end if;
 select * into settings from regional_enrichment_settings where id=true;
 burst:=coalesce(settings.burst_until>now(),false);
 insert into regional_enrichment_budgets(bucket) values(d),(h) on conflict do nothing;
 select reserved into dr from regional_enrichment_budgets where bucket=d for update;
 select reserved into hr from regional_enrichment_budgets where bucket=h for update;
 amount:=greatest(0,least(p_limit,case when burst then 3000 else 800 end,
   (case when burst then 96000 else 19200 end)-dr,(case when burst then 12000 else 800 end)-hr));
 update regional_enrichment_budgets set reserved=reserved+amount where bucket in(d,h);
 insert into regional_enrichment_runs(hour_bucket,day_bucket,request_budget) values(h,d,amount) returning id into run;
 return jsonb_build_object('run_id',run,'budget',amount,'mode',case when burst then 'bulk' else 'maintenance' end,
   'max_bytes',case when burst then 250000000 else 60000000 end,'workers_per_lane',case when burst then 12 else 4 end,
   'photo_limit',case when burst then 12 else 6 end,'image_target',settings.image_target,'burst_until',settings.burst_until);
end $$;

-- Serialize the short claim transaction, never source fetches. The following
-- statement gets a fresh READ COMMITTED snapshot after the mutex is acquired,
-- so parallel lane calls cannot lease two fields of the same venue.
create or replace function public.claim_regional_enrichment_lane(p_kind text,p_limit integer default 12)
returns table(place_id text,kind text,lease_token uuid,attempts integer,source_urls jsonb,place jsonb)
language plpgsql security definer set search_path=public as $$
begin
 if p_kind is not null and p_kind not in('menu','photos') then raise exception 'Invalid collection lane';end if;
 if p_limit is null or p_limit<1 or p_limit>12 then raise exception 'Claim limit must be 1-12';end if;
 perform 1 from regional_enrichment_settings where id=true for update;
 return query with preferred as materialized (
  select distinct on(j.place_id) j.place_id,j.kind,j.priority,j.next_check_at,
    (j.status='pending' and j.attempts=0) as first_pass,
    case when j.status='pending' and j.attempts=0 then 0 when j.status in('pending','working') then 1
      when j.status='partial' then 2 when j.status='ready' then 3 else 4 end as retry_rank
  from regional_enrichment_jobs j join regional_places p on p.id=j.place_id
  where not p.needs_review and (p_kind is null or j.kind=p_kind) and j.next_check_at<=now()
    and (j.status<>'working' or j.leased_until<now())
    and not exists(select 1 from regional_enrichment_jobs active where active.place_id=j.place_id
      and active.status='working' and active.leased_until>=now())
  order by j.place_id,retry_rank,j.priority,j.next_check_at,j.kind
 ), ranked as (
  select preferred.*,row_number() over(partition by preferred.first_pass
    order by preferred.retry_rank,preferred.priority,preferred.next_check_at,preferred.place_id,preferred.kind) as lane_rank from preferred
 ), due as (
  select j.place_id,j.kind from regional_enrichment_jobs j
  join ranked r on r.place_id=j.place_id and r.kind=j.kind join regional_places parent on parent.id=j.place_id
  order by case when (r.first_pass and r.lane_rank<=greatest(1,p_limit-greatest(1,p_limit/4)))
    or (not r.first_pass and r.lane_rank<=greatest(1,p_limit/4)) then 0 else 1 end,r.first_pass desc,r.lane_rank
  limit p_limit for update of j,parent skip locked
 ), claimed as (
  update regional_enrichment_jobs j set status='working',lease_token=gen_random_uuid(),
    leased_until=now()+interval '15 minutes',attempts=j.attempts+1
  from due where j.place_id=due.place_id and j.kind=due.kind returning j.*
 )
 select j.place_id,j.kind,j.lease_token,j.attempts,j.source_urls,
   jsonb_build_object('id',p.id,'name',p.name,'address',p.address,'website',p.website,
     'city',p.city,'category',p.category,'image',p.image,'detail_content',p.detail_content)
 from claimed j join regional_places p on p.id=j.place_id;
end $$;
create or replace function public.claim_regional_enrichment(p_limit integer default 8)
returns table(place_id text,kind text,lease_token uuid,attempts integer,source_urls jsonb,place jsonb)
language sql security definer set search_path=public as $$select * from public.claim_regional_enrichment_lane(null,p_limit);$$;

create or replace function public.record_regional_photo_assets(p_place_id text,p_kind text,p_token uuid,p_photos jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare photo jsonb;written integer:=0;
begin
 perform 1 from regional_enrichment_jobs where place_id=p_place_id and kind=p_kind and lease_token=p_token
   and status='working' and leased_until>now() for update;
 if not found then raise exception 'Photo inventory lease expired';end if;
 if p_photos is null or jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)>24 then raise exception 'Invalid photo inventory batch';end if;
 for photo in select value from jsonb_array_elements(p_photos) loop
  insert into regional_photo_assets(sha256,url,width,height,byte_size)
   values(photo->>'sha256',photo->>'url',(photo->>'width')::integer,(photo->>'height')::integer,(photo->>'byte_size')::integer)
   on conflict(sha256) do update set url=excluded.url,verified_at=now();
  insert into regional_place_photos(place_id,sha256,source_url,caption,provider)
   values(p_place_id,photo->>'sha256',photo->>'source_url',left(photo->>'caption',180),left(photo->>'provider',30))
   on conflict(place_id,sha256) do update set source_url=excluded.source_url,caption=excluded.caption,provider=excluded.provider,verified_at=now();
  written:=written+1;
 end loop;
 return written;
end $$;

create or replace function public.record_regional_menu_coverage(p_place_id text,p_token uuid,p_coverage jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if p_coverage is null or p_coverage->>'status' is null or p_coverage->>'status' not in('source_complete','partial','document_only','unavailable') or octet_length(p_coverage::text)>20000 then raise exception 'Invalid menu coverage';end if;
 update regional_enrichment_jobs set coverage=p_coverage where place_id=p_place_id and kind='menu'
   and lease_token=p_token and status='working' and leased_until>now();
 return found;
end $$;

-- Older ready menu jobs did not prove source completeness. Preserve all goods
-- and refresh them gradually through the existing fair retry lane.
update public.regional_enrichment_jobs set status='partial',next_check_at=least(next_check_at,now())
 where kind='menu' and status='ready' and coverage->>'status' is distinct from 'source_complete';
update public.regional_enrichment_jobs set next_check_at=least(next_check_at,now())
 where kind='photos' and status='ready';

create or replace function public.regional_enrichment_summary()
returns jsonb language sql security definer set search_path=public as $$
 with goods as (
  select p.id,p.detail_content,
   case when jsonb_typeof(p.detail_content#>'{menu,items}')='array' then jsonb_array_length(p.detail_content#>'{menu,items}') else 0 end as items,
   case when jsonb_typeof(p.detail_content->'menuDocuments')='array' then jsonb_array_length(p.detail_content->'menuDocuments') else 0 end as documents
  from regional_places p
 ), photo_urls as (
  select photo->>'url' as url from goods cross join lateral jsonb_array_elements(
    case when jsonb_typeof(detail_content->'photos')='array' then detail_content->'photos' else '[]'::jsonb end) photo
  union select item->>'image' from goods cross join lateral jsonb_array_elements(
    case when jsonb_typeof(detail_content#>'{menu,items}')='array' then detail_content#>'{menu,items}' else '[]'::jsonb end) item
 ), image_count as (
  select count(*) as images from regional_photo_assets asset where exists(select from regional_place_photos link where link.sha256=asset.sha256)
 )
 select jsonb_build_object('places',(select count(*) from regional_places),'jobs',coalesce((select jsonb_agg(x) from (
   select kind,status,count(*) as count from regional_enrichment_jobs group by kind,status order by kind,status
  ) x),'[]'::jsonb),'images',jsonb_build_object('verified_unique_files',(select images from image_count),
    'catalog_unique_photo_urls',(select count(*) from photo_urls where url ~ '^https?://'),
    'venues_with_verified_images',(select count(distinct place_id) from regional_place_photos),
    'target',(select image_target from regional_enrichment_settings where id=true),
    'remaining',greatest(0,(select image_target from regional_enrichment_settings where id=true)-(select images from image_count)),
    'binary_storage','external_sources'),
  'menus',jsonb_build_object('with_items',(select count(*) from goods where items>0),'items',(select coalesce(sum(items),0) from goods),
    'with_documents',(select count(*) from goods where documents>0),
    'source_complete',(select count(*) from regional_enrichment_jobs where kind='menu' and status='ready' and coverage->>'status'='source_complete'),
    'partial',(select count(*) from regional_enrichment_jobs where kind='menu' and status='partial')),
  'burst_until',(select burst_until from regional_enrichment_settings where id=true));
$$;

revoke all on function public.begin_regional_enrichment(integer),public.claim_regional_enrichment(integer),public.claim_regional_enrichment_lane(text,integer),
 public.record_regional_photo_assets(text,text,uuid,jsonb),public.record_regional_menu_coverage(text,uuid,jsonb),public.regional_enrichment_summary() from public,anon,authenticated;
grant execute on function public.begin_regional_enrichment(integer),public.claim_regional_enrichment(integer),public.claim_regional_enrichment_lane(text,integer),
 public.record_regional_photo_assets(text,text,uuid,jsonb),public.record_regional_menu_coverage(text,uuid,jsonb),public.regional_enrichment_summary() to service_role;
notify pgrst,'reload schema';

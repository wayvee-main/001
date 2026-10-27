-- Independent, resumable menu/photo collection. No client writes or destructive
-- replacement of the regional identity pool. Reservations survive runner loss.
create table if not exists public.regional_enrichment_jobs (
  place_id text not null references public.regional_places(id) on delete cascade,
  kind text not null check (kind in ('menu','photos')),
  status text not null default 'pending' check (status in ('pending','working','ready','partial','blocked','unavailable','unsupported','not_applicable')),
  priority integer not null default 20,
  next_check_at timestamptz not null default now(),
  checked_at timestamptz,
  attempts integer not null default 0,
  lease_token uuid,
  leased_until timestamptz,
  source_urls jsonb not null default '[]'::jsonb,
  last_error text,
  primary key (place_id,kind)
);
create index if not exists regional_enrichment_due_idx
  on public.regional_enrichment_jobs (next_check_at,priority,place_id);
alter table public.regional_enrichment_jobs enable row level security;
revoke all on public.regional_enrichment_jobs from anon,authenticated;
grant all on public.regional_enrichment_jobs to service_role;

create table if not exists public.regional_enrichment_budgets (
  bucket text primary key,
  reserved integer not null default 0 check (reserved >= 0)
);
create table if not exists public.regional_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  hour_bucket text not null,
  day_bucket text not null,
  request_budget integer not null,
  requests_used integer,
  source_bytes bigint,
  detail text,
  status text not null default 'working'
);
alter table public.regional_enrichment_budgets enable row level security;
alter table public.regional_enrichment_runs enable row level security;
revoke all on public.regional_enrichment_budgets,public.regional_enrichment_runs from anon,authenticated;
grant all on public.regional_enrichment_budgets,public.regional_enrichment_runs to service_role;

create or replace function public.begin_regional_enrichment(p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  h text := 'hour:'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24');
  d text := 'day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD');
  hr integer; dr integer; amount integer; run uuid;
begin
  if p_limit < 0 or p_limit > 200 then raise exception 'Request limit must be between 0 and 200'; end if;
  insert into regional_enrichment_budgets(bucket) values(d),(h) on conflict do nothing;
  -- All callers lock day then hour, so manual runs cannot race the scheduler.
  select reserved into dr from regional_enrichment_budgets where bucket=d for update;
  select reserved into hr from regional_enrichment_budgets where bucket=h for update;
  amount := greatest(0,least(p_limit,4800-dr,200-hr));
  update regional_enrichment_budgets set reserved=reserved+amount where bucket in (d,h);
  insert into regional_enrichment_runs(hour_bucket,day_bucket,request_budget)
    values(h,d,amount) returning id into run;
  return jsonb_build_object('run_id',run,'budget',amount);
end $$;

create or replace function public.finish_regional_enrichment(
  p_run_id uuid,p_requests integer,p_bytes bigint,p_detail text,p_status text default 'ok'
) returns void language plpgsql security definer set search_path=public as $$
declare r regional_enrichment_runs; unused integer;
begin
  select * into r from regional_enrichment_runs where id=p_run_id for update;
  if r.id is null or r.finished_at is not null then return; end if;
  if p_requests<0 or p_requests>r.request_budget then raise exception 'Invalid request accounting'; end if;
  unused := r.request_budget-p_requests;
  update regional_enrichment_budgets set reserved=greatest(0,reserved-unused)
    where bucket in(r.hour_bucket,r.day_bucket);
  update regional_enrichment_runs set requests_used=p_requests,source_bytes=greatest(0,p_bytes),
    detail=left(p_detail,1000),status=p_status,finished_at=now() where id=p_run_id;
  delete from regional_enrichment_budgets where bucket<'day:'||to_char(now()-interval '7 days','YYYY-MM-DD') and bucket like 'day:%';
  delete from regional_enrichment_budgets where bucket<'hour:'||to_char(now()-interval '7 days','YYYY-MM-DD-HH24') and bucket like 'hour:%';
  delete from regional_enrichment_runs where started_at<now()-interval '90 days';
end $$;

create or replace function public.seed_regional_enrichment()
returns integer language plpgsql security definer set search_path=public as $$
declare written integer;
begin
  with eligible as (
    select p.*,row_number() over(order by
      case when city in ('oakland','san-francisco') and category ~ '(restaurant|cafe|bakery|food|bar|pub|brewery)' then 0 else 1 end,
      least(power(lat-37.803,2)+power(lon+122.271,2),power(lat-37.7749,2)+power(lon+122.4194,2)),id) as local_rank
    from regional_places p where not needs_review and
      (nullif(website,'') is not null or nullif(detail_content->>'sourceUrl','') is not null)
  )
  insert into regional_enrichment_jobs(place_id,kind,priority,status,next_check_at)
  select p.id,k.kind,case when p.local_rank<=500 and p.city in ('oakland','san-francisco') then 0 else 20 end,
    case when case when k.kind='menu' then
      case when jsonb_typeof(p.detail_content#>'{menu,items}')='array' then jsonb_array_length(p.detail_content#>'{menu,items}')>0 else false end
    else case when jsonb_typeof(p.detail_content->'photos')='array' then jsonb_array_length(p.detail_content->'photos')>0 else false end end
    then 'ready' else 'pending' end,
    case when case when k.kind='menu' then
      case when jsonb_typeof(p.detail_content#>'{menu,items}')='array' then jsonb_array_length(p.detail_content#>'{menu,items}')>0 else false end
    else case when jsonb_typeof(p.detail_content->'photos')='array' then jsonb_array_length(p.detail_content->'photos')>0 else false end end
    then now()+interval '7 days' else now() end
  from eligible p cross join (values('menu'),('photos')) k(kind)
  on conflict(place_id,kind) do nothing;
  get diagnostics written=row_count;
  return written;
end $$;

create or replace function public.claim_regional_enrichment(p_limit integer default 4)
returns table(place_id text,kind text,lease_token uuid,attempts integer,source_urls jsonb,place jsonb)
language plpgsql security definer set search_path=public as $$
begin
  if p_limit<1 or p_limit>12 then raise exception 'Claim limit must be 1-12'; end if;
  return query with due as (
    select j.place_id,j.kind from regional_enrichment_jobs j
    where j.next_check_at<=now() and (j.status<>'working' or j.leased_until<now())
    order by j.priority,j.next_check_at,j.place_id,j.kind limit p_limit for update skip locked
  ), claimed as (
    update regional_enrichment_jobs j set status='working',lease_token=gen_random_uuid(),
      leased_until=now()+interval '15 minutes',attempts=j.attempts+1
    from due where j.place_id=due.place_id and j.kind=due.kind returning j.*
  )
  select j.place_id,j.kind,j.lease_token,j.attempts,j.source_urls,
    jsonb_build_object('id',p.id,'name',p.name,'address',p.address,'website',p.website,'city',p.city,'category',p.category,'image',p.image,'detail_content',p.detail_content)
  from claimed j join regional_places p on p.id=j.place_id;
end $$;

create or replace function public.complete_regional_enrichment(
  p_place_id text,p_kind text,p_token uuid,p_status text,p_next timestamptz,
  p_sources jsonb default '[]',p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('pending','ready','partial','blocked','unavailable','unsupported','not_applicable') then raise exception 'Invalid completion status'; end if;
  update regional_enrichment_jobs set status=p_status,next_check_at=greatest(now()+interval '1 minute',p_next),checked_at=now(),
    leased_until=null,lease_token=null,source_urls=coalesce(p_sources,'[]'),last_error=left(p_error,400)
    where place_id=p_place_id and kind=p_kind and lease_token=p_token and status='working';
  return found;
end $$;

create or replace function public.regional_enrichment_summary()
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('jobs',coalesce((select jsonb_agg(x) from (
   select kind,status,count(*) as count from regional_enrichment_jobs group by kind,status order by kind,status
 ) x),'[]'::jsonb),'places',(select count(*) from regional_places));
$$;

revoke all on function public.begin_regional_enrichment(integer),public.finish_regional_enrichment(uuid,integer,bigint,text,text),public.seed_regional_enrichment(),public.claim_regional_enrichment(integer),public.complete_regional_enrichment(text,text,uuid,text,timestamptz,jsonb,text),public.regional_enrichment_summary() from public,anon,authenticated;
grant execute on function public.begin_regional_enrichment(integer),public.finish_regional_enrichment(uuid,integer,bigint,text,text),public.seed_regional_enrichment(),public.claim_regional_enrichment(integer),public.complete_regional_enrichment(text,text,uuid,text,timestamptz,jsonb,text),public.regional_enrichment_summary() to service_role;
notify pgrst,'reload schema';

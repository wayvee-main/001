-- Four times the global request capacity, still shared by every run. Existing
-- reservations and job checkpoints are retained; no place goods are rewritten.
create or replace function public.begin_regional_enrichment(p_limit integer default 800)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  h text := 'hour:'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24');
  d text := 'day:'||to_char(now() at time zone 'UTC','YYYY-MM-DD');
  hr integer; dr integer; amount integer; run uuid;
begin
  if p_limit is null or p_limit < 0 or p_limit > 800 then
    raise exception 'Request limit must be between 0 and 800';
  end if;
  insert into regional_enrichment_budgets(bucket) values(d),(h) on conflict do nothing;
  select reserved into dr from regional_enrichment_budgets where bucket=d for update;
  select reserved into hr from regional_enrichment_budgets where bucket=h for update;
  amount := greatest(0,least(p_limit,19200-dr,800-hr));
  update regional_enrichment_budgets set reserved=reserved+amount where bucket in (d,h);
  insert into regional_enrichment_runs(hour_bucket,day_bucket,request_budget)
    values(h,d,amount) returning id into run;
  return jsonb_build_object('run_id',run,'budget',amount);
end $$;

-- One field job per venue per claim keeps all workers useful and avoids
-- concurrent read/merge/write races with a sibling menu/photo lease. Reserve
-- a quarter of each batch for due refreshes/retries so neither the untouched
-- backlog nor previously collected goods can starve the other.
create or replace function public.claim_regional_enrichment(p_limit integer default 8)
returns table(place_id text,kind text,lease_token uuid,attempts integer,source_urls jsonb,place jsonb)
language plpgsql security definer set search_path=public as $$
begin
  if p_limit is null or p_limit<1 or p_limit>12 then raise exception 'Claim limit must be 1-12'; end if;
  return query with preferred as materialized (
    select distinct on (j.place_id) j.place_id,j.kind,j.priority,j.next_check_at,
      (j.status='pending' and j.attempts=0) as first_pass,
      case when j.status='pending' and j.attempts=0 then 0
        when j.status in ('pending','working') then 1 when j.status='partial' then 2
        when j.status='ready' then 3 else 4 end as retry_rank
    from regional_enrichment_jobs j join regional_places p on p.id=j.place_id
    where not p.needs_review and j.next_check_at<=now()
      and (j.status<>'working' or j.leased_until<now())
      and not exists (
        select 1 from regional_enrichment_jobs active
        where active.place_id=j.place_id and active.status='working' and active.leased_until>=now()
      )
    order by j.place_id,retry_rank,j.priority,j.next_check_at,j.kind
  ), ranked as (
    select preferred.*,row_number() over (
      partition by preferred.first_pass order by preferred.retry_rank,preferred.priority,
        preferred.next_check_at,preferred.place_id,preferred.kind
    ) as lane_rank from preferred
  ), due as (
    select j.place_id,j.kind from regional_enrichment_jobs j
    join ranked r on r.place_id=j.place_id and r.kind=j.kind
    order by case when
      (r.first_pass and r.lane_rank<=greatest(1,p_limit-greatest(1,p_limit/4))) or
      (not r.first_pass and r.lane_rank<=greatest(1,p_limit/4)) then 0 else 1 end,
      r.first_pass desc,r.lane_rank
    limit p_limit for update of j skip locked
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

revoke all on function public.begin_regional_enrichment(integer),public.claim_regional_enrichment(integer) from public,anon,authenticated;
grant execute on function public.begin_regional_enrichment(integer),public.claim_regional_enrichment(integer) to service_role;
notify pgrst,'reload schema';

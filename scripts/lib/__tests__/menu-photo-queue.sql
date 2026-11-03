-- Run after the additive migration in an isolated PostgreSQL test database.
-- This transaction does not fetch websites or retain test rows.
begin;
do $$
declare a jsonb; b jsonb; c integer; token uuid; old_token uuid; picked text[]; ok boolean;
begin
  delete from public.regional_enrichment_budgets;
  a:=public.begin_regional_enrichment(800);
  b:=public.begin_regional_enrichment(800);
  if (a->>'budget')::int<>800 or (b->>'budget')::int<>0 then raise exception 'Hourly cap is not atomic'; end if;
  perform public.finish_regional_enrichment((a->>'run_id')::uuid,3,10,'test','ok');
  b:=public.begin_regional_enrichment(800);
  if (b->>'budget')::int<>797 then raise exception 'Unused reservation not released'; end if;
  -- A repeated finish must not refund the same reservation twice.
  perform public.finish_regional_enrichment((a->>'run_id')::uuid,3,10,'test','ok');
  b:=public.begin_regional_enrichment(800);
  if (b->>'budget')::int<>0 then raise exception 'Repeated finish released budget twice'; end if;
  update public.regional_enrichment_budgets set reserved=19199 where bucket like 'day:%';
  update public.regional_enrichment_budgets set reserved=0 where bucket like 'hour:%';
  b:=public.begin_regional_enrichment(800);
  if (b->>'budget')::int<>1 then raise exception 'Daily cap is not shared'; end if;
  if has_function_privilege('anon','public.claim_regional_enrichment(integer)','EXECUTE') then raise exception 'Anonymous queue access'; end if;
  if has_table_privilege('anon','public.regional_enrichment_jobs','SELECT') then raise exception 'Anonymous job table access'; end if;
  if has_function_privilege('authenticated','public.begin_regional_enrichment(integer)','EXECUTE') then raise exception 'Client budget access'; end if;

  insert into public.regional_places(id,name,category,lat,lon,city,website)
    select 'test:queue:fresh:'||i,'Fresh venue '||i,'restaurant',37.8,-122.4,'oakland','https://venue.example/' from generate_series(1,12) i;
  insert into public.regional_places(id,name,category,lat,lon,city,website)
    select 'test:queue:retry:'||i,'Retry venue '||i,'restaurant',37.8,-122.4,'oakland','https://venue.example/' from generate_series(1,4) i;
  insert into public.regional_enrichment_jobs(place_id,kind,priority,next_check_at)
    select p.id,k.kind,20,now()-interval '1 day' from public.regional_places p
    cross join (values('menu'),('photos')) k(kind) where p.id like 'test:queue:fresh:%';
  insert into public.regional_enrichment_jobs(place_id,kind,priority,status,attempts,next_check_at)
    select id,'menu',0,case when id like '%:1' then 'ready' else 'blocked' end,2,now()-interval '3 days'
    from public.regional_places where id like 'test:queue:retry:%';

  create temporary table claimed_first on commit drop as select * from public.claim_regional_enrichment(8);
  select count(distinct place_id) into c from claimed_first;
  if c<>8 then raise exception 'Workers did not get eight distinct venues'; end if;
  select count(*) into c from claimed_first where attempts=1;
  if c<>6 then raise exception 'Retries crowded out the six first-pass slots'; end if;
  if not exists(select from claimed_first where place_id='test:queue:retry:1') then
    raise exception 'Due ready content did not get a refresh slot';
  end if;
  select array_agg(place_id) into picked from claimed_first;
  create temporary table claimed_second on commit drop as select * from public.claim_regional_enrichment(8);
  if exists(select from claimed_second where place_id=any(picked)) then
    raise exception 'An active sibling lease was claimed';
  end if;
  select count(*) into c from claimed_second;
  if c<>8 then raise exception 'Backlog/refresh lanes did not refill available worker slots'; end if;

  -- Exhausted refresh lanes must donate their slots to untouched venues.
  delete from public.regional_enrichment_jobs;
  insert into public.regional_enrichment_jobs(place_id,kind)
    select id,'photos' from public.regional_places where id like 'test:queue:fresh:%';
  select count(*) into c from public.claim_regional_enrichment(8);
  if c<>8 then raise exception 'Unused refresh slots did not refill'; end if;

  delete from public.regional_enrichment_jobs;
  old_token:=gen_random_uuid();
  insert into public.regional_enrichment_jobs(place_id,kind,status,lease_token,leased_until,next_check_at)
    values('test:queue:fresh:1','menu','working',old_token,now()-interval '1 minute',now()-interval '1 hour');
  select lease_token into token from public.claim_regional_enrichment(8);
  if token is null or token=old_token then raise exception 'Expired lease did not rotate its token'; end if;
  ok:=public.complete_regional_enrichment('test:queue:fresh:1','menu',old_token,'ready',now()+interval '7 days');
  if ok then raise exception 'A stale worker completed a replaced lease'; end if;
  ok:=public.complete_regional_enrichment('test:queue:fresh:1','menu',token,'ready',now()+interval '7 days');
  if not ok then raise exception 'The active worker could not checkpoint'; end if;
  select count(*) into c from public.claim_regional_enrichment(8);
  if c<>0 then raise exception 'Future refresh was claimed early'; end if;
end $$;
rollback;

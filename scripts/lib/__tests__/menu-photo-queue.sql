-- Run after the additive migration in an isolated PostgreSQL test database.
-- This transaction does not fetch websites or retain test rows.
begin;
do $$
declare a jsonb; b jsonb; c integer; token uuid; ok boolean;
begin
  delete from public.regional_enrichment_budgets;
  a:=public.begin_regional_enrichment(200);
  b:=public.begin_regional_enrichment(200);
  if (a->>'budget')::int<>200 or (b->>'budget')::int<>0 then raise exception 'Hourly cap is not atomic'; end if;
  perform public.finish_regional_enrichment((a->>'run_id')::uuid,3,10,'test','ok');
  b:=public.begin_regional_enrichment(200);
  if (b->>'budget')::int<>197 then raise exception 'Unused reservation not released'; end if;
  update public.regional_enrichment_budgets set reserved=4799 where bucket like 'day:%';
  update public.regional_enrichment_budgets set reserved=0 where bucket like 'hour:%';
  b:=public.begin_regional_enrichment(200);
  if (b->>'budget')::int<>1 then raise exception 'Daily cap is not shared'; end if;
  if has_function_privilege('anon','public.claim_regional_enrichment(integer)','EXECUTE') then raise exception 'Anonymous queue access'; end if;
  if has_table_privilege('anon','public.regional_enrichment_jobs','SELECT') then raise exception 'Anonymous job table access'; end if;
end $$;
rollback;

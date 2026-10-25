-- A durable detail queue independent of runner cache. Identity collection never
-- resets this state; unparseable/failed sites cannot monopolize the first page.
alter table public.regional_places
  add column if not exists detail_next_check_at timestamptz not null default now(),
  add column if not exists detail_checked_at timestamptz,
  add column if not exists detail_failure_count integer not null default 0 check (detail_failure_count >= 0);
-- Start with unpopulated SF, then other unpopulated Bay records. Subsequent
-- checks use the durable due timestamp, so new regions keep their fair turn.
update public.regional_places set detail_next_check_at = now() - interval '2 hours'
  where detail_checked_at is null and city = 'san-francisco' and detail_content is null and image is null;
update public.regional_places set detail_next_check_at = now() - interval '1 hour'
  where detail_checked_at is null and city <> 'san-francisco' and detail_content is null and image is null;
create index if not exists regional_places_detail_due_idx
  on public.regional_places (detail_next_check_at, id) where not needs_review;
comment on column public.regional_places.detail_next_check_at is 'Durable official-source enrichment queue; 7-day success freshness and capped exponential failure backoff.';
notify pgrst, 'reload schema';

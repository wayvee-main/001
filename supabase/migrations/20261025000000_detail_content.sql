-- Source-backed detail goods, read alongside the identity instead of a separate
-- client-side scrape. Existing public-read / service-write policies still apply.
alter table public.places add column if not exists detail_content jsonb;
alter table public.events add column if not exists detail_content jsonb;
comment on column public.places.detail_content is 'Versioned official-source menu, dish photos, descriptions, offers and visit content. Prices and offers are never inferred.';
comment on column public.events.detail_content is 'Versioned event/artist/venue content retained from the official event source.';
notify pgrst, 'reload schema';
alter table public.sync_runs drop constraint if exists sync_runs_job_check;
alter table public.sync_runs add constraint sync_runs_job_check check (job in ('events','ticketmaster','viator','places','weather','menus'));

-- Ticketmaster as a second event source (see DATA.md).
--
-- Rows in public.events now record their provenance so each sync script prunes
-- only the rows it owns: sync-events.ts owns 'curated' (the hand-verified
-- bundle in src/lib/events.ts), sync-ticketmaster.ts owns 'ticketmaster'.
-- Without this split, whichever script ran last would delete the other's rows.
-- Every pre-existing row came from the curated bundle, so the default is right.

alter table public.events
  add column if not exists source text not null default 'curated';

alter table public.events
  drop constraint if exists events_source_check;

alter table public.events
  add constraint events_source_check check (source in ('curated', 'ticketmaster'));

create index if not exists events_source_idx on public.events (source);

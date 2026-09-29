-- Machine-readable opening hours for the bulk places directory.
--
-- "Right now is live" (CLAUDE.md #3) names open-now as a first-class signal,
-- but until now nothing in the backend carried hours in a form code could read:
-- the curated catalog in src/lib/data.ts stores prose ("Lunch and dinner
-- daily") and public.places stored nothing at all. OpenStreetMap tags real
-- hours on a good share of Oakland food/drink venues, so this column carries
-- OSM's `opening_hours` value **verbatim** — never normalized, never guessed,
-- never back-filled from a category default.
--
-- Nullable on purpose: a place with no OSM hours tag stays null, and the client
-- renders "Hours not listed" rather than an assumed schedule (CLAUDE.md, no
-- invented data). src/lib/hours.ts parses the common subset of the syntax and
-- returns "unknown" for anything it cannot read with certainty.

alter table public.places add column if not exists opening_hours text;

comment on column public.places.opening_hours is
  'Verbatim OpenStreetMap opening_hours tag (https://wiki.openstreetmap.org/wiki/Key:opening_hours). Never synthesized — null means the source has no hours for this place.';

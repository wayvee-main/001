-- Widens saved_places to cover places directory entries and nightlife spots,
-- not just curated restaurants/venues — the client now surfaces a Save
-- action on those detail screens too (events already have their own
-- user_plans table, so 'event' intentionally stays out of this constraint).
alter table public.saved_places drop constraint if exists saved_places_place_kind_check;
alter table public.saved_places add constraint saved_places_place_kind_check
  check (place_kind in ('restaurant', 'venue', 'place', 'night'));

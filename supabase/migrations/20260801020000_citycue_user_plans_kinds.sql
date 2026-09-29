-- Widens user_plans to cover restaurant/venue/night/crawl/pick pins, not just
-- events — every detail screen now offers "Add to plan", not only events —
-- same shape as saved_places_kinds (place_kind, place_id) so the client uses
-- one serialization idiom (`${kind}:${id}`) across saves and plans alike.
alter table public.user_plans add column if not exists item_kind text;
alter table public.user_plans add column if not exists item_id text;

update public.user_plans set item_kind = 'event', item_id = event_id where item_kind is null;

alter table public.user_plans alter column item_kind set not null;
alter table public.user_plans alter column item_id set not null;

alter table public.user_plans add constraint user_plans_item_kind_check
  check (item_kind in ('event', 'restaurant', 'venue', 'night', 'crawl', 'pick'));
alter table public.user_plans add constraint user_plans_item_id_length_check
  check (char_length(item_id) between 1 and 120);

alter table public.user_plans drop constraint user_plans_pkey;
alter table public.user_plans add primary key (user_id, item_kind, item_id);

alter table public.user_plans drop column event_id;

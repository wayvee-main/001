-- Cuisine is a separate, orthogonal dimension from category (a "restaurant"
-- can be Thai, Ethiopian, Mexican, etc.; a "bar" or "cafe" usually has none).
-- Nullable — omitted rather than guessed when neither source tags it.
alter table public.places add column if not exists cuisine text;

create index if not exists places_cuisine_idx on public.places (cuisine);

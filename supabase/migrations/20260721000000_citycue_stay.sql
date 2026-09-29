-- Optional, guest-entered stay context (property name + dates), used to power
-- "night X of Y" framing on Home. Free text, never a curated hotel database —
-- CityCue has no affiliation with any specific hotel brand. Always skippable;
-- null columns just mean no stay is linked yet.

alter table public.user_preferences
  add column if not exists stay_property_name text check (char_length(stay_property_name) <= 120),
  add column if not exists stay_check_in date,
  add column if not exists stay_check_out date;

-- Trip pacing + budget preferences (Create tab's "Plan my stay" pickers),
-- synced across devices once signed in. Same fixed option sets already
-- shown in src/app/(tabs)/create.tsx — not a new vocabulary. Null columns
-- just mean the guest hasn't chosen yet, so the UI falls back to its
-- existing defaults (Relaxed / $$).

alter table public.user_preferences
  add column if not exists pace_preference text check (pace_preference in ('Relaxed', 'Packed')),
  add column if not exists budget_preference text check (budget_preference in ('$', '$$', '$$$'));

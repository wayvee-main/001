-- CityCue account-owned data. Run with `supabase db push` or paste this file
-- into the Supabase SQL Editor once for an existing hosted project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Guest' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  taste_tags text[] not null default '{}',
  dismissed_insight_keys text[] not null default '{}',
  preferred_delivery_provider text not null default 'Uber Eats',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (char_length(event_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.venue_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id text not null check (char_length(venue_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table if not exists public.saved_places (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_kind text not null check (place_kind in ('restaurant', 'venue')),
  place_id text not null check (char_length(place_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, place_kind, place_id)
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_plans enable row level security;
alter table public.venue_follows enable row level security;
alter table public.saved_places enable row level security;

revoke all on public.profiles from anon;
revoke all on public.user_preferences from anon;
revoke all on public.user_plans from anon;
revoke all on public.venue_follows from anon;
revoke all on public.saved_places from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert, update, delete on public.user_plans to authenticated;
grant select, insert, update, delete on public.venue_follows to authenticated;
grant select, insert, update, delete on public.saved_places to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users read their own preferences" on public.user_preferences;
create policy "Users read their own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own preferences" on public.user_preferences;
create policy "Users create their own preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own preferences" on public.user_preferences;
create policy "Users update their own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own plans" on public.user_plans;
create policy "Users manage their own plans"
  on public.user_plans for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own venue follows" on public.venue_follows;
create policy "Users manage their own venue follows"
  on public.venue_follows for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own saved places" on public.saved_places;
create policy "Users manage their own saved places"
  on public.saved_places for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Guest'
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    resolved_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill rows for users created before this migration.
insert into public.profiles (id, display_name, avatar_url)
select
  id,
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Guest'
  ),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

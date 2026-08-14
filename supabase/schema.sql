-- Still Hours - Supabase schema
--
-- Run this once in your Supabase project's SQL Editor
-- (Project -> SQL Editor -> New query -> paste -> Run).
--
-- It creates one table per data type the app tracks, all scoped to the
-- signed-in user via Row Level Security, plus a trigger that creates a
-- `profiles` row automatically the moment someone signs up.

-- ------------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  email text not null default '',
  avatar text not null default '🕊️',
  weekly_goal_hours numeric not null default 5,
  member_since timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);
create policy "Profiles are insertable by owner" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created (i.e. the
-- first time someone completes the email sign-up code).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, full_name, email, avatar, weekly_goal_hours, member_since)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    trim(coalesce(new.raw_user_meta_data->>'first_name', '') || ' ' || coalesce(new.raw_user_meta_data->>'last_name', '')),
    coalesce(new.email, ''),
    '🕊️',
    5,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------
-- Generic helper: every table below follows the same shape
-- (id text primary key so the client's existing local id generator
-- keeps working, user_id uuid owner column, RLS scoped to the owner).
-- ------------------------------------------------------------------

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null,
  duration integer not null,
  category text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.custom_categories (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null default now(),
  title text not null default 'Untitled reflection',
  body text not null default ''
);

create table if not exists public.prayer_requests (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  notes text not null default '',
  status text not null default 'ongoing',
  date_added timestamptz not null default now(),
  date_answered timestamptz
);

create table if not exists public.prayer_chain (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  note text not null default '',
  prayed_date text
);

create table if not exists public.reminders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  time text not null,
  days integer[] not null default '{}'
);

create table if not exists public.challenge_members (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  hours numeric not null default 0
);

-- Enable RLS + owner-only policies on every table above.
do $$
declare
  t text;
begin
  foreach t in array array['sessions', 'custom_categories', 'journal_entries', 'prayer_requests', 'prayer_chain', 'reminders', 'challenge_members']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s select own" on public.%1$I', t);
    execute format('create policy "%1$s select own" on public.%1$I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s insert own" on public.%1$I', t);
    execute format('create policy "%1$s insert own" on public.%1$I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s update own" on public.%1$I', t);
    execute format('create policy "%1$s update own" on public.%1$I for update using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s delete own" on public.%1$I', t);
    execute format('create policy "%1$s delete own" on public.%1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists custom_categories_user_id_idx on public.custom_categories (user_id);
create index if not exists journal_entries_user_id_idx on public.journal_entries (user_id);
create index if not exists prayer_requests_user_id_idx on public.prayer_requests (user_id);
create index if not exists prayer_chain_user_id_idx on public.prayer_chain (user_id);
create index if not exists reminders_user_id_idx on public.reminders (user_id);
create index if not exists challenge_members_user_id_idx on public.challenge_members (user_id);

-- ============================================================
-- SCDL Team Power Rankings - Initial Schema & RLS Policies
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. Profiles (linked to Supabase Auth / Discord OAuth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text,
  username text not null default 'Discord User',
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on Discord signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name text := coalesce(
    meta->>'custom_claims' ,
    meta->>'full_name',
    meta->>'name',
    meta->>'user_name',
    meta->>'preferred_username',
    'Discord User'
  );
begin
  -- Prefer user_name or full_name cleanly
  resolved_name := coalesce(
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(meta->>'user_name', ''),
    nullif(meta->>'preferred_username', ''),
    'Discord User'
  );

  insert into public.profiles (id, discord_id, username, avatar_url)
  values (
    new.id,
    coalesce(meta->>'provider_id', meta->>'sub'),
    resolved_name,
    meta->>'avatar_url'
  )
  on conflict (id) do update set
    discord_id = coalesce(excluded.discord_id, public.profiles.discord_id),
    username = coalesce(excluded.username, public.profiles.username),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper function to check admin status
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- 2. Seasons
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Divisions (Baron / Dragon per Season)
create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  slug text not null,
  logo_url text,
  theme_key text not null default 'baron',
  created_at timestamptz not null default now(),
  unique (season_id, slug)
);

-- 4. Editions (Pre-Season, Week 1, Week 2, etc.)
create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order int not null,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  unique (season_id, slug),
  unique (season_id, sort_order)
);

-- 5. Teams (Current mutable roster/logo/name; snapshots are frozen on ballot_entries)
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete cascade,
  name text not null,
  captain text,
  logo_url text,
  roster jsonb not null default '[]'::jsonb,
  default_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Ballots
create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  edition_id uuid not null references public.editions(id) on delete cascade,
  title text,
  author_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, division_id, edition_id)
);

-- 7. Ballot Entries (Immutable Snapshot of Team/Roster/Logo at Publish Time)
create table if not exists public.ballot_entries (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  rank int not null check (rank >= 1 and rank <= 16),
  previous_rank int,
  rank_change int,
  commentary text not null default '',
  team_name_snapshot text not null,
  team_logo_snapshot text,
  roster_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (ballot_id, rank)
);

-- Indexes for fast queries
create index if not exists idx_divisions_season on public.divisions(season_id);
create index if not exists idx_editions_season_order on public.editions(season_id, sort_order);
create index if not exists idx_teams_division on public.teams(division_id);
create index if not exists idx_ballots_public on public.ballots(status, season_id, division_id, edition_id);
create index if not exists idx_ballots_user on public.ballots(user_id, updated_at desc);
create index if not exists idx_ballot_entries_ballot on public.ballot_entries(ballot_id, rank);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
alter table public.editions enable row level security;
alter table public.teams enable row level security;
alter table public.ballots enable row level security;
alter table public.ballot_entries enable row level security;

-- Profiles: public read, self update (cannot self-promote is_admin)
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Seasons / Divisions / Editions / Teams: public read, admin write
create policy "Seasons are publicly readable"
  on public.seasons for select using (true);
create policy "Admins manage seasons"
  on public.seasons for all using (public.is_admin()) with check (public.is_admin());

create policy "Divisions are publicly readable"
  on public.divisions for select using (true);
create policy "Admins manage divisions"
  on public.divisions for all using (public.is_admin()) with check (public.is_admin());

create policy "Editions are publicly readable"
  on public.editions for select using (true);
create policy "Admins manage editions"
  on public.editions for all using (public.is_admin()) with check (public.is_admin());

create policy "Teams are publicly readable"
  on public.teams for select using (true);
create policy "Admins manage teams"
  on public.teams for all using (public.is_admin()) with check (public.is_admin());

-- Ballots: published ballots are public; owners see/edit their own (when edition is open)
create policy "Published ballots or own ballots are readable"
  on public.ballots for select
  using (status = 'published' or auth.uid() = user_id);

create policy "Users can insert own ballots"
  on public.ballots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ballots when edition is open"
  on public.ballots for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.editions e
      where e.id = edition_id and e.is_open = true
    )
  )
  with check (auth.uid() = user_id);

create policy "Users can delete own draft ballots"
  on public.ballots for delete
  using (auth.uid() = user_id);

-- Ballot Entries: inherit visibility/editability from parent ballot
create policy "Ballot entries readable if parent ballot is readable"
  on public.ballot_entries for select
  using (
    exists (
      select 1 from public.ballots b
      where b.id = ballot_id
        and (b.status = 'published' or b.user_id = auth.uid())
    )
  );

create policy "Users can insert entries for own ballots"
  on public.ballot_entries for insert
  with check (
    exists (
      select 1 from public.ballots b
      where b.id = ballot_id and b.user_id = auth.uid()
    )
  );

create policy "Users can update entries for own open ballots"
  on public.ballot_entries for update
  using (
    exists (
      select 1 from public.ballots b
      join public.editions e on e.id = b.edition_id
      where b.id = ballot_id and b.user_id = auth.uid() and e.is_open = true
    )
  );

create policy "Users can delete entries for own open ballots"
  on public.ballot_entries for delete
  using (
    exists (
      select 1 from public.ballots b
      join public.editions e on e.id = b.edition_id
      where b.id = ballot_id and b.user_id = auth.uid() and e.is_open = true
    )
  );

-- ============================================================
-- Storage Bucket for Admin Team Logo Uploads
-- ============================================================
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

create policy "Team logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'team-logos');

create policy "Admins can upload team logos"
  on storage.objects for insert
  with check (bucket_id = 'team-logos' and public.is_admin());

create policy "Admins can update team logos"
  on storage.objects for update
  using (bucket_id = 'team-logos' and public.is_admin());

create policy "Admins can delete team logos"
  on storage.objects for delete
  using (bucket_id = 'team-logos' and public.is_admin());

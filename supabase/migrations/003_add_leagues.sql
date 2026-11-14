-- ============================================================
-- 003: Add Leagues hierarchy above Seasons
-- ============================================================

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  theme_key text not null default 'scdl',
  created_at timestamptz not null default now()
);

alter table public.leagues enable row level security;

create policy "Leagues are publicly readable"
  on public.leagues for select using (true);

create policy "Admins manage leagues"
  on public.leagues for all using (public.is_admin()) with check (public.is_admin());

-- Seed default SCDL league
insert into public.leagues (name, slug, logo_url, theme_key)
values ('Scuttle Crab Draft League', 'scdl', '/images/SCDL Logos/SCDL.png', 'scdl')
on conflict (slug) do nothing;

-- Add league_id to seasons and backfill existing seasons to SCDL
alter table public.seasons
  add column if not exists league_id uuid references public.leagues(id) on delete cascade;

update public.seasons
set league_id = (select id from public.leagues where slug = 'scdl' limit 1)
where league_id is null;

alter table public.seasons
  alter column league_id set not null;

create index if not exists idx_seasons_league on public.seasons(league_id);

-- Player Tier Lists, pre-draft Season Player Pools, and Players-Only editions

-- 1. Mark editions that are pre-draft / Players-Only (e.g. "Draft Day")
alter table public.editions
  add column if not exists is_players_only boolean not null default false;

-- 2. Season Player Pool (supports unattached pre-draft players AND post-draft team players)
create table if not exists public.season_players (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  role text not null check (role in ('top', 'jungle', 'mid', 'bot', 'support')),
  name text not null,
  is_captain boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists season_players_season_role_idx
  on public.season_players (season_id, role, name);

alter table public.season_players enable row level security;

drop policy if exists "Season players are publicly readable" on public.season_players;
create policy "Season players are publicly readable"
  on public.season_players for select using (true);

drop policy if exists "Admins can manage season players" on public.season_players;
create policy "Admins can manage season players"
  on public.season_players for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Extend ballots to support both Team Power Rankings ('team') and Player Tier Lists ('player')
alter table public.ballots
  add column if not exists ranking_type text not null default 'team' check (ranking_type in ('team', 'player')),
  add column if not exists tier_data jsonb;

-- Drop old (user_id, division_id, edition_id) unique constraint so users can submit
-- both a Team Power Ranking and a Player Tier List per edition (including divisionless lists)
do $$
declare
  c_name text;
begin
  for c_name in
    select conname
    from pg_constraint
    where conrelid = 'public.ballots'::regclass
      and contype = 'u'
  loop
    execute format('alter table public.ballots drop constraint if exists %I', c_name);
  end loop;
end $$;

create unique index if not exists ballots_user_scope_unique
  on public.ballots (
    user_id,
    season_id,
    coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid),
    edition_id,
    ranking_type
  )
  where season_id is not null and edition_id is not null;

-- 4. Enforce is_players_only on ballots RLS writes
drop policy if exists "Users can insert own ballots" on public.ballots;
create policy "Users can insert own ballots"
  on public.ballots for insert
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (ranking_type = 'player' or e.is_players_only = false)
        and (status = 'draft' or e.is_open = true)
    )
  );

drop policy if exists "Users can update own ballots when edition is open" on public.ballots;
create policy "Users can update own ballots when edition is open"
  on public.ballots for update
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (ranking_type = 'player' or e.is_players_only = false)
        and (status = 'draft' or e.is_open = true)
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (ranking_type = 'player' or e.is_players_only = false)
        and (status = 'draft' or e.is_open = true)
    )
  );

-- 038_schedule_captains_tournaments.sql
-- Phase 3: Team captains (Discord-linked), season match schedules, Riot Tournament codes (placeholder + live),
-- non-destructive schedule/bracket config backups, and Match-V5 + timeline storage columns.

create table if not exists public.team_captains (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  discord_id text not null,
  label text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(team_id, discord_id)
);

alter table public.team_captains enable row level security;

drop policy if exists "Operators manage team_captains" on public.team_captains;
create policy "Operators manage team_captains"
  on public.team_captains for all
  to authenticated
  using (
    public.is_league_operator(
      (
        select s.league_id
        from public.teams t
        join public.divisions d on d.id = t.division_id
        join public.seasons s on s.id = d.season_id
        where t.id = team_captains.team_id
      )
    )
  )
  with check (
    public.is_league_operator(
      (
        select s.league_id
        from public.teams t
        join public.divisions d on d.id = t.division_id
        join public.seasons s on s.id = d.season_id
        where t.id = team_captains.team_id
      )
    )
  );

drop policy if exists "Captains read own assignments" on public.team_captains;
create policy "Captains read own assignments"
  on public.team_captains for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.discord_id = team_captains.discord_id
    )
  );

create table if not exists public.season_matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  stage text not null default 'regular' check (stage in ('regular', 'playoffs')),
  round_number integer not null default 1,
  round_label text not null,
  best_of integer not null default 1,
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed')),
  bracket_slot_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_season_matches_season_div
  on public.season_matches(season_id, division_id, stage, round_number);

alter table public.season_matches enable row level security;

drop policy if exists "Public can read season_matches" on public.season_matches;
create policy "Public can read season_matches"
  on public.season_matches for select
  using (true);

drop policy if exists "Operators manage season_matches" on public.season_matches;
create policy "Operators manage season_matches"
  on public.season_matches for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_matches.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_matches.season_id)
    )
  );

create table if not exists public.tournament_codes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.season_matches(id) on delete cascade,
  game_number integer not null default 1,
  code text not null,
  provider text not null default 'placeholder' check (provider in ('placeholder', 'riot_tournament_v5')),
  riot_tournament_id text,
  status text not null default 'generated' check (status in ('generated', 'used', 'completed')),
  riot_game_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(match_id, game_number)
);

alter table public.tournament_codes enable row level security;

drop policy if exists "Captains and operators read tournament_codes" on public.tournament_codes;
create policy "Captains and operators read tournament_codes"
  on public.tournament_codes for select
  to authenticated
  using (
    public.is_league_operator(
      (
        select s.league_id
        from public.season_matches m
        join public.seasons s on s.id = m.season_id
        where m.id = tournament_codes.match_id
      )
    )
    or exists (
      select 1
      from public.season_matches m
      join public.team_captains tc on (tc.team_id = m.team_a_id or tc.team_id = m.team_b_id)
      join public.profiles p on p.discord_id = tc.discord_id
      where m.id = tournament_codes.match_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "Captains and operators insert tournament_codes" on public.tournament_codes;
create policy "Captains and operators insert tournament_codes"
  on public.tournament_codes for insert
  to authenticated
  with check (
    public.is_league_operator(
      (
        select s.league_id
        from public.season_matches m
        join public.seasons s on s.id = m.season_id
        where m.id = tournament_codes.match_id
      )
    )
    or exists (
      select 1
      from public.season_matches m
      join public.team_captains tc on (tc.team_id = m.team_a_id or tc.team_id = m.team_b_id)
      join public.profiles p on p.discord_id = tc.discord_id
      where m.id = tournament_codes.match_id
        and p.id = auth.uid()
    )
  );

create table if not exists public.season_config_backups (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete set null,
  backup_type text not null check (backup_type in ('schedule', 'playoff_bracket')),
  label text,
  payload jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_season_config_backups_lookup
  on public.season_config_backups(season_id, division_id, backup_type, created_at desc);

alter table public.season_config_backups enable row level security;

drop policy if exists "Operators manage season_config_backups" on public.season_config_backups;
create policy "Operators manage season_config_backups"
  on public.season_config_backups for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_config_backups.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_config_backups.season_id)
    )
  );

-- Game-level timeline & objective telemetry for future Tournament-V5 + Match-V5 ingestion
create table if not exists public.league_match_records (
  game_id text primary key,
  season_id uuid references public.seasons(id) on delete set null,
  match_id uuid references public.season_matches(id) on delete set null,
  game_duration_s integer not null default 0,
  blue_team text,
  red_team text,
  winner_side text,
  first_blood_time_s integer,
  first_tower_time_s integer,
  first_dragon_time_s integer,
  first_herald_time_s integer,
  first_baron_time_s integer,
  blue_void_grubs integer,
  red_void_grubs integer,
  blue_atakhan integer,
  red_atakhan integer,
  gold_curve jsonb not null default '[]'::jsonb,
  objective_timeline jsonb not null default '[]'::jsonb,
  kill_timeline jsonb not null default '[]'::jsonb,
  raw_source text,
  updated_at timestamptz not null default now()
);

alter table public.league_match_records enable row level security;

drop policy if exists "Public can read league_match_records" on public.league_match_records;
create policy "Public can read league_match_records"
  on public.league_match_records for select
  using (true);

drop policy if exists "Operators manage league_match_records" on public.league_match_records;
create policy "Operators manage league_match_records"
  on public.league_match_records for all
  to authenticated
  using (
    season_id is not null
    and public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = league_match_records.season_id)
    )
  )
  with check (
    season_id is not null
    and public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = league_match_records.season_id)
    )
  );

-- Optional time-slice columns on league_game_participants for Match-V5 Timeline imports (nullable for sheets)
alter table public.league_game_participants
  add column if not exists gold_at_10 integer,
  add column if not exists gold_at_15 integer,
  add column if not exists gold_at_20 integer,
  add column if not exists cs_at_10 integer,
  add column if not exists cs_at_15 integer,
  add column if not exists xp_diff_15 integer,
  add column if not exists cs_diff_15 integer,
  add column if not exists deaths_pre_15 integer,
  add column if not exists solo_kills_pre_15 integer,
  add column if not exists wards_pre_15 integer,
  add column if not exists items_final jsonb,
  add column if not exists runes_json jsonb;

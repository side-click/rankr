-- 037_multi_league_rbac.sql
-- Multi-league RBAC:
-- 1. League Operators (league_operators table scoped per league)
-- 2. Per-league Creator Allowlist (league_allowed_users + leagues.require_allowlist)
-- 3. Scoped RLS for operators and creators (global allowlist reserved for untagged blogs)

alter table public.leagues
  add column if not exists require_allowlist boolean not null default false;

create table if not exists public.league_operators (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  discord_id text not null,
  label text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(league_id, discord_id)
);

alter table public.league_operators enable row level security;

create table if not exists public.league_allowed_users (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  discord_id text not null,
  label text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(league_id, discord_id)
);

alter table public.league_allowed_users enable row level security;

-- Helper functions
create or replace function public.is_league_operator(target_league_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    public.is_admin()
    or (
      target_league_id is not null
      and exists (
        select 1
        from public.league_operators lo
        join public.profiles p on p.discord_id = lo.discord_id
        where p.id = auth.uid()
          and lo.league_id = target_league_id
      )
    );
$$;

grant execute on function public.is_league_operator(uuid) to authenticated;

create or replace function public.is_any_league_operator()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.league_operators lo
      join public.profiles p on p.discord_id = lo.discord_id
      where p.id = auth.uid()
    );
$$;

grant execute on function public.is_any_league_operator() to authenticated;

create or replace function public.is_allowlisted_for_league(target_league_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    case
      when target_league_id is null then public.is_allowlisted()
      else (
        public.is_league_operator(target_league_id)
        or not coalesce(
          (select require_allowlist from public.leagues where id = target_league_id),
          false
        )
        or exists (
          select 1
          from public.league_allowed_users la
          join public.profiles p on p.discord_id = la.discord_id
          where p.id = auth.uid()
            and la.league_id = target_league_id
        )
      )
    end;
$$;

grant execute on function public.is_allowlisted_for_league(uuid) to authenticated;

-- league_operators policies
drop policy if exists "Site admins manage league_operators" on public.league_operators;
create policy "Site admins manage league_operators"
  on public.league_operators for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users read own league_operators" on public.league_operators;
create policy "Users read own league_operators"
  on public.league_operators for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.discord_id = league_operators.discord_id
    )
  );

-- league_allowed_users policies
drop policy if exists "Operators manage league_allowed_users" on public.league_allowed_users;
create policy "Operators manage league_allowed_users"
  on public.league_allowed_users for all
  to authenticated
  using (public.is_league_operator(league_id))
  with check (public.is_league_operator(league_id));

drop policy if exists "Users read own league_allowed_users" on public.league_allowed_users;
create policy "Users read own league_allowed_users"
  on public.league_allowed_users for select
  to authenticated
  using (
    public.is_league_operator(league_id)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.discord_id = league_allowed_users.discord_id
    )
  );

-- Additive Operator management policies across league tables
drop policy if exists "Operators can update own league" on public.leagues;
create policy "Operators can update own league"
  on public.leagues for update
  to authenticated
  using (public.is_league_operator(id))
  with check (public.is_league_operator(id));

drop policy if exists "Operators can manage league seasons" on public.seasons;
create policy "Operators can manage league seasons"
  on public.seasons for all
  to authenticated
  using (public.is_league_operator(league_id))
  with check (public.is_league_operator(league_id));

drop policy if exists "Operators can manage league divisions" on public.divisions;
create policy "Operators can manage league divisions"
  on public.divisions for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = divisions.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = divisions.season_id)
    )
  );

drop policy if exists "Operators can manage league editions" on public.editions;
create policy "Operators can manage league editions"
  on public.editions for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = editions.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = editions.season_id)
    )
  );

drop policy if exists "Operators can manage league teams" on public.teams;
create policy "Operators can manage league teams"
  on public.teams for all
  to authenticated
  using (
    public.is_league_operator(
      (
        select s.league_id
        from public.divisions d
        join public.seasons s on s.id = d.season_id
        where d.id = teams.division_id
      )
    )
  )
  with check (
    public.is_league_operator(
      (
        select s.league_id
        from public.divisions d
        join public.seasons s on s.id = d.season_id
        where d.id = teams.division_id
      )
    )
  );

drop policy if exists "Operators can manage league season_players" on public.season_players;
create policy "Operators can manage league season_players"
  on public.season_players for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_players.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_players.season_id)
    )
  );

drop policy if exists "Operators can manage division_themes" on public.division_themes;
create policy "Operators can manage division_themes"
  on public.division_themes for all
  to authenticated
  using (public.is_any_league_operator())
  with check (public.is_any_league_operator());

drop policy if exists "Operators can manage league match_drafts" on public.match_drafts;
create policy "Operators can manage league match_drafts"
  on public.match_drafts for all
  to authenticated
  using (
    season_id is not null
    and public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = match_drafts.season_id)
    )
  )
  with check (
    season_id is not null
    and public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = match_drafts.season_id)
    )
  );

drop policy if exists "Operators can manage league_game_participants" on public.league_game_participants;
create policy "Operators can manage league_game_participants"
  on public.league_game_participants for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = league_game_participants.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = league_game_participants.season_id)
    )
  );

-- Update rankings & blogs creator policies to check per-league allowlist
drop policy if exists "Users can insert own ballots" on public.rankings;
create policy "Users can insert own ballots"
  on public.rankings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted_for_league(
      (select s.league_id from public.seasons s where s.id = season_id)
    )
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Users can update own ballots when edition is open" on public.rankings;
create policy "Users can update own ballots when edition is open"
  on public.rankings for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted_for_league(
      (select s.league_id from public.seasons s where s.id = season_id)
    )
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted_for_league(
      (select s.league_id from public.seasons s where s.id = season_id)
    )
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Users can insert entries for own ballots" on public.ranking_entries;
create policy "Users can insert entries for own ballots"
  on public.ranking_entries for insert
  to authenticated
  with check (
    public.is_not_banned()
    and public.is_app_enabled()
    and exists (
      select 1 from public.rankings r
      where r.id = ranking_id
        and r.user_id = auth.uid()
        and public.is_allowlisted_for_league(
          (select s.league_id from public.seasons s where s.id = r.season_id)
        )
    )
  );

drop policy if exists "Allowlisted users can insert own blogs" on public.blogs;
create policy "Allowlisted users can insert own blogs"
  on public.blogs for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and (
      case
        when season_id is null then public.is_allowlisted()
        else public.is_allowlisted_for_league(
          (select s.league_id from public.seasons s where s.id = season_id)
        )
      end
    )
  );

drop policy if exists "Allowlisted users can update own blogs" on public.blogs;
create policy "Allowlisted users can update own blogs"
  on public.blogs for update
  to authenticated
  using (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
      and (
        case
          when season_id is null then public.is_allowlisted()
          else public.is_allowlisted_for_league(
            (select s.league_id from public.seasons s where s.id = season_id)
          )
        end
      )
    )
    or public.is_admin()
  )
  with check (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
      and (
        case
          when season_id is null then public.is_allowlisted()
          else public.is_allowlisted_for_league(
            (select s.league_id from public.seasons s where s.id = season_id)
          )
        end
      )
    )
    or public.is_admin()
  );

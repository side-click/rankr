-- Cache for admin-only Riot API prototype stats (per SCDL season player)
create table if not exists public.riot_player_stats (
  player_key text primary key,
  riot_id text not null,
  puuid text,
  season_id uuid references public.seasons(id) on delete set null,
  division_id uuid references public.divisions(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  role text,
  solo_tier text,
  solo_rank text,
  solo_lp integer,
  solo_wins integer,
  solo_losses integer,
  matches jsonb not null default '[]'::jsonb,
  sync_error text,
  synced_at timestamptz not null default now()
);

alter table public.riot_player_stats enable row level security;

create policy "Admins can read riot_player_stats"
  on public.riot_player_stats for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can insert riot_player_stats"
  on public.riot_player_stats for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can update riot_player_stats"
  on public.riot_player_stats for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins can delete riot_player_stats"
  on public.riot_player_stats for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

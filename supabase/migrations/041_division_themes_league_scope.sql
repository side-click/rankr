-- Scope division_themes exclusively to individual leagues

alter table public.division_themes
  add column if not exists league_id uuid references public.leagues(id) on delete cascade;

create index if not exists division_themes_league_id_idx
  on public.division_themes (league_id);

-- Backfill built-in SCDL themes
update public.division_themes
set league_id = (
  select id from public.leagues where slug = 'scdl' limit 1
)
where key in ('baron', 'dragon')
  and league_id is null;

-- Backfill any custom themes from divisions referencing them
update public.division_themes dt
set league_id = sub.league_id
from (
  select distinct on (d.theme_key) d.theme_key, s.league_id
  from public.divisions d
  join public.seasons s on s.id = d.season_id
  where d.theme_key is not null
  order by d.theme_key, d.created_at asc
) sub
where dt.key = sub.theme_key
  and dt.league_id is null;

-- Allow league operators to manage division themes scoped to their own league(s)
drop policy if exists "League operators manage own division themes" on public.division_themes;
create policy "League operators manage own division themes"
  on public.division_themes for all
  to authenticated
  using (league_id is not null and public.is_league_operator(league_id))
  with check (league_id is not null and public.is_league_operator(league_id));

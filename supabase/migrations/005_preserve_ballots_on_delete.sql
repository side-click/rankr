-- ============================================================
-- 005: Preserve Historical Published Ballots on Delete
-- Deleting a League, Season, Division, Edition, or Team
-- will set FKs to NULL on ballots/ballot_entries instead of cascading,
-- and fall back to immutable snapshot metadata stored on ballots.
-- ============================================================

alter table public.ballots
  add column if not exists league_name_snapshot text,
  add column if not exists season_name_snapshot text,
  add column if not exists division_name_snapshot text,
  add column if not exists division_logo_snapshot text,
  add column if not exists division_theme_snapshot text,
  add column if not exists edition_name_snapshot text;

-- Backfill snapshots for any existing ballots
update public.ballots b
set
  league_name_snapshot = coalesce(b.league_name_snapshot, l.name),
  season_name_snapshot = coalesce(b.season_name_snapshot, s.name),
  division_name_snapshot = coalesce(b.division_name_snapshot, d.name),
  division_logo_snapshot = coalesce(b.division_logo_snapshot, d.logo_url),
  division_theme_snapshot = coalesce(b.division_theme_snapshot, d.theme_key),
  edition_name_snapshot = coalesce(b.edition_name_snapshot, e.name)
from public.seasons s
left join public.leagues l on l.id = s.league_id,
public.divisions d,
public.editions e
where b.season_id = s.id
  and d.id = b.division_id
  and e.id = b.edition_id;

-- Make season_id, division_id, edition_id nullable and switch to ON DELETE SET NULL
alter table public.ballots
  alter column season_id drop not null,
  alter column division_id drop not null,
  alter column edition_id drop not null;

alter table public.ballots
  drop constraint if exists ballots_season_id_fkey,
  drop constraint if exists ballots_division_id_fkey,
  drop constraint if exists ballots_edition_id_fkey;

alter table public.ballots
  add constraint ballots_season_id_fkey
    foreign key (season_id) references public.seasons(id) on delete set null,
  add constraint ballots_division_id_fkey
    foreign key (division_id) references public.divisions(id) on delete set null,
  add constraint ballots_edition_id_fkey
    foreign key (edition_id) references public.editions(id) on delete set null;

-- Configurable playoff detection per season:
-- 1. Optional separate Google Sheet tab GIDs for playoff matches
-- 2. Optional regular season rounds cutoff (rounds above this count as playoffs)
alter table public.seasons
  add column if not exists stats_playoff_gids text[],
  add column if not exists regular_season_rounds int;

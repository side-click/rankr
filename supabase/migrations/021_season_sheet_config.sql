-- Allow configuring Google Sheets stats source per season instead of hardcoding Season 4.5
alter table public.seasons
  add column if not exists stats_sheet_id text,
  add column if not exists stats_sheet_gids text[];

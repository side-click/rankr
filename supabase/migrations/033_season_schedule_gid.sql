-- Per-season Google Sheet tab GID containing Schedule + Draft hyperlinks for 1-click draft import
alter table public.seasons
  add column if not exists stats_schedule_gid text;

update public.seasons
set stats_schedule_gid = coalesce(nullif(trim(stats_schedule_gid), ''), '728267243')
where slug = 'season-4-5' or name ilike '%4.5%';

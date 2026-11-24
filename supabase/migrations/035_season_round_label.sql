-- Custom term for regular-season series/rounds in stat export subtitles (e.g. "Round", "Week", "Match")
alter table public.seasons
  add column if not exists stats_round_label text;

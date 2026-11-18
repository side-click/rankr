-- Add Champion Mastery Top 4 and deep sync timestamp to riot_player_stats
alter table public.riot_player_stats
  add column if not exists mastery_top4 jsonb not null default '[]'::jsonb,
  add column if not exists deep_synced_at timestamptz;

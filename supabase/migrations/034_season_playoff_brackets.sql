-- Admin-confirmed per-division playoff brackets (seed slots + single-elim matchups)
alter table public.seasons
  add column if not exists playoff_brackets jsonb;

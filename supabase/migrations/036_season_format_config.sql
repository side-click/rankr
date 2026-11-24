-- Season format settings for multi-league flexibility (draft vs premade, structure, default series length)
alter table public.seasons
  add column if not exists roster_type text not null default 'draft',
  add column if not exists season_structure text not null default 'regular_playoffs',
  add column if not exists default_best_of integer not null default 1;

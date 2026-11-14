-- ============================================================
-- 004: Add short_name / abbreviation to leagues
-- ============================================================

alter table public.leagues
  add column if not exists short_name text;

update public.leagues
set short_name = 'SCDL'
where slug = 'scdl' and short_name is null;

-- Persistent backup snapshots of Google Sheets league stats CSVs
create table if not exists public.sheet_snapshots (
  sheet_id text primary key,
  gids text[] not null default '{}',
  csv_tabs jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.sheet_snapshots enable row level security;

drop policy if exists "Public can read sheet_snapshots" on public.sheet_snapshots;
create policy "Public can read sheet_snapshots"
  on public.sheet_snapshots for select
  using (true);

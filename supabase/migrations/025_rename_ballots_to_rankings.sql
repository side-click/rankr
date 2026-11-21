-- Unify database and storage naming: ballots -> rankings, ballot_entries -> ranking_entries, ballot-overlays -> ranking-overlays

-- 1. Rename tables & foreign key column (Postgres automatically updates attached RLS policies, FKs, and constraints)
alter table if exists public.ballots rename to rankings;
alter table if exists public.ballot_entries rename to ranking_entries;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ranking_entries'
      and column_name = 'ballot_id'
  ) then
    alter table public.ranking_entries rename column ballot_id to ranking_id;
  end if;
end $$;

-- 2. Create ranking-overlays storage bucket (5 MB limit) & policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ranking-overlays',
  'ranking-overlays',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Ranking overlays are publicly readable" on storage.objects;
create policy "Ranking overlays are publicly readable"
  on storage.objects for select
  using (bucket_id = 'ranking-overlays');

drop policy if exists "Users can upload own ranking overlays" on storage.objects;
create policy "Users can upload own ranking overlays"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ranking-overlays'
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users or admins can delete ranking overlays" on storage.objects;
create policy "Users or admins can delete ranking overlays"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ranking-overlays'
    and (
      public.is_admin()
      or (
        public.is_allowlisted()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

-- 3. Update stored overlay URLs if any reference the old bucket
update public.rankings
set overlays = replace(overlays::text, '/ballot-overlays/', '/ranking-overlays/')::jsonb
where overlays::text like '%/ballot-overlays/%';

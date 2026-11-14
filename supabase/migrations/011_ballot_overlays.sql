-- Custom image/GIF overlays on published ballots

alter table public.ballots
  add column if not exists overlays jsonb not null default '[]'::jsonb;

-- Allow admins to update any ballot (e.g., to clear inappropriate overlays)
drop policy if exists "Admins can update any ballot" on public.ballots;
create policy "Admins can update any ballot"
  on public.ballots for update
  using (public.is_admin())
  with check (public.is_admin());

-- Storage bucket for user-uploaded ballot overlays (5 MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ballot-overlays',
  'ballot-overlays',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Ballot overlays are publicly readable" on storage.objects;
create policy "Ballot overlays are publicly readable"
  on storage.objects for select
  using (bucket_id = 'ballot-overlays');

drop policy if exists "Users can upload own ballot overlays" on storage.objects;
create policy "Users can upload own ballot overlays"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ballot-overlays'
    and public.is_not_banned()
    and public.is_app_enabled()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users or admins can delete ballot overlays" on storage.objects;
create policy "Users or admins can delete ballot overlays"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ballot-overlays'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

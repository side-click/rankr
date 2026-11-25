-- Allow league operators to upload, update, and delete assets in the team-logos bucket
-- (team logos, division logos, theme logos, and league logos)

drop policy if exists "Admins can upload team logos" on storage.objects;
create policy "Admins and operators can upload team logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'team-logos'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.league_operators lo
        join public.profiles p on p.discord_id = lo.discord_id
        where p.id = auth.uid()
      )
    )
  );

drop policy if exists "Admins can update team logos" on storage.objects;
create policy "Admins and operators can update team logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'team-logos'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.league_operators lo
        join public.profiles p on p.discord_id = lo.discord_id
        where p.id = auth.uid()
      )
    )
  );

drop policy if exists "Admins can delete team logos" on storage.objects;
create policy "Admins and operators can delete team logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'team-logos'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.league_operators lo
        join public.profiles p on p.discord_id = lo.discord_id
        where p.id = auth.uid()
      )
    )
  );

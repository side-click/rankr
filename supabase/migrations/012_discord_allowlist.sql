-- Discord User ID allowlist for invite-only authoring (public viewing remains open)

-- 1. Toggle on app_settings
alter table public.app_settings
  add column if not exists require_allowlist boolean not null default false;

-- 2. Allowlist table keyed by Discord User ID
create table if not exists public.allowed_discord_users (
  discord_id text primary key,
  label text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.allowed_discord_users enable row level security;

drop policy if exists "Admins can manage allowed discord users" on public.allowed_discord_users;
create policy "Admins can manage allowed discord users"
  on public.allowed_discord_users for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Helper function to check whether current authenticated user can sign in / author
create or replace function public.is_allowlisted()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    public.is_admin()
    or not coalesce(
      (select require_allowlist from public.app_settings where id = 1),
      false
    )
    or exists (
      select 1
      from public.profiles p
      join public.allowed_discord_users a on a.discord_id = p.discord_id
      where p.id = auth.uid()
    );
$$;

grant execute on function public.is_allowlisted() to authenticated;

-- 4. Enforce allowlist on ballot & entry writes (reads remain public)
drop policy if exists "Users can insert own ballots" on public.ballots;
create policy "Users can insert own ballots"
  on public.ballots for insert
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Users can update own ballots when edition is open" on public.ballots;
create policy "Users can update own ballots when edition is open"
  on public.ballots for update
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Users can insert entries for own ballots" on public.ballot_entries;
create policy "Users can insert entries for own ballots"
  on public.ballot_entries for insert
  with check (
    public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.ballots b
      where b.id = ballot_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update entries for own open ballots" on public.ballot_entries;
create policy "Users can update entries for own open ballots"
  on public.ballot_entries for update
  using (
    public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.ballots b
      left join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and (b.status = 'draft' or e.is_open = true)
    )
  );

drop policy if exists "Users can delete entries for own open ballots" on public.ballot_entries;
create policy "Users can delete entries for own open ballots"
  on public.ballot_entries for delete
  using (
    public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.ballots b
      left join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and (b.status = 'draft' or e.is_open = true)
    )
  );

-- 5. Enforce allowlist on ballot-overlays storage uploads/deletes
drop policy if exists "Users can upload own ballot overlays" on storage.objects;
create policy "Users can upload own ballot overlays"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ballot-overlays'
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
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
      or (
        public.is_allowlisted()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

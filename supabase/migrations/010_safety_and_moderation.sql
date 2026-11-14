-- Safety, moderation, user bans, admin ballot deletion, and global kill switch

-- 1. User bans on profiles
alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists ban_reason text;

create or replace function public.is_not_banned()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_banned = false
  );
$$;

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Global Kill Switch (app_settings)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'Rankr is temporarily offline for maintenance. Please check back shortly.',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, maintenance_mode)
values (1, false)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "App settings are publicly readable" on public.app_settings;
create policy "App settings are publicly readable"
  on public.app_settings for select using (true);

drop policy if exists "Admins can manage app settings" on public.app_settings;
create policy "Admins can manage app settings"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.is_app_enabled()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin() or not coalesce(
    (select maintenance_mode from public.app_settings where id = 1),
    false
  );
$$;

-- 3. Enforce bans + kill switch + admin delete on ballots and ballot_entries
drop policy if exists "Users can insert own ballots" on public.ballots;
create policy "Users can insert own ballots"
  on public.ballots for insert
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
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
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Admins can delete any ballot" on public.ballots;
create policy "Admins can delete any ballot"
  on public.ballots for delete
  using (public.is_admin());

drop policy if exists "Users can insert entries for own ballots" on public.ballot_entries;
create policy "Users can insert entries for own ballots"
  on public.ballot_entries for insert
  with check (
    public.is_not_banned()
    and public.is_app_enabled()
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
    and exists (
      select 1 from public.ballots b
      left join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and (b.status = 'draft' or e.is_open = true)
    )
  );

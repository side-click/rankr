-- Private, client-side encrypted Champion Pool storage.
-- Completely isolated from ballots, editions, divisions, and admin views.

create table if not exists public.champion_pools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  encrypted_payload text not null,
  encryption_salt text not null,
  encryption_iv text not null,
  encryption_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists champion_pools_user_id_idx
  on public.champion_pools (user_id);

alter table public.champion_pools enable row level security;

drop policy if exists "Users can view own champion pool" on public.champion_pools;
create policy "Users can view own champion pool"
  on public.champion_pools for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own champion pool" on public.champion_pools;
create policy "Users can insert own champion pool"
  on public.champion_pools for insert
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
  );

drop policy if exists "Users can update own champion pool" on public.champion_pools;
create policy "Users can update own champion pool"
  on public.champion_pools for update
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
  )
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
  );

drop policy if exists "Users can delete own champion pool" on public.champion_pools;
create policy "Users can delete own champion pool"
  on public.champion_pools for delete
  using (auth.uid() = user_id);

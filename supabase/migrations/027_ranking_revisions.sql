-- 027_ranking_revisions.sql
-- Automatic row-level version history & soft-delete recovery for rankings and ranking_entries.
-- Capped at the 5 most recent UPDATE revisions per ranking (+ 30 days retention for DELETE snapshots)
-- so storage stays bounded to a few megabytes forever.

create table if not exists public.ranking_revisions (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null,
  user_id uuid,
  operation text not null check (operation in ('UPDATE', 'DELETE')),
  title text,
  ranking_type text,
  status text,
  ranking_snapshot jsonb not null,
  entries_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ranking_revisions_ranking_id
  on public.ranking_revisions(ranking_id, created_at desc);

create index if not exists idx_ranking_revisions_created_at
  on public.ranking_revisions(created_at desc);

alter table public.ranking_revisions enable row level security;

drop policy if exists "Admins can read ranking_revisions" on public.ranking_revisions;
create policy "Admins can read ranking_revisions"
  on public.ranking_revisions for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

drop policy if exists "Admins can delete ranking_revisions" on public.ranking_revisions;
create policy "Admins can delete ranking_revisions"
  on public.ranking_revisions for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

create or replace function public.capture_ranking_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entries jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(re) order by re.rank), '[]'::jsonb)
    into v_entries
    from public.ranking_entries re
   where re.ranking_id = OLD.id;

  insert into public.ranking_revisions (
    ranking_id,
    user_id,
    operation,
    title,
    ranking_type,
    status,
    ranking_snapshot,
    entries_snapshot
  )
  values (
    OLD.id,
    OLD.user_id,
    TG_OP,
    OLD.title,
    OLD.ranking_type,
    OLD.status,
    to_jsonb(OLD),
    v_entries
  );

  -- Cap UPDATE revisions at the 5 most recent per ranking_id
  if TG_OP = 'UPDATE' then
    delete from public.ranking_revisions
     where ranking_id = OLD.id
       and operation = 'UPDATE'
       and id not in (
         select id
           from public.ranking_revisions
          where ranking_id = OLD.id
            and operation = 'UPDATE'
          order by created_at desc
          limit 5
       );
  end if;

  -- Prune DELETE snapshots older than 30 days across the table
  delete from public.ranking_revisions
   where operation = 'DELETE'
     and created_at < now() - interval '30 days';

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_capture_ranking_revision on public.rankings;
create trigger trg_capture_ranking_revision
  before update or delete on public.rankings
  for each row
  execute function public.capture_ranking_revision();

-- One-call admin restore helper: restores a ranking row and its ranking_entries from a revision snapshot
create or replace function public.restore_ranking_revision(target_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev public.ranking_revisions%rowtype;
  v_r jsonb;
  v_entry jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  ) then
    raise exception 'Admin access required';
  end if;

  select * into v_rev
    from public.ranking_revisions
   where id = target_revision_id;

  if not found then
    raise exception 'Revision % not found', target_revision_id;
  end if;

  v_r := v_rev.ranking_snapshot;

  insert into public.rankings (
    id,
    user_id,
    season_id,
    division_id,
    edition_id,
    title,
    author_notes,
    status,
    published_at,
    created_at,
    updated_at,
    league_name_snapshot,
    season_name_snapshot,
    division_name_snapshot,
    division_logo_snapshot,
    division_theme_snapshot,
    edition_name_snapshot,
    overlays,
    ranking_type,
    tier_data,
    tier_variant
  )
  values (
    (v_r->>'id')::uuid,
    (v_r->>'user_id')::uuid,
    nullif(v_r->>'season_id', '')::uuid,
    nullif(v_r->>'division_id', '')::uuid,
    nullif(v_r->>'edition_id', '')::uuid,
    coalesce(v_r->>'title', 'Restored Ranking'),
    coalesce(v_r->>'author_notes', ''),
    coalesce(v_r->>'status', 'published'),
    nullif(v_r->>'published_at', '')::timestamptz,
    coalesce(nullif(v_r->>'created_at', '')::timestamptz, now()),
    now(),
    v_r->>'league_name_snapshot',
    v_r->>'season_name_snapshot',
    v_r->>'division_name_snapshot',
    v_r->>'division_logo_snapshot',
    v_r->>'division_theme_snapshot',
    v_r->>'edition_name_snapshot',
    coalesce(v_r->'overlays', '[]'::jsonb),
    coalesce(v_r->>'ranking_type', 'team'),
    v_r->'tier_data',
    v_r->>'tier_variant'
  )
  on conflict (id) do update set
    title = excluded.title,
    author_notes = excluded.author_notes,
    status = excluded.status,
    published_at = excluded.published_at,
    updated_at = now(),
    overlays = excluded.overlays,
    tier_data = excluded.tier_data,
    tier_variant = excluded.tier_variant;

  if coalesce(v_r->>'ranking_type', 'team') = 'team' then
    delete from public.ranking_entries where ranking_id = (v_r->>'id')::uuid;

    for v_entry in select * from jsonb_array_elements(coalesce(v_rev.entries_snapshot, '[]'::jsonb))
    loop
      insert into public.ranking_entries (
        ranking_id,
        team_id,
        rank,
        previous_rank,
        rank_change,
        commentary,
        team_name_snapshot,
        team_logo_snapshot,
        roster_snapshot
      )
      values (
        (v_r->>'id')::uuid,
        nullif(v_entry->>'team_id', '')::uuid,
        (v_entry->>'rank')::integer,
        nullif(v_entry->>'previous_rank', '')::integer,
        nullif(v_entry->>'rank_change', '')::integer,
        coalesce(v_entry->>'commentary', ''),
        coalesce(v_entry->>'team_name_snapshot', 'Team'),
        v_entry->>'team_logo_snapshot',
        coalesce(v_entry->'roster_snapshot', '[]'::jsonb)
      );
    end loop;
  end if;

  return (v_r->>'id')::uuid;
end;
$$;

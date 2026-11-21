-- Moderation events audit log for pre-publish blocks, auto-unpublishes, soft flags, and media reviews

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  content_type text not null check (content_type in ('ranking', 'tierlist', 'blog')),
  content_id uuid,
  action text not null check (action in ('blocked', 'auto_unpublished', 'flagged', 'media_review')),
  categories text[] not null default '{}',
  field_names text[] not null default '{}',
  matched_terms text[] not null default '{}',
  title_snapshot text,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists moderation_events_created_at_idx
  on public.moderation_events (resolved, created_at desc);

alter table public.moderation_events enable row level security;

drop policy if exists "Admins can view moderation events" on public.moderation_events;
create policy "Admins can view moderation events"
  on public.moderation_events for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update moderation events" on public.moderation_events;
create policy "Admins can update moderation events"
  on public.moderation_events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete moderation events" on public.moderation_events;
create policy "Admins can delete moderation events"
  on public.moderation_events for delete
  to authenticated
  using (public.is_admin());

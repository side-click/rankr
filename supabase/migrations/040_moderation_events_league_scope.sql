-- Add league_id scoping and operator RLS policies to moderation_events

alter table public.moderation_events
  add column if not exists league_id uuid references public.leagues(id) on delete set null;

create index if not exists moderation_events_league_id_idx
  on public.moderation_events (league_id, resolved, created_at desc);

-- Backfill existing moderation_events.league_id from rankings -> seasons and blogs -> seasons
update public.moderation_events me
set league_id = s.league_id
from public.rankings r
join public.seasons s on s.id = r.season_id
where me.league_id is null
  and me.content_type in ('ranking', 'tierlist')
  and me.content_id = r.id;

update public.moderation_events me
set league_id = s.league_id
from public.blogs b
join public.seasons s on s.id = b.season_id
where me.league_id is null
  and me.content_type = 'blog'
  and me.content_id = b.id;

-- Operator-scoped policies (using existing public.is_league_operator(uuid) from 037_multi_league_rbac.sql)
drop policy if exists "League operators can view moderation events" on public.moderation_events;
create policy "League operators can view moderation events"
  on public.moderation_events for select
  to authenticated
  using (league_id is not null and public.is_league_operator(league_id));

drop policy if exists "League operators can update moderation events" on public.moderation_events;
create policy "League operators can update moderation events"
  on public.moderation_events for update
  to authenticated
  using (league_id is not null and public.is_league_operator(league_id))
  with check (league_id is not null and public.is_league_operator(league_id));

drop policy if exists "League operators can delete moderation events" on public.moderation_events;
create policy "League operators can delete moderation events"
  on public.moderation_events for delete
  to authenticated
  using (league_id is not null and public.is_league_operator(league_id));

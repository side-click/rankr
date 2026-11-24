-- 039_security_hardening.sql
-- Hardens profile privilege escalation, creator publishing moderation bypass,
-- public profiles exposure, cross-league operator gaps, tournament codes, and storage buckets.

-- 1. Prevent non-admin / non-service-role users from mutating privileged profile columns
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     or new.is_banned is distinct from old.is_banned
     or new.ban_reason is distinct from old.ban_reason
     or new.discord_id is distinct from old.discord_id then
    raise exception 'Insufficient privileges to modify protected profile columns';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_columns on public.profiles;
create trigger trg_protect_profile_privileged_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();

-- 2. Expose only safe public display columns via public_profiles view and restrict direct profiles reads
create or replace view public.public_profiles
  with (security_invoker = false)
as
  select id, username, avatar_url
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Profiles readable by self, admins, and operators" on public.profiles;
create policy "Profiles readable by self, admins, and operators"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_admin()
    or public.is_any_league_operator()
  );

-- 3. Helper for storage buckets: allow uploads by any non-banned user eligible for global or league authoring
create or replace function public.can_upload_creator_media()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or public.is_allowlisted()
    or public.is_any_league_operator()
    or exists (
      select 1
      from public.league_allowed_users la
      join public.profiles p on p.discord_id = la.discord_id
      where p.id = auth.uid()
    )
    or exists (
      select 1
      from public.leagues l
      where l.require_allowlist = false
    );
$$;

grant execute on function public.can_upload_creator_media() to authenticated;

-- 4. Lock client writes on rankings, ranking_entries, and blogs to status = 'draft'
-- (Publishing, unpublishing published content, and overlay moderation run through server API /api/publish)
drop policy if exists "Users can insert own ballots" on public.rankings;
create policy "Users can insert own ballots"
  on public.rankings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and status = 'draft'
    and season_id is not null
    and public.is_allowlisted_for_league(
      (select s.league_id from public.seasons s where s.id = season_id)
    )
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (ranking_type = 'player' or e.is_players_only = false)
    )
  );

drop policy if exists "Users can update own ballots when edition is open" on public.rankings;
create policy "Users can update own ballots when edition is open"
  on public.rankings for update
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and status = 'draft'
    and season_id is not null
    and public.is_allowlisted_for_league(
      (select s.league_id from public.seasons s where s.id = season_id)
    )
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (ranking_type = 'player' or e.is_players_only = false)
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and status = 'draft'
    and season_id is not null
    and public.is_allowlisted_for_league(
      (select s.league_id from public.seasons s where s.id = season_id)
    )
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (ranking_type = 'player' or e.is_players_only = false)
    )
  );

drop policy if exists "Users can delete own draft ballots" on public.rankings;
create policy "Users can delete own draft ballots"
  on public.rankings for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
  );

drop policy if exists "Users can insert entries for own ballots" on public.ranking_entries;
create policy "Users can insert entries for own ballots"
  on public.ranking_entries for insert
  to authenticated
  with check (
    public.is_not_banned()
    and public.is_app_enabled()
    and exists (
      select 1
      from public.rankings r
      join public.editions e on e.id = r.edition_id
      where r.id = ranking_id
        and r.user_id = auth.uid()
        and r.status = 'draft'
        and r.season_id is not null
        and e.is_archived = false
        and (r.ranking_type = 'player' or e.is_players_only = false)
        and public.is_allowlisted_for_league(
          (select s.league_id from public.seasons s where s.id = r.season_id)
        )
    )
  );

drop policy if exists "Users can update entries for own open ballots" on public.ranking_entries;
create policy "Users can update entries for own open ballots"
  on public.ranking_entries for update
  to authenticated
  using (
    public.is_not_banned()
    and public.is_app_enabled()
    and exists (
      select 1
      from public.rankings r
      join public.editions e on e.id = r.edition_id
      where r.id = ranking_id
        and r.user_id = auth.uid()
        and r.status = 'draft'
        and r.season_id is not null
        and e.is_archived = false
        and (r.ranking_type = 'player' or e.is_players_only = false)
        and public.is_allowlisted_for_league(
          (select s.league_id from public.seasons s where s.id = r.season_id)
        )
    )
  );

drop policy if exists "Users can delete entries for own open ballots" on public.ranking_entries;
create policy "Users can delete entries for own open ballots"
  on public.ranking_entries for delete
  to authenticated
  using (
    public.is_not_banned()
    and public.is_app_enabled()
    and exists (
      select 1
      from public.rankings r
      join public.editions e on e.id = r.edition_id
      where r.id = ranking_id
        and r.user_id = auth.uid()
        and r.status = 'draft'
        and r.season_id is not null
        and e.is_archived = false
        and (r.ranking_type = 'player' or e.is_players_only = false)
        and public.is_allowlisted_for_league(
          (select s.league_id from public.seasons s where s.id = r.season_id)
        )
    )
  );

drop policy if exists "Allowlisted users can insert own blogs" on public.blogs;
create policy "Allowlisted users can insert own blogs"
  on public.blogs for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and status = 'draft'
    and (
      case
        when season_id is null then public.is_allowlisted()
        else public.is_allowlisted_for_league(
          (select s.league_id from public.seasons s where s.id = season_id)
        )
      end
    )
  );

drop policy if exists "Allowlisted users can update own blogs" on public.blogs;
create policy "Allowlisted users can update own blogs"
  on public.blogs for update
  to authenticated
  using (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
      and status = 'draft'
      and (
        case
          when season_id is null then public.is_allowlisted()
          else public.is_allowlisted_for_league(
            (select s.league_id from public.seasons s where s.id = season_id)
          )
        end
      )
    )
    or public.is_admin()
  )
  with check (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
      and status = 'draft'
      and (
        case
          when season_id is null then public.is_allowlisted()
          else public.is_allowlisted_for_league(
            (select s.league_id from public.seasons s where s.id = season_id)
          )
        end
      )
    )
    or public.is_admin()
  );

drop policy if exists "Users or admins can delete blogs" on public.blogs;
create policy "Users or admins can delete blogs"
  on public.blogs for delete
  to authenticated
  using (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
    )
    or public.is_admin()
  );

-- 5. Cross-league & tournament security fixes
drop policy if exists "Operators can manage division_themes" on public.division_themes;
drop policy if exists "Admins can manage division themes" on public.division_themes;
create policy "Admins can manage division themes"
  on public.division_themes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Operators manage season_matches" on public.season_matches;
create policy "Operators manage season_matches"
  on public.season_matches for all
  to authenticated
  using (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_matches.season_id)
    )
  )
  with check (
    public.is_league_operator(
      (select s.league_id from public.seasons s where s.id = season_matches.season_id)
    )
    and exists (
      select 1 from public.divisions d
      where d.id = division_id
        and d.season_id = season_matches.season_id
    )
    and (
      team_a_id is null
      or exists (
        select 1
        from public.teams ta
        join public.divisions da on da.id = ta.division_id
        where ta.id = team_a_id
          and da.season_id = season_matches.season_id
      )
    )
    and (
      team_b_id is null
      or exists (
        select 1
        from public.teams tb
        join public.divisions db on db.id = tb.division_id
        where tb.id = team_b_id
          and db.season_id = season_matches.season_id
      )
    )
  );

-- Tournament codes are created/regenerated exclusively by /api/matches/tournament-code using service role
drop policy if exists "Captains and operators insert tournament_codes" on public.tournament_codes;

-- 6. Storage bucket hardening
update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'team-logos';

drop policy if exists "Users can upload own ballot overlays" on storage.objects;
drop policy if exists "Users can upload own ranking overlays" on storage.objects;
create policy "Users can upload own ranking overlays"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ranking-overlays'
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.can_upload_creator_media()
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
        public.is_not_banned()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

drop policy if exists "Allowlisted users can upload own blog media" on storage.objects;
create policy "Allowlisted users can upload own blog media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blog-media'
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.can_upload_creator_media()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users or admins can delete blog media" on storage.objects;
create policy "Users or admins can delete blog media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'blog-media'
    and (
      public.is_admin()
      or (
        public.is_not_banned()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

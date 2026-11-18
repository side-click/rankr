-- Allow public read-only SELECT on cached SoloQ/mastery stats for /stats scouting pages.
-- Write access (INSERT/UPDATE/DELETE) remains strictly restricted to admins and service_role.
drop policy if exists "Public can read riot_player_stats" on public.riot_player_stats;
create policy "Public can read riot_player_stats"
  on public.riot_player_stats
  for select
  using (true);

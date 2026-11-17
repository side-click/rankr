-- Update stored relative /images/... paths to match the reorganized public/images/ hierarchy

-- 1. Leagues
update public.leagues
set logo_url = '/images/leagues/scdl/logo.png'
where logo_url = '/images/SCDL Logos/SCDL.png';

-- 2. Division Themes & Divisions
update public.division_themes
set default_logo_url = case default_logo_url
  when '/images/SCDL Logos/Baron.png' then '/images/leagues/scdl/divisions/baron.png'
  when '/images/SCDL Logos/Dragon.png' then '/images/leagues/scdl/divisions/dragon.png'
  else default_logo_url
end
where default_logo_url in ('/images/SCDL Logos/Baron.png', '/images/SCDL Logos/Dragon.png');

update public.divisions
set logo_url = case logo_url
  when '/images/SCDL Logos/Baron.png' then '/images/leagues/scdl/divisions/baron.png'
  when '/images/SCDL Logos/Dragon.png' then '/images/leagues/scdl/divisions/dragon.png'
  else logo_url
end
where logo_url in ('/images/SCDL Logos/Baron.png', '/images/SCDL Logos/Dragon.png');

-- 3. Teams
update public.teams
set logo_url = case logo_url
  when '/images/4.5 Team Logos/Baron/Bandits - Papa Doge.PNG' then '/images/leagues/scdl/seasons/4-5/baron/bandits.png'
  when '/images/4.5 Team Logos/Baron/Catboys - Memersticks.png' then '/images/leagues/scdl/seasons/4-5/baron/catboys.png'
  when '/images/4.5 Team Logos/Baron/Checkmates - Sideclick.png' then '/images/leagues/scdl/seasons/4-5/baron/checkmates.png'
  when '/images/4.5 Team Logos/Baron/Chickens - Earleking.png' then '/images/leagues/scdl/seasons/4-5/baron/chickens.png'
  when '/images/4.5 Team Logos/Baron/EARLEKING_WHERE_IS_YOUR_LOGO-removebg-preview.png' then '/images/leagues/scdl/seasons/4-5/baron/chickens.png'
  when '/images/4.5 Team Logos/Baron/Ghoulblins - Rizzurection.png' then '/images/leagues/scdl/seasons/4-5/baron/ghoulblins.png'
  when '/images/4.5 Team Logos/Baron/Gunkers - LestForce.png' then '/images/leagues/scdl/seasons/4-5/baron/gunkers.png'
  when '/images/4.5 Team Logos/Baron/Miners - Tactical Porkchop.png' then '/images/leagues/scdl/seasons/4-5/baron/miners.png'
  when '/images/4.5 Team Logos/Baron/Mud Newts - Askalabos.png' then '/images/leagues/scdl/seasons/4-5/baron/mud-newts.png'
  when '/images/4.5 Team Logos/Dragon/Bandle City - toxicagentp.png' then '/images/leagues/scdl/seasons/4-5/dragon/bandle-city.png'
  when '/images/4.5 Team Logos/Dragon/Breadwinners - EightTimes.png' then '/images/leagues/scdl/seasons/4-5/dragon/breadwinners.png'
  when '/images/4.5 Team Logos/Dragon/Chudmates - Slippy.png' then '/images/leagues/scdl/seasons/4-5/dragon/chudmates.png'
  when '/images/4.5 Team Logos/Dragon/Duck Donuts - Thoolum.png' then '/images/leagues/scdl/seasons/4-5/dragon/duck-donuts.png'
  when '/images/4.5 Team Logos/Dragon/Globetrotters - Brehio.png' then '/images/leagues/scdl/seasons/4-5/dragon/globetrotters.png'
  when '/images/4.5 Team Logos/Dragon/Milk - ME Soul.png' then '/images/leagues/scdl/seasons/4-5/dragon/milk.png'
  when '/images/4.5 Team Logos/Dragon/Milkshakes - FunkyOdor.png' then '/images/leagues/scdl/seasons/4-5/dragon/milkshakes.png'
  when '/images/4.5 Team Logos/Dragon/Ticks - slopytugg.jpg' then '/images/leagues/scdl/seasons/4-5/dragon/ticks.jpg'
  else logo_url
end
where logo_url like '/images/4.5 Team Logos/%';

-- 4. Historical ballot snapshots
update public.ballots
set division_logo_snapshot = case division_logo_snapshot
  when '/images/SCDL Logos/Baron.png' then '/images/leagues/scdl/divisions/baron.png'
  when '/images/SCDL Logos/Dragon.png' then '/images/leagues/scdl/divisions/dragon.png'
  else division_logo_snapshot
end
where division_logo_snapshot in ('/images/SCDL Logos/Baron.png', '/images/SCDL Logos/Dragon.png');

update public.ballot_entries
set team_logo_snapshot = case team_logo_snapshot
  when '/images/4.5 Team Logos/Baron/Bandits - Papa Doge.PNG' then '/images/leagues/scdl/seasons/4-5/baron/bandits.png'
  when '/images/4.5 Team Logos/Baron/Catboys - Memersticks.png' then '/images/leagues/scdl/seasons/4-5/baron/catboys.png'
  when '/images/4.5 Team Logos/Baron/Checkmates - Sideclick.png' then '/images/leagues/scdl/seasons/4-5/baron/checkmates.png'
  when '/images/4.5 Team Logos/Baron/Chickens - Earleking.png' then '/images/leagues/scdl/seasons/4-5/baron/chickens.png'
  when '/images/4.5 Team Logos/Baron/EARLEKING_WHERE_IS_YOUR_LOGO-removebg-preview.png' then '/images/leagues/scdl/seasons/4-5/baron/chickens.png'
  when '/images/4.5 Team Logos/Baron/Ghoulblins - Rizzurection.png' then '/images/leagues/scdl/seasons/4-5/baron/ghoulblins.png'
  when '/images/4.5 Team Logos/Baron/Gunkers - LestForce.png' then '/images/leagues/scdl/seasons/4-5/baron/gunkers.png'
  when '/images/4.5 Team Logos/Baron/Miners - Tactical Porkchop.png' then '/images/leagues/scdl/seasons/4-5/baron/miners.png'
  when '/images/4.5 Team Logos/Baron/Mud Newts - Askalabos.png' then '/images/leagues/scdl/seasons/4-5/baron/mud-newts.png'
  when '/images/4.5 Team Logos/Dragon/Bandle City - toxicagentp.png' then '/images/leagues/scdl/seasons/4-5/dragon/bandle-city.png'
  when '/images/4.5 Team Logos/Dragon/Breadwinners - EightTimes.png' then '/images/leagues/scdl/seasons/4-5/dragon/breadwinners.png'
  when '/images/4.5 Team Logos/Dragon/Chudmates - Slippy.png' then '/images/leagues/scdl/seasons/4-5/dragon/chudmates.png'
  when '/images/4.5 Team Logos/Dragon/Duck Donuts - Thoolum.png' then '/images/leagues/scdl/seasons/4-5/dragon/duck-donuts.png'
  when '/images/4.5 Team Logos/Dragon/Globetrotters - Brehio.png' then '/images/leagues/scdl/seasons/4-5/dragon/globetrotters.png'
  when '/images/4.5 Team Logos/Dragon/Milk - ME Soul.png' then '/images/leagues/scdl/seasons/4-5/dragon/milk.png'
  when '/images/4.5 Team Logos/Dragon/Milkshakes - FunkyOdor.png' then '/images/leagues/scdl/seasons/4-5/dragon/milkshakes.png'
  when '/images/4.5 Team Logos/Dragon/Ticks - slopytugg.jpg' then '/images/leagues/scdl/seasons/4-5/dragon/ticks.jpg'
  else team_logo_snapshot
end
where team_logo_snapshot like '/images/4.5 Team Logos/%';

-- ============================================================
-- Seed Data: Scuttle Crab Draft League (Season 4.5)
-- ============================================================

do $$
declare
  v_season_id uuid;
  v_baron_id uuid;
  v_dragon_id uuid;
begin
  -- Season 4.5
  insert into public.seasons (name, slug, is_active)
  values ('Season 4.5', 'season-4-5', true)
  on conflict (slug) do update set name = excluded.name
  returning id into v_season_id;

  -- Divisions
  insert into public.divisions (season_id, name, slug, logo_url, theme_key)
  values (v_season_id, 'Baron Division', 'baron', '/images/SCDL Logos/Baron.png', 'baron')
  on conflict (season_id, slug) do update set logo_url = excluded.logo_url
  returning id into v_baron_id;

  insert into public.divisions (season_id, name, slug, logo_url, theme_key)
  values (v_season_id, 'Dragon Division', 'dragon', '/images/SCDL Logos/Dragon.png', 'dragon')
  on conflict (season_id, slug) do update set logo_url = excluded.logo_url
  returning id into v_dragon_id;

  -- Editions
  insert into public.editions (season_id, name, slug, sort_order, is_open) values
    (v_season_id, 'Pre-Season', 'pre-season', 0, true),
    (v_season_id, 'Week 1', 'week-1', 1, true),
    (v_season_id, 'Week 2', 'week-2', 2, true),
    (v_season_id, 'Week 3', 'week-3', 3, true),
    (v_season_id, 'Week 4', 'week-4', 4, true),
    (v_season_id, 'Week 5', 'week-5', 5, true),
    (v_season_id, 'Week 6', 'week-6', 6, true),
    (v_season_id, 'Playoffs', 'playoffs', 7, true)
  on conflict (season_id, slug) do nothing;

  -- Baron Division Teams (only insert if none exist yet for Baron)
  if not exists (select 1 from public.teams where division_id = v_baron_id) then
    insert into public.teams (division_id, name, captain, logo_url, roster, default_order) values
      (v_baron_id, 'Bandits', 'Papa Doge', '/images/4.5 Team Logos/Baron/Bandits - Papa Doge.PNG',
        '["Vacant Tech#NA1","SlipperySpencer#SLIP","Papa Doge#koty","Jeeves the RAT#RAT","waffles#deera"]'::jsonb, 1),
      (v_baron_id, 'Catboys', 'Memersticks', '/images/4.5 Team Logos/Baron/Catboys - Memersticks.png',
        '["Unkindness#ELEM","Vengeful#fob","Koality Player#NA1","Rechu#ADC","Memersticks#NA1"]'::jsonb, 2),
      (v_baron_id, 'Checkmates', 'Sideclick', '/images/4.5 Team Logos/Baron/Checkmates - Sideclick.png',
        '["Beniona#NA1","Jungle Jim#JGJIM","Twenty1#NA21","Zafa#NA1","Sideclick#NA1"]'::jsonb, 3),
      (v_baron_id, 'Chickens', 'Earleking', '/images/4.5 Team Logos/Baron/EARLEKING_WHERE_IS_YOUR_LOGO-removebg-preview.png',
        '["Hortikius#NA1","DailyPeach#NA1","Earleking#na1","Arcadius#NA1","Kurgan#NA1"]'::jsonb, 4),
      (v_baron_id, 'Ghoulblins', 'Rizzurection', '/images/4.5 Team Logos/Baron/Ghoulblins - Rizzurection.png',
        '["Rizzurection#NA1","Speculative#xdx3","Murdravox#DD4T","MAWZ#AWRF","Sethy#888"]'::jsonb, 5),
      (v_baron_id, 'Gunkers', 'LestForce', '/images/4.5 Team Logos/Baron/Gunkers - LestForce.png',
        '["ad altiora tendo#astra","LestForce#NA1","dream to me#iamop","Cuddlebear#rival","briikachu#808"]'::jsonb, 6),
      (v_baron_id, 'Miners', 'Tactical Porkchop', '/images/4.5 Team Logos/Baron/Miners - Tactical Porkchop.png',
        '["TSuki#1349","JojoPjerg#NA1","TacticalPorkchop#NA1","PrinceOfTheVoid#Reign","Vexrax#Gank"]'::jsonb, 7),
      (v_baron_id, 'Mud Newts', 'Askalabos', '/images/4.5 Team Logos/Baron/Mud Newts - Askalabos.png',
        '["jalex#vIV","Poro in a Box#PORO","strive#002","Askalabos#NA1","leunarie#ivy"]'::jsonb, 8);
  end if;

  -- Dragon Division Teams (only insert if none exist yet for Dragon)
  if not exists (select 1 from public.teams where division_id = v_dragon_id) then
    insert into public.teams (division_id, name, captain, logo_url, roster, default_order) values
      (v_dragon_id, 'Bandle City', 'toxicagentp', '/images/4.5 Team Logos/Dragon/Bandle City - toxicagentp.png',
        '["KingOfSpades#205","Grant#erino","MetroDragneel#Pkmon","toxicagentp#NA1","T5M GodAlive#T5M"]'::jsonb, 1),
      (v_dragon_id, 'Breadwinners', 'EightTimes', '/images/4.5 Team Logos/Dragon/Breadwinners - EightTimes.png',
        '["BlancoMamba#NA1","Ram#Ramss","EightTimes#T5M","Boy with Apples#storm","charmweaver#ahri"]'::jsonb, 2),
      (v_dragon_id, 'Chudmates', 'Slippy', '/images/4.5 Team Logos/Dragon/Chudmates - Slippy.png',
        '["Rin#khan","Slippy#7776","ryry2412#NA1","doraji#qwer","zen#047"]'::jsonb, 3),
      (v_dragon_id, 'Duck Donuts', 'Thoolum', '/images/4.5 Team Logos/Dragon/Duck Donuts - Thoolum.png',
        '["Sanserino34#SBET","Ubys#NA1","Retisol#NA1","thoolum#kupo","bjorg#123"]'::jsonb, 4),
      (v_dragon_id, 'Globetrotters', 'Brehio', '/images/4.5 Team Logos/Dragon/Globetrotters - Brehio.png',
        '["CoachPizza#NA1","brehio#crab","Zoodiac#すべて同じ","dryan#77555","Full Metal#Flame"]'::jsonb, 5),
      (v_dragon_id, 'Milk', 'ME Soul', '/images/4.5 Team Logos/Dragon/Milk - ME Soul.png',
        '["Jakester#NA1","itsfequalsma#rival","Sarcalex#LUFFY","ME Soul#tshy","The Mighty Fool#NA1"]'::jsonb, 6),
      (v_dragon_id, 'Milkshakes', 'FunkyOdor', '/images/4.5 Team Logos/Dragon/Milkshakes - FunkyOdor.png',
        '["FunkyOdor#NA0","Psaro#SEES","prof foghorn#NA1","Drox#NA1","NU MOAR F33DANG#NA1"]'::jsonb, 7),
      (v_dragon_id, 'Ticks', 'slopytugg', '/images/4.5 Team Logos/Dragon/Ticks - slopytugg.jpg',
        '["Redest#NA1","TWaynee#NA1","Big Fella Gabe#BIG","soulbert#koggy","slopytugg#na1"]'::jsonb, 8);
  end if;
end $$;

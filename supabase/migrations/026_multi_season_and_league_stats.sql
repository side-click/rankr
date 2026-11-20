-- 026_multi_season_and_league_stats.sql
-- Multi-season and multi-league stats resilience:
-- 1. Explicit per-season stats provider, sheet config, and credits attribution
-- 2. Database-backed match_drafts table (seeded with SCDL Season 4.5 drafts)
-- 3. Canonical league_game_participants table for non-sheet leagues / custom importers

alter table public.seasons
  add column if not exists stats_provider text not null default 'google_sheet',
  add column if not exists stats_credits_label text,
  add column if not exists stats_credits_url text,
  add column if not exists stats_credits_attribution text;

-- Backfill SCDL Season 4.5 explicitly so it never relies on hardcoded fallbacks
update public.seasons
set
  stats_provider = 'google_sheet',
  stats_sheet_id = coalesce(nullif(trim(stats_sheet_id), ''), '1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A'),
  stats_sheet_gids = case
    when stats_sheet_gids is null or array_length(stats_sheet_gids, 1) is null
    then array['1733612942', '1849724071']
    else stats_sheet_gids
  end,
  stats_credits_label = coalesce(nullif(trim(stats_credits_label), ''), 'SCDL 4.5 Master Google Sheet'),
  stats_credits_url = coalesce(nullif(trim(stats_credits_url), ''), 'https://docs.google.com/spreadsheets/d/1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A'),
  stats_credits_attribution = coalesce(nullif(trim(stats_credits_attribution), ''), 'the SCDL Admin Team (special thanks to Pandora)')
where slug = 'season-4-5' or name ilike '%4.5%';

-- Database-backed match drafts
create table if not exists public.match_drafts (
  game_id text primary key,
  season_id uuid references public.seasons(id) on delete set null,
  blue_team text not null,
  red_team text not null,
  blue_bans jsonb not null default '[]'::jsonb,
  red_bans jsonb not null default '[]'::jsonb,
  blue_picks jsonb not null default '[]'::jsonb,
  red_picks jsonb not null default '[]'::jsonb,
  source_url text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_match_drafts_season_id on public.match_drafts(season_id);

alter table public.match_drafts enable row level security;

drop policy if exists "Public can read match_drafts" on public.match_drafts;
create policy "Public can read match_drafts"
  on public.match_drafts for select
  using (true);

drop policy if exists "Admins can manage match_drafts" on public.match_drafts;
create policy "Admins can manage match_drafts"
  on public.match_drafts for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Seed existing 24 SCDL 4.5 drafts idempotently
insert into public.match_drafts (
  game_id, season_id, blue_team, red_team, blue_bans, red_bans, blue_picks, red_picks, source_url
)
values
  ('5680663535', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Milk', 'Breadwinners', '["LeeSin","Galio","Veigar","Rakan","Ornn"]'::jsonb, '["Nocturne","Fizz","Zac","Yone","Kassadin"]'::jsonb, '["Seraphine","Ashe","Amumu","Kayle","Jax"]'::jsonb, '["Skarner","Ziggs","Xayah","Sylas","Sion"]'::jsonb, 'https://draft.lowbudgetlcs.com/MG3FhflAVS'),
  ('5680632994', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Globetrotters', 'Ticks', '["Trundle","Vi","Ashe","Gwen","Mordekaiser"]'::jsonb, '["Viego","Sylas","Naafiri"]'::jsonb, '["Aurora","Sivir","Braum","Ornn","MonkeyKing"]'::jsonb, '["Thresh","Ahri","Jhin","Volibear","Vladimir"]'::jsonb, 'https://draft.lowbudgetlcs.com/t5qQP6SPT8/t7QBFQgPL1'),
  ('5680614674', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Duck Donuts', 'Breadwinners', '["Caitlyn","Ashe","Lucian","Rakan","Alistar"]'::jsonb, '["Locke","Xayah","Rengar","Cassiopeia","Taliyah"]'::jsonb, '["Jhin","TahmKench","MonkeyKing","Ambessa","Katarina"]'::jsonb, '["Orianna","Vi","Smolder","Nami","Urgot"]'::jsonb, 'https://draft.lowbudgetlcs.com/0AYcZrPI5i'),
  ('5680614603', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Bandle City', 'Milkshakes', '["Kayn","Lissandra","Nocturne","Rakan","Malphite"]'::jsonb, '["Akali","Thresh","MonkeyKing","Yorick","Syndra"]'::jsonb, '["Naafiri","Ashe","Seraphine","Viktor","Sett"]'::jsonb, '["XinZhao","Xayah","Mel","Braum","Ornn"]'::jsonb, 'https://draft.lowbudgetlcs.com/fearless/sJd8znD4tj/nooh5j1JKs/nz5TymELZn'),
  ('5680621994', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Chudmates', 'Milk', '["Nocturne","Zac","Sylas","Yone","Jax"]'::jsonb, '["TwistedFate","MonkeyKing","Caitlyn","Galio","Shen"]'::jsonb, '["JarvanIV","Aphelios","Thresh","Leblanc","Gnar"]'::jsonb, '["Ezreal","Nami","Briar","Locke","Ornn"]'::jsonb, 'https://draft.lowbudgetlcs.com/L4GZGX8am9'),
  ('5680663669', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Bandle City', 'Globetrotters', '["Draven","Kalista","Sylas","Orianna","Vex"]'::jsonb, '["Akali","MonkeyKing","Aatrox","Yorick","Urgot"]'::jsonb, '["Zaahen","Aphelios","Thresh","Olaf","Lissandra"]'::jsonb, '["Zeri","Yuumi","XinZhao","Mordekaiser","Hwei"]'::jsonb, 'https://draft.lowbudgetlcs.com/DmMFg2WzZT/yMlPoNXuWq'),
  ('5680671193', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Duck Donuts', 'Ticks', '["Trundle","Aurora","Rell","Ekko","Akali"]'::jsonb, '["Darius","Lissandra","Renekton","Cassiopeia"]'::jsonb, '["Sivir","Lulu","Naafiri","Locke","Shen"]'::jsonb, '["Xayah","Vi","Rakan","Orianna","Aatrox"]'::jsonb, 'https://draftify.lol/draft/lbkm2jy1g?game=1'),
  ('5680671587', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Chudmates', 'Milkshakes', '["Kayn","Lissandra","Trundle","Orianna","Syndra"]'::jsonb, '["Galio","TwistedFate","MonkeyKing","Rumble","Ambessa"]'::jsonb, '["Sejuani","Yunara","Braum","Olaf","AurelionSol"]'::jsonb, '["Volibear","Caitlyn","Thresh","Poppy","Ryze"]'::jsonb, 'https://draft.lowbudgetlcs.com/FmvrsujUfD/fApz5uvbEk'),
  ('5680720847', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Globetrotters', 'Milk', '["Fizz","Zac","Nocturne","Fiddlesticks","Sylas"]'::jsonb, '["JarvanIV","Viktor","Viego","Rakan","Thresh"]'::jsonb, '["Zaahen","Akali","Xayah","Blitzcrank","Sion"]'::jsonb, '["Yone","Belveth","Ziggs","Lulu","AurelionSol"]'::jsonb, 'https://draft.lowbudgetlcs.com/r3W8vOdw9T/1Pl5F2pOKy'),
  ('5680709711', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Ticks', 'Bandle City', '["Akali","RekSai","Yasuo","Teemo"]'::jsonb, '["Aurora","Leona","Nocturne","Karma","Rell"]'::jsonb, '["Locke","Ashe","Jax","Shen","Nautilus"]'::jsonb, '["Jhin","MonkeyKing","Braum","Sylas","Yorick"]'::jsonb, 'https://draftify.lol/draft/pdjg0qk21?game=1'),
  ('5680714668', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Breadwinners', 'Chudmates', '["Caitlyn","MonkeyKing","Seraphine","Sivir","Nautilus"]'::jsonb, '["Ivern","JarvanIV","Poppy","Kaisa","Swain"]'::jsonb, '["Galio","LeeSin","Ornn","Janna","Lucian"]'::jsonb, '["TwistedFate","Shyvana","Camille","Xayah","Blitzcrank"]'::jsonb, 'https://draft.lowbudgetlcs.com/fearless/J89Jy6NOe5/sHlKJcBa1p/Rthwes7yui'),
  ('5680737895', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Milkshakes', 'Duck Donuts', '["Taliyah","Cassiopeia","Nami","Nocturne","Darius"]'::jsonb, '["Kayn","Lissandra","Jhin","Locke","Galio"]'::jsonb, '["MonkeyKing","Sivir","Milio","Syndra","Maokai"]'::jsonb, '["Ashe","Seraphine","Orianna","Diana","Olaf"]'::jsonb, 'https://draft.lowbudgetlcs.com/fearless/P3FSVlHmPO/Ie2qtnOLVk/4MO7jE1wUV'),
  ('5680629953', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Checkmates', 'Miners', '["Shyvana","Yunara","Orianna","Galio"]'::jsonb, '["Darius","Aatrox","MonkeyKing","Ambessa","Kennen"]'::jsonb, '["Kaisa","Leona","Pantheon","Veigar","Zaahen"]'::jsonb, '["Xayah","Rakan","Nocturne","Ryze","Ornn"]'::jsonb, 'https://drafter.lol/draft/2r9TAioZ?game=1'),
  ('5680624983', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Gunkers', 'Catboys', '["RekSai","Nautilus","Vi","Ahri","Leblanc"]'::jsonb, '["Lillia","MissFortune","Akali","Olaf","Trundle"]'::jsonb, '["Syndra","Yunara","Lulu","Ambessa","Sejuani"]'::jsonb, '["Ezreal","Karma","MonkeyKing","Orianna","Gnar"]'::jsonb, 'https://draft.lowbudgetlcs.com/8ih7A3EqAl/hc8loNAyLD'),
  ('5680627960', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Bandits', 'Ghoulblins', '["KSante","Blitzcrank","Aphelios","Teemo","Hwei"]'::jsonb, '["Anivia","Pantheon","Nocturne","Zyra","Olaf"]'::jsonb, '["Ezreal","Karma","Trundle","Cassiopeia","DrMundo"]'::jsonb, '["Ashe","Seraphine","JarvanIV","Locke","Ambessa"]'::jsonb, 'https://drafter.lol/draft/UpdQ9XJr?game=1'),
  ('5680628051', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Mud Newts', 'Chickens', '["Akali","Hecarim","Shyvana","Orianna","Gwen"]'::jsonb, '["Lucian","Lulu","Locke","Renekton"]'::jsonb, '["Xayah","Milio","XinZhao","KSante","Sylas"]'::jsonb, '["Ashe","Seraphine","Khazix","Ornn","Taliyah"]'::jsonb, 'https://draft.lowbudgetlcs.com/cwNQOb1HYN/4n4mHRTtQA'),
  ('5680678911', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Catboys', 'Miners', '["MonkeyKing","Ahri","Kayn","MissFortune","Pantheon"]'::jsonb, '["Darius","Qiyana","Nocturne","Ambessa","Mordekaiser"]'::jsonb, '["Syndra","Yunara","Lulu","Vi","Ornn"]'::jsonb, '["Hwei","JarvanIV","Rell","Caitlyn","Urgot"]'::jsonb, 'https://drafter.lol/draft/WLv7Y_1v?game=1'),
  ('5680681864', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Bandits', 'Checkmates', '["Darius","Aatrox","MonkeyKing","Syndra","KSante"]'::jsonb, '["Bard","Anivia","Xerath","Aurora"]'::jsonb, '["Lulu","Yunara","Chogath","Olaf","Diana"]'::jsonb, '["Nami","Corki","Lillia","Hwei","Renekton"]'::jsonb, 'https://drafter.lol/draft/3dJiCMDG?game=1'),
  ('5680680676', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Gunkers', 'Chickens', '["Viktor","Shyvana","Hecarim","Leona","Nautilus"]'::jsonb, '["Akali","Lillia","MissFortune","Rakan"]'::jsonb, '["Aurora","JarvanIV","Locke","Lucian","Milio"]'::jsonb, '["Syndra","Corki","Diana","Ambessa","Maokai"]'::jsonb, 'https://draft.lowbudgetlcs.com/4BzmfhO8wt/tgYBNy55NK'),
  ('5680697739', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Ghoulblins', 'Mud Newts', '["Jayce","Graves","Swain","JarvanIV","Renekton"]'::jsonb, '["Yorick","Darius","Jhin","MonkeyKing","Sivir"]'::jsonb, '["Hwei","Nautilus","Kaisa","Ornn","Khazix"]'::jsonb, '["Ashe","Seraphine","Locke","Qiyana","Camille"]'::jsonb, 'https://drafter.lol/draft/BRLhSRp8?game=1'),
  ('5680724406', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Catboys', 'Bandits', '["Urgot","Caitlyn","Corki","Jhin","Tristana"]'::jsonb, '["RekSai","XinZhao","KSante","Nautilus","Leona"]'::jsonb, '["Cassiopeia","Olaf","Sivir","Seraphine","Mordekaiser"]'::jsonb, '["Xerath","Amumu","Bard","Twitch","Darius"]'::jsonb, 'https://draft.lowbudgetlcs.com/xkxkomIpcY/AANXKkzbmR'),
  ('5680728560', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Miners', 'Gunkers', '["Kayn","MissFortune","Ashe","Ambessa","Renekton"]'::jsonb, '["Malphite","Cassiopeia","Ryze","Sivir","Aphelios"]'::jsonb, '["MonkeyKing","Yunara","Lulu","Ambessa","Ahri"]'::jsonb, '["Ezreal","Karma","Vi","Jayce","Viktor"]'::jsonb, 'https://drafter.lol/draft/D5_IPtFs?game=1'),
  ('5680735560', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Mud Newts', 'Checkmates', '["Darius","Caitlyn","Thresh","Aatrox","Olaf"]'::jsonb, '["Akali","Aurora","Yone","Viktor","Ryze"]'::jsonb, '["MonkeyKing","Ezreal","Janna","Renekton","Azir"]'::jsonb, '["Lucian","Nautilus","Chogath","Syndra","Gnar"]'::jsonb, 'https://drafter.lol/draft/rFayZuVc?game=1'),
  ('5680749360', (select id from public.seasons where slug = 'season-4-5' or name ilike '%4.5%' order by created_at desc limit 1), 'Ghoulblins', 'Chickens', '["Kayn","Akali","Gwen","Galio","Zed"]'::jsonb, '["Poppy","Sivir","Amumu","Graves"]'::jsonb, '["Syndra","Sylas","KSante","Xayah","Rakan"]'::jsonb, '["Jhin","Ahri","XinZhao","Renekton","Nautilus"]'::jsonb, 'https://drafter.lol/draft/yH6PwNnA?game=1')
on conflict (game_id) do nothing;

-- Canonical league_game_participants table for future non-sheet leagues or Riot Match-V5 custom-lobby imports
create table if not exists public.league_game_participants (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  game_id text not null,
  match_label text not null,
  team_name text not null,
  player_name text not null,
  champion text not null,
  role text not null,
  side text not null default 'Blue',
  win boolean not null default false,
  game_length integer not null default 0,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  gold integer not null default 0,
  cs integer not null default 0,
  damage_dealt integer not null default 0,
  vision_score integer not null default 0,
  double_kills integer not null default 0,
  triple_kills integer not null default 0,
  quadra_kills integer not null default 0,
  penta_kills integer not null default 0,
  solo_kills integer not null default 0,
  first_blood boolean not null default false,
  team_kills integer not null default 0,
  damage_taken integer not null default 0,
  damage_mitigated integer not null default 0,
  cc_score integer not null default 0,
  wards_placed integer not null default 0,
  wards_destroyed integer not null default 0,
  control_wards_bought integer not null default 0,
  damage_to_objectives integer not null default 0,
  damage_to_turrets integer not null default 0,
  dragons integer not null default 0,
  barons integer not null default 0,
  largest_killing_spree integer not null default 0,
  gold_diff_15 integer not null default 0,
  turret_plates integer not null default 0,
  objectives_stolen integer not null default 0,
  question_pings integer not null default 0,
  flash_key text,
  row_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (season_id, game_id, player_name)
);

create index if not exists idx_league_game_participants_season on public.league_game_participants(season_id, row_order);

alter table public.league_game_participants enable row level security;

drop policy if exists "Public can read league_game_participants" on public.league_game_participants;
create policy "Public can read league_game_participants"
  on public.league_game_participants for select
  using (true);

drop policy if exists "Admins can manage league_game_participants" on public.league_game_participants;
create policy "Admins can manage league_game_participants"
  on public.league_game_participants for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

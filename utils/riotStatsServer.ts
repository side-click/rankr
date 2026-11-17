import { createClient } from "@/utils/supabase/server";
import { normalizeRoster } from "@/utils/roles";
import { getLatestDdragonVersion } from "@/utils/riotApi";
import {
  aggregatePlayerStats,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
  type RiotPlayerStatRow,
} from "@/utils/riotStatsAggregation";

export interface LoadedAdminStatsContext {
  authorized: boolean;
  missingTable: boolean;
  hasRiotKey: boolean;
  ddVersion: string;
  leagueName: string;
  leagueLogoUrl: string | null;
  seasonName: string;
  seasonId: string | null;
  currentEditionName: string;
  divisions: { id: string; name: string; slug: string; logo_url: string | null; theme_key: string }[];
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
}

export async function loadAdminStatsContext(): Promise<LoadedAdminStatsContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }

  const hasRiotKey = Boolean(process.env.RIOT_API_KEY?.trim());
  const ddVersion = await getLatestDdragonVersion();

  if (!user || !isAdmin) {
    return {
      authorized: false,
      missingTable: false,
      hasRiotKey,
      ddVersion,
      leagueName: "",
      leagueLogoUrl: null,
      seasonName: "",
      seasonId: null,
      currentEditionName: "",
      divisions: [],
      players: [],
      teams: [],
    };
  }

  const [
    { data: seasons },
    { data: divisions },
    { data: teams },
    { data: editions },
    statsRes,
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, is_active, created_at, leagues ( name, logo_url )")
      .order("created_at", { ascending: false }),
    supabase
      .from("divisions")
      .select("id, name, slug, logo_url, theme_key, season_id")
      .order("name"),
    supabase
      .from("teams")
      .select("id, name, logo_url, division_id, roster, captain, default_order")
      .order("default_order"),
    supabase
      .from("editions")
      .select("id, name, season_id, is_open, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("riot_player_stats").select("*"),
  ]);

  const missingTable = Boolean(
    statsRes.error &&
      (statsRes.error.code === "42P01" ||
        statsRes.error.message.includes("riot_player_stats"))
  );

  const activeSeason =
    (seasons ?? []).find((s) => s.is_active) ?? (seasons ?? [])[0] ?? null;

  const leagueInfo = (
    activeSeason as unknown as {
      leagues?: { name?: string; logo_url?: string | null } | null;
    } | null
  )?.leagues;
  const leagueName = leagueInfo?.name ?? "SCDL";
  const leagueLogoUrl = leagueInfo?.logo_url ?? null;

  const seasonEditions = (editions ?? []).filter(
    (e) => !activeSeason || e.season_id === activeSeason.id
  );
  const openEditions = seasonEditions.filter((e) => e.is_open);
  const currentEditionName =
    (openEditions.length > 0
      ? openEditions[openEditions.length - 1]?.name
      : seasonEditions[seasonEditions.length - 1]?.name) ?? "Week 1";

  const seasonDivisions = (divisions ?? []).filter(
    (d) => !activeSeason || d.season_id === activeSeason.id
  );
  const divMap = new Map(seasonDivisions.map((d) => [d.id, d]));

  const statRows = (statsRes.data ?? []) as RiotPlayerStatRow[];
  const statByKey = new Map(statRows.map((r) => [r.player_key, r]));

  const seasonTeams = (teams ?? []).filter((t) => divMap.has(t.division_id));

  const aggregatedPlayers: AggregatedPlayerStats[] = [];
  const aggregatedTeams: AggregatedTeamStats[] = [];

  for (const team of seasonTeams) {
    const div = divMap.get(team.division_id);
    const roster = normalizeRoster(team.roster, team.captain);
    const teamPlayers: AggregatedPlayerStats[] = [];

    for (const slot of roster) {
      const cleanName = slot.name.trim();
      if (!cleanName) continue;
      const playerKey = cleanName.toLowerCase();
      const row = statByKey.get(playerKey);

      const agg = aggregatePlayerStats(row, {
        playerKey,
        riotId: cleanName,
        teamId: team.id,
        teamName: team.name,
        teamLogoUrl: team.logo_url ?? null,
        divisionId: team.division_id,
        divisionName: div?.name ?? "Division",
        role: slot.role,
        altAccounts: slot.alt_accounts ?? [],
      });

      aggregatedPlayers.push(agg);
      teamPlayers.push(agg);
    }

    const allMatches = teamPlayers.flatMap((p) => p.matches);
    const games = allMatches.length;
    const wins = allMatches.filter((m) => m.win).length;
    const blueMatches = allMatches.filter((m) => m.teamId === 100);
    const redMatches = allMatches.filter((m) => m.teamId === 200);
    const totalKills = allMatches.reduce((s, m) => s + m.kills, 0);
    const totalDeaths = allMatches.reduce((s, m) => s + m.deaths, 0);
    const totalAssists = allMatches.reduce((s, m) => s + m.assists, 0);
    const totalDmg = allMatches.reduce(
      (s, m) => s + m.totalDamageDealtToChampions,
      0
    );
    const totalGold = allMatches.reduce((s, m) => s + m.goldEarned, 0);
    const totalCs = allMatches.reduce((s, m) => s + m.cs, 0);
    const totalMinutes =
      allMatches.reduce((s, m) => s + m.gameDuration, 0) / 60;

    const champMap = new Map<string, { games: number; wins: number }>();
    for (const m of allMatches) {
      const c = champMap.get(m.championName) ?? { games: 0, wins: 0 };
      c.games += 1;
      if (m.win) c.wins += 1;
      champMap.set(m.championName, c);
    }

    aggregatedTeams.push({
      teamId: team.id,
      teamName: team.name,
      logoUrl: team.logo_url ?? null,
      divisionId: team.division_id,
      divisionName: div?.name ?? "Division",
      players: teamPlayers,
      games,
      wins,
      winRate: games > 0 ? (wins / games) * 100 : 0,
      avgKda:
        totalDeaths > 0
          ? (totalKills + totalAssists) / totalDeaths
          : totalKills + totalAssists,
      avgDpm: totalMinutes > 0 ? totalDmg / totalMinutes : 0,
      avgGpm: totalMinutes > 0 ? totalGold / totalMinutes : 0,
      avgCsPerMin: totalMinutes > 0 ? totalCs / totalMinutes : 0,
      avgGameMinutes: games > 0 ? totalMinutes / games : 0,
      blueGames: blueMatches.length,
      blueWins: blueMatches.filter((m) => m.win).length,
      redGames: redMatches.length,
      redWins: redMatches.filter((m) => m.win).length,
      topChampions: [...champMap.entries()]
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => b.games - a.games || b.wins - a.wins),
    });
  }

  return {
    authorized: true,
    missingTable,
    hasRiotKey,
    ddVersion,
    leagueName,
    leagueLogoUrl,
    seasonName: activeSeason?.name ?? "Active Season",
    seasonId: activeSeason?.id ?? null,
    currentEditionName,
    divisions: seasonDivisions.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      logo_url: d.logo_url ?? null,
      theme_key: d.theme_key,
    })),
    players: aggregatedPlayers,
    teams: aggregatedTeams,
  };
}

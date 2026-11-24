import { unstable_cache } from "next/cache";
import type { SeasonPlayoffBrackets } from "@/types/database";
import { createClient, createPublicClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { normalizeRoster } from "@/utils/roles";
import { getLatestDdragonVersion } from "@/utils/riotApi";
import {
  aggregatePlayerStats,
  computeRoleNormalizedRatings,
  getPriorityPickRanks,
  getRoleFilteredSoloChampions,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
  type RiotPlayerStatRow,
} from "@/utils/riotStatsAggregation";
import {
  fetchAllScdlSeries,
  fetchScdlSheetStats,
  type ScdlSeriesDetail,
  type SheetSourceConfig,
} from "@/utils/scdlSheetStats";

export interface StatsContextQueryOptions {
  includeRiotStats?: boolean;
  teamIdFilter?: string;
  playerKeyFilter?: string;
}

export interface LoadedStatsContext {
  authorized: boolean;
  missingTable: boolean;
  hasRiotKey: boolean;
  ddVersion: string;
  leagueName: string;
  leagueLogoUrl: string | null;
  seasonName: string;
  seasonId: string | null;
  seasonSlug: string | null;
  currentEditionName: string;
  divisions: { id: string; name: string; slug: string; logo_url: string | null; theme_key: string }[];
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  statsNotice: string | null;
  playoffBrackets?: SeasonPlayoffBrackets | null;
  statsRoundLabel?: string | null;
  sheetConfig?: SheetSourceConfig;
}

export async function loadAdminStatsContext(
  queryOpts?: StatsContextQueryOptions
): Promise<LoadedStatsContext> {
  const [auth, ddVersion] = await Promise.all([
    getServerAuthContext(),
    getLatestDdragonVersion(),
  ]);
  const hasRiotKey = Boolean(process.env.RIOT_API_KEY?.trim());

  if (!auth.user || !auth.isAdmin) {
    return {
      authorized: false,
      missingTable: false,
      hasRiotKey,
      ddVersion,
      leagueName: "",
      leagueLogoUrl: null,
      seasonName: "",
      seasonId: null,
      seasonSlug: null,
      currentEditionName: "",
      divisions: [],
      players: [],
      teams: [],
      statsNotice: null,
    };
  }

  const supabase = await createClient();
  return loadStatsContextInternal(supabase, {
    authorized: true,
    hasRiotKey,
    ddVersion,
    stripAdminFields: false,
    ...queryOpts,
  });
}

const loadCachedPublicStatsContext = unstable_cache(
  async (
    seasonSlug: string | undefined,
    includeRiotStats: boolean,
    teamIdFilter: string | undefined,
    playerKeyFilter: string | undefined
  ): Promise<LoadedStatsContext> => {
    const supabase = createPublicClient();
    const ddVersion = await getLatestDdragonVersion();
    return loadStatsContextInternal(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>,
      {
        authorized: true,
        hasRiotKey: false,
        ddVersion,
        stripAdminFields: true,
        seasonSlug,
        includeRiotStats,
        teamIdFilter,
        playerKeyFilter,
      }
    );
  },
  ["public-stats-context"],
  { revalidate: 3600, tags: ["public-stats"] }
);

export interface SoloPrioEntry {
  soloTopPrioChamp: string | null;
  masteryTop4?: { championName: string; championPoints: number }[];
}

const loadCachedSoloPrioMap = unstable_cache(
  async (
    rosterKeyRoles: string[]
  ): Promise<Record<string, SoloPrioEntry>> => {
    if (rosterKeyRoles.length === 0) return {};
    const playerKeys = rosterKeyRoles.map((entry) => {
      const sep = entry.lastIndexOf(":");
      return (sep >= 0 ? entry.slice(0, sep) : entry).toLowerCase();
    });

    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("riot_player_stats")
      .select("player_key, role, matches, mastery_top4")
      .in("player_key", playerKeys);

    if (error) {
      throw new Error(`loadCachedSoloPrioMap failed: ${error.message}`);
    }

    const rowByKey = new Map(
      (data ?? []).map((r) => [
        String(r.player_key ?? "").toLowerCase(),
        {
          role: (r.role as string | null) ?? null,
          matches: Array.isArray(r.matches)
            ? (r.matches as RiotPlayerStatRow["matches"])
            : [],
          masteryTop4: Array.isArray(r.mastery_top4)
            ? (r.mastery_top4 as {
                championName: string;
                championPoints: number;
              }[])
            : undefined,
        },
      ])
    );

    const result: Record<string, SoloPrioEntry> = {};
    for (const entry of rosterKeyRoles) {
      const sep = entry.lastIndexOf(":");
      const playerKey = sep >= 0 ? entry.slice(0, sep) : entry;
      const role = sep >= 0 ? entry.slice(sep + 1) : "";
      const row = rowByKey.get(playerKey.toLowerCase());
      if (!row) continue;

      const soloChamps = getRoleFilteredSoloChampions(
        row.matches,
        role || row.role || "mid",
        7
      );
      const soloPrio = getPriorityPickRanks(soloChamps, row.masteryTop4, "solo");
      let soloTopPrioChamp: string | null = null;
      for (const [champ, rank] of soloPrio.entries()) {
        if (rank === 1) {
          soloTopPrioChamp = champ;
          break;
        }
      }
      result[playerKey] = {
        soloTopPrioChamp,
        masteryTop4: row.masteryTop4,
      };
    }
    return result;
  },
  ["public-solo-prio-map-v2"],
  { revalidate: 3600, tags: ["public-stats"] }
);

export async function loadPublicSoloPrioMap(
  players: { playerKey: string; role: string }[]
): Promise<Record<string, SoloPrioEntry>> {
  const rosterKeyRoles = players
    .map((p) => `${p.playerKey}:${p.role}`)
    .sort();
  return loadCachedSoloPrioMap(rosterKeyRoles);
}

export async function loadPublicStatsContext(
  seasonSlug?: string,
  queryOpts?: StatsContextQueryOptions
): Promise<LoadedStatsContext> {
  return loadCachedPublicStatsContext(
    seasonSlug,
    queryOpts?.includeRiotStats ?? true,
    queryOpts?.teamIdFilter,
    queryOpts?.playerKeyFilter
  );
}

async function loadStatsContextInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    authorized: boolean;
    hasRiotKey: boolean;
    ddVersion: string;
    stripAdminFields: boolean;
    seasonSlug?: string;
    includeRiotStats?: boolean;
    teamIdFilter?: string;
    playerKeyFilter?: string;
  }
): Promise<LoadedStatsContext> {
  const {
    authorized,
    hasRiotKey,
    ddVersion,
    stripAdminFields,
    seasonSlug,
    includeRiotStats = true,
    teamIdFilter,
    playerKeyFilter,
  } = opts;

  const statsPromise = includeRiotStats
    ? (() => {
        let q = supabase.from("riot_player_stats").select("*");
        if (playerKeyFilter) {
          q = playerKeyFilter.includes("#")
            ? q.eq("player_key", playerKeyFilter)
            : q.ilike("player_key", `${playerKeyFilter}#%`);
        } else if (teamIdFilter) {
          q = q.eq("team_id", teamIdFilter);
        }
        return q;
      })()
    : Promise.resolve({ data: [] as RiotPlayerStatRow[], error: null });

  const [
    { data: seasons },
    { data: divisions },
    { data: teams },
    { data: editions },
    settingsRes,
    statsRes,
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("*, leagues ( name, logo_url )")
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
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    statsPromise,
  ]);

  const rawNotice = (
    settingsRes.data as { stats_notice?: string | null } | null
  )?.stats_notice;
  const statsNotice =
    typeof rawNotice === "string" && rawNotice.trim()
      ? rawNotice.trim()
      : null;

  const missingTable = Boolean(
    statsRes.error &&
      (statsRes.error.code === "42P01" ||
        statsRes.error.message.includes("riot_player_stats"))
  );

  const teamOwnerSeason = teamIdFilter
    ? (() => {
        const tr = (teams ?? []).find((t) => t.id === teamIdFilter);
        const dr = tr
          ? (divisions ?? []).find((d) => d.id === tr.division_id)
          : null;
        return dr
          ? (seasons ?? []).find((s) => s.id === dr.season_id) ?? null
          : null;
      })()
    : null;

  const activeSeason =
    teamOwnerSeason ??
    (seasonSlug
      ? (seasons ?? []).find((s) => s.slug === seasonSlug)
      : null) ??
    (seasons ?? []).find((s) => s.is_active) ??
    (seasons ?? [])[0] ??
    null;

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

      if (stripAdminFields) {
        agg.syncError = null;
      }

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

  const seasonSheetRow = activeSeason as unknown as {
    stats_provider?: "google_sheet" | "supabase_native" | "none" | null;
    stats_sheet_id?: string | null;
    stats_sheet_gids?: string[] | null;
    stats_playoff_gids?: string[] | null;
    stats_schedule_gid?: string | null;
    regular_season_rounds?: number | null;
    stats_credits_label?: string | null;
    stats_credits_url?: string | null;
    stats_credits_attribution?: string | null;
  } | null;
  const sheetConfig: SheetSourceConfig = {
    seasonId: activeSeason?.id ?? null,
    seasonSlug: activeSeason?.slug ?? null,
    provider: seasonSheetRow?.stats_provider ?? "google_sheet",
    sheetId: seasonSheetRow?.stats_sheet_id ?? null,
    gids: seasonSheetRow?.stats_sheet_gids ?? null,
    playoffGids: seasonSheetRow?.stats_playoff_gids ?? null,
    scheduleGid: seasonSheetRow?.stats_schedule_gid ?? null,
    regularSeasonRounds: seasonSheetRow?.regular_season_rounds ?? null,
    creditsLabel: seasonSheetRow?.stats_credits_label ?? null,
    creditsUrl: seasonSheetRow?.stats_credits_url ?? null,
    creditsAttribution: seasonSheetRow?.stats_credits_attribution ?? null,
  };

  return {
    authorized,
    missingTable,
    hasRiotKey,
    ddVersion,
    leagueName,
    leagueLogoUrl,
    seasonName: activeSeason?.name ?? "Active Season",
    seasonId: activeSeason?.id ?? null,
    seasonSlug: activeSeason?.slug ?? null,
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
    statsNotice,
    playoffBrackets:
      (
        activeSeason as unknown as {
          playoff_brackets?: SeasonPlayoffBrackets | null;
        } | null
      )?.playoff_brackets ?? null,
    statsRoundLabel:
      (
        activeSeason as unknown as {
          stats_round_label?: string | null;
        } | null
      )?.stats_round_label ?? null,
    sheetConfig,
  };
}

export interface TeamScoutingPayload {
  team: AggregatedTeamStats;
  leagueTeam: AggregatedTeamStats | null;
  seriesHistory: ScdlSeriesDetail[];
  teamLogoMap: Record<string, string | null>;
  divisionThemeKey: string;
  divisionSlug: string | null;
  roleRankByPlayerKey: Record<string, { rank: number; total: number }>;
}

export async function loadTeamScoutingData(
  ctx: LoadedStatsContext,
  teamId: string
): Promise<TeamScoutingPayload | null> {
  const team = ctx.teams.find((t) => t.teamId === teamId);
  if (!team) return null;

  const [sheetSummary, allSeries] = await Promise.all([
    fetchScdlSheetStats(ctx.players, ctx.teams, ctx.sheetConfig).catch(
      () => null
    ),
    fetchAllScdlSeries(ctx.sheetConfig).catch(() => []),
  ]);

  const leagueTeam =
    sheetSummary?.teams.find((t) => t.teamId === team.teamId) ?? null;

  const teamNameLower = team.teamName.toLowerCase();
  const seriesHistory = allSeries.filter(
    (s) =>
      s.teamA.toLowerCase() === teamNameLower ||
      s.teamB.toLowerCase() === teamNameLower
  );

  const teamLogoMap: Record<string, string | null> = {};
  for (const t of ctx.teams) {
    teamLogoMap[t.teamName.toLowerCase()] = t.logoUrl;
  }

  const divisionObj = ctx.divisions.find((d) => d.id === team.divisionId);
  const divisionThemeKey = divisionObj?.theme_key ?? "scdl";
  const divisionSlug = divisionObj?.slug ?? null;

  const roleRankByPlayerKey: Record<string, { rank: number; total: number }> =
    {};
  const rawDivPlayers = (sheetSummary?.players ?? []).filter(
    (p) => p.divisionId === team.divisionId && p.games > 0
  );
  const divPlayers = computeRoleNormalizedRatings(rawDivPlayers);
  const byRole = new Map<string, typeof divPlayers>();
  for (const p of divPlayers) {
    const list = byRole.get(p.role) ?? [];
    list.push(p);
    byRole.set(p.role, list);
  }
  for (const list of byRole.values()) {
    list.sort((a, b) => b.leagueRating - a.leagueRating);
    list.forEach((p, idx) => {
      roleRankByPlayerKey[p.playerKey] = { rank: idx + 1, total: list.length };
    });
  }

  return {
    team,
    leagueTeam,
    seriesHistory,
    teamLogoMap,
    divisionThemeKey,
    divisionSlug,
    roleRankByPlayerKey,
  };
}

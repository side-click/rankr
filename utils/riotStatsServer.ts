import { cache } from "react";
import { unstable_cache } from "next/cache";
import type {
  DivisionTheme,
  SeasonPlayoffBrackets,
  SeasonRosterType,
  SeasonStructure,
} from "@/types/database";
import { createClient, createPublicClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { LEAGUE_ROLES, normalizeRoster } from "@/utils/roles";
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
} from "@/utils/leagueStats";

export interface StatsContextQueryOptions {
  includeRiotStats?: boolean;
  teamIdFilter?: string;
  playerKeyFilter?: string;
  seasonSlug?: string;
}

export interface StatsSeasonOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  leagueName: string;
  leagueShortName: string;
  leagueLogoUrl: string | null;
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
  allSeasons?: StatsSeasonOption[];
  divisions: { id: string; name: string; slug: string; logo_url: string | null; theme_key: string }[];
  divisionThemes: DivisionTheme[];
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  statsNotice: string | null;
  playoffBrackets?: SeasonPlayoffBrackets | null;
  statsRoundLabel?: string | null;
  rosterType?: SeasonRosterType;
  seasonStructure?: SeasonStructure;
  defaultBestOf?: number;
  sheetConfig?: SheetSourceConfig;
}

const UNAUTHORIZED_CONTEXT = (
  hasRiotKey: boolean,
  ddVersion: string
): LoadedStatsContext => ({
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
  allSeasons: [],
  divisions: [],
  divisionThemes: [],
  players: [],
  teams: [],
  statsNotice: null,
});

export async function loadAdminStatsContext(
  queryOpts?: StatsContextQueryOptions
): Promise<LoadedStatsContext> {
  const [auth, ddVersion] = await Promise.all([
    getServerAuthContext(),
    getLatestDdragonVersion(),
  ]);
  const hasRiotKey = Boolean(process.env.RIOT_API_KEY?.trim());

  if (!auth.user || (!auth.isAdmin && !auth.isOperator)) {
    return UNAUTHORIZED_CONTEXT(hasRiotKey, ddVersion);
  }

  const supabase = await createClient();
  return loadStatsContextInternal(supabase, {
    authorized: true,
    hasRiotKey,
    ddVersion,
    stripAdminFields: false,
    allowedLeagueIds: auth.isAdmin ? null : auth.operatorLeagueIds,
    ...queryOpts,
  });
}

const loadCachedTeamSeasonSlugMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabase = createPublicClient();
    const [{ data: teams }, { data: divisions }, { data: seasons }] =
      await Promise.all([
        supabase.from("teams").select("id, division_id"),
        supabase.from("divisions").select("id, season_id"),
        supabase.from("seasons").select("id, slug"),
      ]);
    const seasonSlugById = new Map(
      (seasons ?? []).map((s) => [String(s.id), String(s.slug)])
    );
    const seasonSlugByDivId = new Map(
      (divisions ?? []).map((d) => [
        String(d.id),
        seasonSlugById.get(String(d.season_id)) ?? "",
      ])
    );
    const out: Record<string, string> = {};
    for (const t of teams ?? []) {
      const slug = seasonSlugByDivId.get(String(t.division_id));
      if (slug) out[String(t.id)] = slug;
    }
    return out;
  },
  ["team-season-slug-map-v1"],
  { revalidate: 3600, tags: ["public-stats"] }
);

const loadCachedPublicStatsContext = unstable_cache(
  async (
    seasonSlugKey: string,
    includeRiotStats: boolean
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
        allowedLeagueIds: null,
        seasonSlug: seasonSlugKey || undefined,
        includeRiotStats,
      }
    );
  },
  ["public-stats-context-v2"],
  { revalidate: 3600, tags: ["public-stats"] }
);

export interface SoloPrioEntry {
  soloTopPrioChamp: string | null;
  masteryTop4?: { championName: string; championPoints: number }[];
}

interface CachedSoloPrioPlayerRecord {
  masteryTop4?: { championName: string; championPoints: number }[];
  byRole: Record<string, string | null>;
}

const loadCachedSoloPrioIndex = unstable_cache(
  async (): Promise<Record<string, CachedSoloPrioPlayerRecord>> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("riot_player_stats")
      .select("player_key, role, matches, mastery_top4");

    if (error) {
      throw new Error(`loadCachedSoloPrioIndex failed: ${error.message}`);
    }

    const index: Record<string, CachedSoloPrioPlayerRecord> = {};
    for (const r of data ?? []) {
      const key = String(r.player_key ?? "").toLowerCase();
      if (!key) continue;
      const matches = Array.isArray(r.matches)
        ? (r.matches as RiotPlayerStatRow["matches"])
        : [];
      const masteryTop4 = Array.isArray(r.mastery_top4)
        ? (r.mastery_top4 as { championName: string; championPoints: number }[])
        : undefined;

      const byRole: Record<string, string | null> = {};
      for (const roleDef of LEAGUE_ROLES) {
        const soloChamps = getRoleFilteredSoloChampions(
          matches,
          roleDef.key,
          7
        );
        const soloPrio = getPriorityPickRanks(soloChamps, masteryTop4, "solo");
        let topChamp: string | null = null;
        for (const [champ, rank] of soloPrio.entries()) {
          if (rank === 1) {
            topChamp = champ;
            break;
          }
        }
        byRole[roleDef.key] = topChamp;
      }

      index[key] = { masteryTop4, byRole };
    }
    return index;
  },
  ["public-solo-prio-index-v3"],
  { revalidate: 3600, tags: ["public-stats"] }
);

export async function loadPublicSoloPrioMap(
  players: { playerKey: string; role: string }[]
): Promise<Record<string, SoloPrioEntry>> {
  const index = await loadCachedSoloPrioIndex();
  const result: Record<string, SoloPrioEntry> = {};
  for (const p of players) {
    const rec = index[p.playerKey.toLowerCase()];
    if (!rec) continue;
    const roleKey = p.role?.toLowerCase() || "mid";
    result[p.playerKey] = {
      soloTopPrioChamp: rec.byRole[roleKey] ?? null,
      masteryTop4: rec.masteryTop4,
    };
  }
  return result;
}

const loadPublicStatsContextDeduped = cache(
  async (
    seasonSlugKey: string,
    includeRiotStats: boolean
  ): Promise<LoadedStatsContext> =>
    loadCachedPublicStatsContext(seasonSlugKey, includeRiotStats)
);

export async function loadPublicStatsContext(
  seasonSlug?: string,
  queryOpts?: StatsContextQueryOptions
): Promise<LoadedStatsContext> {
  let targetSlug = seasonSlug?.trim() || undefined;
  if (!targetSlug && queryOpts?.teamIdFilter) {
    const teamSeasonMap = await loadCachedTeamSeasonSlugMap();
    targetSlug = teamSeasonMap[queryOpts.teamIdFilter] || undefined;
  }
  return loadPublicStatsContextDeduped(
    targetSlug ?? "",
    queryOpts?.includeRiotStats ?? true
  );
}

async function loadStatsContextInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    authorized: boolean;
    hasRiotKey: boolean;
    ddVersion: string;
    stripAdminFields: boolean;
    allowedLeagueIds: string[] | null;
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
    allowedLeagueIds,
    seasonSlug,
    includeRiotStats = true,
    teamIdFilter,
  } = opts;

  const statsPromise = includeRiotStats
    ? supabase.from("riot_player_stats").select("*")
    : Promise.resolve({ data: [] as RiotPlayerStatRow[], error: null });

  const [
    { data: seasons },
    { data: divisions },
    { data: divisionThemes },
    { data: teams },
    { data: editions },
    settingsRes,
    statsRes,
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("*, leagues ( id, name, short_name, logo_url )")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("divisions")
      .select("id, name, slug, logo_url, theme_key, season_id")
      .order("name"),
    supabase.from("division_themes").select("*").order("name"),
    supabase
      .from("teams")
      .select("id, name, logo_url, division_id, roster, captain, default_order")
      .order("default_order"),
    supabase
      .from("editions")
      .select("id, name, season_id, is_open, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("app_settings").select("stats_notice").eq("id", 1).maybeSingle(),
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

  const allRawSeasons = seasons ?? [];
  const allowedSet = allowedLeagueIds ? new Set(allowedLeagueIds) : null;
  const visibleSeasons = allowedSet
    ? allRawSeasons.filter((s) => allowedSet.has(String(s.league_id ?? "")))
    : allRawSeasons;

  const teamOwnerSeason = teamIdFilter
    ? (() => {
        const tr = (teams ?? []).find((t) => t.id === teamIdFilter);
        const dr = tr
          ? (divisions ?? []).find((d) => d.id === tr.division_id)
          : null;
        return dr
          ? allRawSeasons.find((s) => s.id === dr.season_id) ?? null
          : null;
      })()
    : null;

  if (
    allowedSet &&
    ((teamOwnerSeason && !allowedSet.has(String(teamOwnerSeason.league_id ?? ""))) ||
      (seasonSlug &&
        !visibleSeasons.some((s) => s.slug === seasonSlug)) ||
      visibleSeasons.length === 0)
  ) {
    return UNAUTHORIZED_CONTEXT(hasRiotKey, ddVersion);
  }

  const activeSeason =
    teamOwnerSeason ??
    (seasonSlug
      ? visibleSeasons.find((s) => s.slug === seasonSlug)
      : null) ??
    visibleSeasons.find((s) => s.is_active) ??
    visibleSeasons[0] ??
    null;

  const leagueInfo = (
    activeSeason as unknown as {
      leagues?: {
        name?: string;
        short_name?: string | null;
        logo_url?: string | null;
      } | null;
    } | null
  )?.leagues;
  const leagueName = leagueInfo?.name ?? "SCDL";
  const leagueLogoUrl = leagueInfo?.logo_url ?? null;

  const allSeasons: StatsSeasonOption[] = visibleSeasons.map((s) => {
    const lg = Array.isArray(s.leagues) ? s.leagues[0] : s.leagues;
    const lgObj = lg as
      | { name?: string; short_name?: string | null; logo_url?: string | null }
      | null
      | undefined;
    return {
      id: String(s.id),
      name: String(s.name),
      slug: String(s.slug),
      isActive: Boolean(s.is_active),
      leagueName: lgObj?.name ?? "League",
      leagueShortName: lgObj?.short_name || lgObj?.name || "League",
      leagueLogoUrl: lgObj?.logo_url ?? null,
    };
  });

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
    allSeasons,
    divisions: seasonDivisions.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      logo_url: d.logo_url ?? null,
      theme_key: d.theme_key,
    })),
    divisionThemes: (divisionThemes ?? []) as DivisionTheme[],
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
    rosterType:
      (
        activeSeason as unknown as {
          roster_type?: SeasonRosterType | null;
        } | null
      )?.roster_type ?? "draft",
    seasonStructure:
      (
        activeSeason as unknown as {
          season_structure?: SeasonStructure | null;
        } | null
      )?.season_structure ?? "regular_playoffs",
    defaultBestOf:
      (
        activeSeason as unknown as {
          default_best_of?: number | null;
        } | null
      )?.default_best_of ?? 1,
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

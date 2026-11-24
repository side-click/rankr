import type { DivisionOverviewStats } from "@/components/stats/StatsDivisionTab";
import type { PlayoffSeriesMatchup, SheetSyncSummary } from "@/utils/leagueStats";
import { LEAGUE_ROLES } from "@/utils/roles";
import {
  filterPlayersByStage,
  isMatchPlayoff,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
} from "@/utils/riotStatsAggregation";

export interface PrecomputedSheetDashboardMeta {
  hasPlayoffStats: boolean;
  stageMatchCountsByDiv: Record<string, { regular: number; playoffs: number }>;
  latestRegularRoundByDiv: Record<string, number | null>;
  overviewByDiv: Record<string, DivisionOverviewStats>;
  regularPlayers?: AggregatedPlayerStats[];
  regularSubPlayers?: AggregatedPlayerStats[];
  playoffPlayers?: AggregatedPlayerStats[];
  playoffSubPlayers?: AggregatedPlayerStats[];
}

export interface CompactSheetDashboardData {
  players: AggregatedPlayerStats[];
  subPlayers: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  playoffSeries: PlayoffSeriesMatchup[];
  fetchedAt: string;
  rowCount: number;
  matchCount: number;
  precomputed: PrecomputedSheetDashboardMeta;
}

export type PlayerSortKey =
  | "leagueRating"
  | "avgGoldDiff15"
  | "kda"
  | "dpm"
  | "gpm"
  | "csPerMin"
  | "kpPct"
  | "damageSharePct"
  | "visionPerMin"
  | "games";

export function sortTeamsForStandings(
  teams: AggregatedTeamStats[],
  divisionFilter: string
): AggregatedTeamStats[] {
  return teams
    .filter((t) =>
      divisionFilter === "all" ? true : t.divisionId === divisionFilter
    )
    .sort((a, b) => {
      if (a.seed != null && b.seed != null && a.seed !== b.seed) {
        return a.seed - b.seed;
      }
      const aSeriesDiff =
        (a.seriesWins ?? a.wins) -
        (a.seriesLosses ?? Math.max(0, a.games - a.wins));
      const bSeriesDiff =
        (b.seriesWins ?? b.wins) -
        (b.seriesLosses ?? Math.max(0, b.games - b.wins));
      return (
        bSeriesDiff - aSeriesDiff ||
        b.winRate - a.winRate ||
        b.avgKda - a.avgKda
      );
    });
}

export function computeDivisionOverview(
  allDivisionPlayers: AggregatedPlayerStats[]
): DivisionOverviewStats {
  const allMatches = allDivisionPlayers.flatMap((p) => p.matches);

  const uniqueMatchMap = new Map<string, (typeof allMatches)[number]>();
  const uniqueSideMap = new Map<string, (typeof allMatches)[number]>();
  for (const m of allMatches) {
    if (!uniqueMatchMap.has(m.matchId)) uniqueMatchMap.set(m.matchId, m);
    const sideKey = `${m.matchId}::${m.teamId}`;
    if (!uniqueSideMap.has(sideKey)) uniqueSideMap.set(sideKey, m);
  }

  const totalGames = uniqueMatchMap.size;
  const durationSource = [...uniqueMatchMap.values()];
  const sideSource = [...uniqueSideMap.values()];

  const blueGames = sideSource.filter((m) => m.teamId === 100);
  const redGames = sideSource.filter((m) => m.teamId === 200);
  const blueWr =
    blueGames.length > 0
      ? (blueGames.filter((m) => m.win).length / blueGames.length) * 100
      : 50;
  const redWr =
    redGames.length > 0
      ? (redGames.filter((m) => m.win).length / redGames.length) * 100
      : 50;

  const champMap = new Map<string, { games: number; wins: number }>();
  const banMap = new Map<string, number>();
  const seenBanMatches = new Set<string>();
  for (const m of allMatches) {
    const c = champMap.get(m.championName) ?? { games: 0, wins: 0 };
    c.games += 1;
    if (m.win) c.wins += 1;
    champMap.set(m.championName, c);

    if (
      Array.isArray(m.bans) &&
      m.bans.length > 0 &&
      !seenBanMatches.has(m.matchId)
    ) {
      seenBanMatches.add(m.matchId);
      for (const banned of m.bans) {
        const trimmed = banned?.trim();
        if (
          !trimmed ||
          /^(nothing|none|no\s*ban|-|\u2014|n\/a)$/i.test(trimmed)
        ) {
          continue;
        }
        banMap.set(trimmed, (banMap.get(trimmed) ?? 0) + 1);
      }
    }
  }

  const champs = [...champMap.entries()]
    .map(([name, val]) => ({
      name,
      games: val.games,
      wins: val.wins,
      winRate: (val.wins / val.games) * 100,
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate);

  const banMatchCount = seenBanMatches.size;
  const bannedChamps = [...banMap.entries()]
    .map(([name, bans]) => ({
      name,
      bans,
      banRate:
        banMatchCount > 0 ? Math.min(100, (bans / banMatchCount) * 100) : 0,
    }))
    .sort((a, b) => b.bans - a.bans || a.name.localeCompare(b.name));

  let flashDPicks = 0;
  let flashDWins = 0;
  let flashFPicks = 0;
  let flashFWins = 0;
  for (const m of allMatches) {
    if (m.flashKey === "D") {
      flashDPicks += 1;
      if (m.win) flashDWins += 1;
    } else if (m.flashKey === "F") {
      flashFPicks += 1;
      if (m.win) flashFWins += 1;
    }
  }

  const teamMatchMeta = new Map<
    string,
    { win: boolean; hasFb: boolean; gd15Sum: number; hasGd15: boolean }
  >();
  for (const m of allMatches) {
    const key = `${m.matchId}::${m.teamId}`;
    const cur = teamMatchMeta.get(key) ?? {
      win: m.win,
      hasFb: false,
      gd15Sum: 0,
      hasGd15: false,
    };
    if (m.firstBlood) cur.hasFb = true;
    if (typeof m.goldDiff15 === "number" && Number.isFinite(m.goldDiff15)) {
      cur.gd15Sum += m.goldDiff15;
      cur.hasGd15 = true;
    }
    teamMatchMeta.set(key, cur);
  }
  const fbTeams = [...teamMatchMeta.values()].filter((t) => t.hasFb);
  const fbWr =
    fbTeams.length > 0
      ? (fbTeams.filter((t) => t.win).length / fbTeams.length) * 100
      : null;

  const gd15AheadTeams = [...teamMatchMeta.values()].filter(
    (t) => t.hasGd15 && t.gd15Sum > 0
  );
  const gd15Wr =
    gd15AheadTeams.length > 0
      ? (gd15AheadTeams.filter((t) => t.win).length / gd15AheadTeams.length) *
        100
      : null;

  let longestGame: {
    durationMin: number;
    winner: string;
    loser: string;
    roundLabel: string;
  } | null = null;
  for (const m of durationSource) {
    if (
      m.gameDuration > 0 &&
      (!longestGame || m.gameDuration / 60 > longestGame.durationMin)
    ) {
      const gameRows = allMatches.filter((x) => x.matchId === m.matchId);
      const winTeam =
        gameRows.find((x) => x.win)?.teamName ??
        (m.matchLabel ? m.matchLabel.split("_")[1] : "");
      const loseTeam =
        gameRows.find((x) => !x.win)?.teamName ??
        (m.matchLabel ? m.matchLabel.split("_")[2] : "");
      const rawRound = m.matchLabel ? m.matchLabel.split("_")[0] : "";
      const roundLabel = rawRound
        ? rawRound.replace(/([a-zA-Z]+)(\d+)/, "$1 $2")
        : "";
      longestGame = {
        durationMin: m.gameDuration / 60,
        winner: winTeam || "Winner",
        loser: loseTeam || "Opponent",
        roundLabel,
      };
    }
  }

  type PlayerKpiLeader = {
    name: string;
    count: number;
    teamName: string;
    teamLogoUrl?: string | null;
    tiedCount: number;
    tiedNames: string[];
  };
  let topPingPlayer: PlayerKpiLeader | null = null;
  let topPentaPlayer: PlayerKpiLeader | null = null;
  let topStealPlayer: PlayerKpiLeader | null = null;
  const updateLeader = (
    current: PlayerKpiLeader | null,
    val: number,
    p: AggregatedPlayerStats
  ): PlayerKpiLeader | null => {
    if (val <= 0) return current;
    if (!current || val > current.count) {
      return {
        name: p.displayName,
        count: val,
        teamName: p.teamName,
        teamLogoUrl: p.teamLogoUrl,
        tiedCount: 1,
        tiedNames: [p.displayName],
      };
    }
    if (val === current.count) {
      return {
        ...current,
        tiedCount: current.tiedCount + 1,
        tiedNames: [...current.tiedNames, p.displayName],
      };
    }
    return current;
  };
  for (const p of allDivisionPlayers) {
    const pings = p.matches.reduce((s, m) => s + (m.questionPings ?? 0), 0);
    topPingPlayer = updateLeader(topPingPlayer, pings, p);

    const pentas = p.matches.reduce((s, m) => s + (m.pentaKills ?? 0), 0);
    topPentaPlayer = updateLeader(topPentaPlayer, pentas, p);

    const steals = p.matches.reduce(
      (s, m) => s + (m.objectivesStolen ?? 0),
      0
    );
    topStealPlayer = updateLeader(topStealPlayer, steals, p);
  }

  let totalControlWards = 0;
  for (const m of allMatches) {
    totalControlWards += m.controlWardsBought ?? 0;
  }
  const totalGameMinutes = durationSource.reduce(
    (s, m) => s + m.gameDuration / 60,
    0
  );
  const controlWardsPerMin =
    totalGameMinutes > 0 ? totalControlWards / totalGameMinutes : 0;

  return {
    totalGames,
    blueWr,
    redWr,
    champs,
    bannedChamps,
    flashDPicks,
    flashDWr: flashDPicks > 0 ? (flashDWins / flashDPicks) * 100 : 0,
    flashFPicks,
    flashFWr: flashFPicks > 0 ? (flashFWins / flashFPicks) * 100 : 0,
    fbWr,
    fbGames: fbTeams.length,
    gd15Wr,
    gd15Games: gd15AheadTeams.length,
    longestGame,
    topPingPlayer,
    topPentaPlayer,
    topStealPlayer,
    totalControlWards,
    controlWardsPerMin,
  };
}

export function computePlayerLeaderboards(
  leaderboardPlayers: AggregatedPlayerStats[]
) {
  const firstTeamAllPro = LEAGUE_ROLES.map((roleDef) => {
    const candidates = leaderboardPlayers
      .filter((p) => p.role === roleDef.key)
      .sort((a, b) => b.leagueRating - a.leagueRating);
    return candidates[0] ? { roleMeta: roleDef, player: candidates[0] } : null;
  }).filter(
    (
      x
    ): x is {
      roleMeta: (typeof LEAGUE_ROLES)[number];
      player: AggregatedPlayerStats;
    } => Boolean(x)
  );

  const top5By = (cmp: (a: AggregatedPlayerStats, b: AggregatedPlayerStats) => number) =>
    [...leaderboardPlayers].sort(cmp).slice(0, 5);

  return {
    firstTeamAllPro,
    topRating: top5By((a, b) => b.leagueRating - a.leagueRating),
    topKda: top5By((a, b) => b.kda - a.kda),
    topKills: top5By((a, b) => b.killsPerGame - a.killsPerGame),
    topAssists: top5By((a, b) => b.assistsPerGame - a.assistsPerGame),
    lowestDeaths: top5By((a, b) => a.deathsPerGame - b.deathsPerGame),
    topCs: top5By((a, b) => b.csPerMin - a.csPerMin),
    topDpm: top5By((a, b) => b.dpm - a.dpm),
    topGpm: top5By((a, b) => b.gpm - a.gpm),
    topVision: top5By((a, b) => b.visionPerMin - a.visionPerMin),
    topKp: top5By((a, b) => b.kpPct - a.kpPct),
    topDmgShare: top5By((a, b) => b.damageSharePct - a.damageSharePct),
    topGoldDiff15: leaderboardPlayers
      .filter(
        (p) => p.avgGoldDiff15 !== null && p.avgGoldDiff15 !== undefined
      )
      .sort((a, b) => (b.avgGoldDiff15 ?? 0) - (a.avgGoldDiff15 ?? 0))
      .slice(0, 5),
    topSoloKills: leaderboardPlayers
      .filter((p) => p.hasSoloKillsData)
      .sort((a, b) => b.soloKills - a.soloKills)
      .slice(0, 5),
    topFirstBlood: leaderboardPlayers
      .filter((p) => p.firstBloodPct !== null)
      .sort((a, b) => (b.firstBloodPct ?? 0) - (a.firstBloodPct ?? 0))
      .slice(0, 5),
  };
}

export function computeSortColors(
  tablePlayers: AggregatedPlayerStats[],
  sortKey: PlayerSortKey
): Map<string, string> {
  const map = new Map<string, string>();
  const valid = tablePlayers
    .filter((p) => p.games > 0)
    .map((p) => ({
      key: p.playerKey,
      val: p[sortKey] as number | null | undefined,
    }))
    .filter(
      (x): x is { key: string; val: number } =>
        typeof x.val === "number" && Number.isFinite(x.val)
    );
  if (valid.length === 0) return map;
  valid.sort((a, b) => b.val - a.val);
  const total = valid.length;
  for (let i = 0; i < total; i++) {
    let rank = i + 1;
    while (rank > 1 && valid[rank - 2].val === valid[i].val) {
      rank--;
    }
    const t = total <= 1 ? 0 : Math.min(1, Math.max(0, (rank - 1) / (total - 1)));
    let r: number;
    let g: number;
    let b: number;
    if (t <= 0.5) {
      const u = t / 0.5;
      r = Math.round(74 + (166 - 74) * u);
      g = Math.round(222 + (168 - 222) * u);
      b = Math.round(128 + (158 - 128) * u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = Math.round(166 + (248 - 166) * u);
      g = Math.round(168 + (113 - 168) * u);
      b = Math.round(158 + (113 - 158) * u);
    }
    map.set(valid[i].key, `rgb(${r}, ${g}, ${b})`);
  }
  return map;
}

const stripPlayerMatches = (
  list: AggregatedPlayerStats[]
): AggregatedPlayerStats[] =>
  list.map((p) => (p.matches.length > 0 ? { ...p, matches: [] } : p));

/**
 * Pre-computes per-division overviews and stage match counts on the server so
 * `/stats` and `/admin/stats` do not serialize large raw `player.matches[]`
 * arrays into initial SSR HTML.
 */
export function compactSheetSummaryForDashboard(
  sheetSummary: SheetSyncSummary,
  divisions: { id: string }[]
): CompactSheetDashboardData {
  const scopes = ["all", ...divisions.map((d) => d.id)];
  const stageMatchCountsByDiv: Record<
    string,
    { regular: number; playoffs: number }
  > = {};
  const latestRegularRoundByDiv: Record<string, number | null> = {};
  const overviewByDiv: Record<string, DivisionOverviewStats> = {};

  for (const scope of scopes) {
    const scopedPlayers =
      scope === "all"
        ? sheetSummary.players
        : sheetSummary.players.filter((p) => p.divisionId === scope);

    const regIds = new Set<string>();
    const playoffIds = new Set<string>();
    let maxRound = 0;

    for (const p of scopedPlayers) {
      for (const m of p.matches) {
        if (isMatchPlayoff(m)) {
          playoffIds.add(m.matchId);
          continue;
        }
        regIds.add(m.matchId);
        const match =
          m.matchLabel?.match(
            /\b(?:round|week|wk|r|w|game|match)\s*(\d+)/i
          ) ?? m.matchLabel?.match(/^\s*(\d+)\s*$/);
        if (match) {
          const n = Number(match[1]);
          if (Number.isFinite(n) && n > maxRound) maxRound = n;
        }
      }
    }

    stageMatchCountsByDiv[scope] = {
      regular: regIds.size,
      playoffs: playoffIds.size,
    };
    latestRegularRoundByDiv[scope] = maxRound > 0 ? maxRound : null;
    overviewByDiv[scope] = computeDivisionOverview(scopedPlayers);
  }

  const hasPlayoffStats = (stageMatchCountsByDiv["all"]?.playoffs ?? 0) > 0;
  const precomputed: PrecomputedSheetDashboardMeta = {
    hasPlayoffStats,
    stageMatchCountsByDiv,
    latestRegularRoundByDiv,
    overviewByDiv,
  };

  if (hasPlayoffStats) {
    precomputed.regularPlayers = stripPlayerMatches(
      filterPlayersByStage(sheetSummary.players, "regular")
    );
    precomputed.regularSubPlayers = stripPlayerMatches(
      filterPlayersByStage(sheetSummary.subPlayers, "regular").filter(
        (p) => p.games > 0
      )
    );
    precomputed.playoffPlayers = stripPlayerMatches(
      filterPlayersByStage(sheetSummary.players, "playoffs")
    );
    precomputed.playoffSubPlayers = stripPlayerMatches(
      filterPlayersByStage(sheetSummary.subPlayers, "playoffs").filter(
        (p) => p.games > 0
      )
    );
  }

  return {
    players: stripPlayerMatches(sheetSummary.players),
    subPlayers: stripPlayerMatches(sheetSummary.subPlayers),
    teams: sheetSummary.teams.map((t) => ({ ...t, players: [] })),
    playoffSeries: sheetSummary.playoffSeries,
    fetchedAt: sheetSummary.fetchedAt,
    rowCount: sheetSummary.rowCount,
    matchCount: sheetSummary.matchCount,
    precomputed,
  };
}

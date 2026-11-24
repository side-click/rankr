import type {
  ChampionMasteryEntry,
  CompactRiotMatch,
} from "@/utils/riotApi";

export interface RiotPlayerStatRow {
  player_key: string;
  riot_id: string;
  puuid: string | null;
  season_id: string | null;
  division_id: string | null;
  team_id: string | null;
  role: string | null;
  solo_tier: string | null;
  solo_rank: string | null;
  solo_lp: number | null;
  solo_wins: number | null;
  solo_losses: number | null;
  matches: CompactRiotMatch[];
  mastery_top4?: ChampionMasteryEntry[];
  deep_synced_at?: string | null;
  sync_error: string | null;
  synced_at: string;
}

export interface AggregatedPlayerStats {
  playerKey: string;
  riotId: string;
  displayName: string;
  teamId: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  divisionId: string | null;
  divisionName: string;
  role: string;
  altAccounts?: string[];
  isSub?: boolean;
  soloTier: string | null;
  soloRank: string | null;
  soloLp: number | null;
  rankScore: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  kda: number;
  killsPerGame: number;
  deathsPerGame: number;
  assistsPerGame: number;
  csPerMin: number;
  dpm: number;
  gpm: number;
  visionPerMin: number;
  kpPct: number;
  damageSharePct: number;
  goldSharePct: number;
  avgGameMinutes: number;
  avgGoldDiff: number | null;
  avgGoldDiff15: number | null;
  soloKills: number;
  hasSoloKillsData: boolean;
  firstBloodPct: number | null;
  turretDpm: number;
  mitigatedPerMin: number;
  objectiveDpm: number;
  leagueRating: number;
  topChampions: { name: string; games: number; wins: number }[];
  masteryTop4: ChampionMasteryEntry[];
  matches: CompactRiotMatch[];
  syncedAt: string | null;
  deepSyncedAt: string | null;
  syncError: string | null;
}

export interface AggregatedTeamStats {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  divisionId: string;
  divisionName: string;
  players: AggregatedPlayerStats[];
  games: number;
  wins: number;
  seed?: number;
  seriesWins?: number;
  seriesLosses?: number;
  seriesStreak?: number;
  winRate: number;
  avgKda: number;
  avgDpm: number;
  avgGpm: number;
  avgCsPerMin: number;
  avgGameMinutes: number;
  blueGames: number;
  blueWins: number;
  redGames: number;
  redWins: number;
  topChampions: { name: string; games: number; wins: number }[];
}

const TIER_ORDER: Record<string, number> = {
  CHALLENGER: 10000,
  GRANDMASTER: 9000,
  MASTER: 8000,
  DIAMOND: 7000,
  EMERALD: 6000,
  PLATINUM: 5000,
  GOLD: 4000,
  SILVER: 3000,
  BRONZE: 2000,
  IRON: 1000,
};

const DIV_ORDER: Record<string, number> = {
  I: 400,
  II: 300,
  III: 200,
  IV: 100,
};

export function computeRankScore(
  tier: string | null,
  rank: string | null,
  lp: number | null
): number {
  if (!tier) return 0;
  const base = TIER_ORDER[tier.toUpperCase()] ?? 0;
  const div = rank ? DIV_ORDER[rank.toUpperCase()] ?? 0 : 0;
  return base + div + (lp ?? 0);
}

export function aggregatePlayerStats(
  row: RiotPlayerStatRow | undefined,
  meta: {
    playerKey: string;
    riotId: string;
    teamId: string | null;
    teamName: string;
    teamLogoUrl: string | null;
    divisionId: string | null;
    divisionName: string;
    role: string;
    altAccounts?: string[];
    isSub?: boolean;
  }
): AggregatedPlayerStats {
  const matches = Array.isArray(row?.matches) ? row.matches : [];
  const games = matches.length;
  const wins = matches.filter((m) => m.win).length;
  const losses = games - wins;

  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let cs = 0;
  let dmg = 0;
  let gold = 0;
  let vision = 0;
  let totalSeconds = 0;
  let kpSum = 0;
  let dmgShareSum = 0;
  let goldShareSum = 0;
  let goldDiffSum = 0;
  let goldDiffCount = 0;
  let goldDiff15Sum = 0;
  let goldDiff15Count = 0;
  let soloKills = 0;
  let soloKillsCount = 0;
  let firstBloodCount = 0;
  let firstBloodGames = 0;
  let turretDmg = 0;
  let mitigatedDmg = 0;
  let objectiveDmg = 0;

  const champMap = new Map<string, { games: number; wins: number }>();

  for (const m of matches) {
    kills += m.kills;
    deaths += m.deaths;
    assists += m.assists;
    cs += m.cs;
    dmg += m.totalDamageDealtToChampions;
    gold += m.goldEarned;
    vision += m.visionScore;
    totalSeconds += m.gameDuration;

    if (m.teamKills > 0) kpSum += (m.kills + m.assists) / m.teamKills;
    if (m.teamDamage > 0)
      dmgShareSum += m.totalDamageDealtToChampions / m.teamDamage;
    if (m.teamGold > 0) goldShareSum += m.goldEarned / m.teamGold;
    if (typeof m.goldDiff === "number" && Number.isFinite(m.goldDiff)) {
      goldDiffSum += m.goldDiff;
      goldDiffCount += 1;
    }
    if (typeof m.goldDiff15 === "number" && Number.isFinite(m.goldDiff15)) {
      goldDiff15Sum += m.goldDiff15;
      goldDiff15Count += 1;
    }
    if (typeof m.soloKills === "number" && Number.isFinite(m.soloKills)) {
      soloKills += m.soloKills;
      soloKillsCount += 1;
    }
    if (typeof m.firstBlood === "boolean") {
      firstBloodGames += 1;
      if (m.firstBlood) firstBloodCount += 1;
    }
    if (typeof m.damageDealtToTurrets === "number") {
      turretDmg += m.damageDealtToTurrets;
    }
    if (typeof m.damageSelfMitigated === "number") {
      mitigatedDmg += m.damageSelfMitigated;
    }
    if (typeof m.damageDealtToObjectives === "number") {
      objectiveDmg += m.damageDealtToObjectives;
    }

    const existing = champMap.get(m.championName) ?? { games: 0, wins: 0 };
    existing.games += 1;
    if (m.win) existing.wins += 1;
    champMap.set(m.championName, existing);
  }

  const totalMinutes = totalSeconds / 60;
  const topChampions = [...champMap.entries()]
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins);

  const riotId = row?.riot_id || meta.riotId;
  const displayName = riotId.split("#")[0].trim() || riotId;

  return {
    playerKey: meta.playerKey,
    riotId,
    displayName,
    teamId: meta.teamId,
    teamName: meta.teamName,
    teamLogoUrl: meta.teamLogoUrl,
    divisionId: meta.divisionId,
    divisionName: meta.divisionName,
    role: meta.role,
    isSub: meta.isSub,
    ...(meta.altAccounts && meta.altAccounts.length > 0
      ? { altAccounts: meta.altAccounts }
      : {}),
    soloTier: row?.solo_tier ?? null,
    soloRank: row?.solo_rank ?? null,
    soloLp: row?.solo_lp ?? null,
    rankScore: computeRankScore(
      row?.solo_tier ?? null,
      row?.solo_rank ?? null,
      row?.solo_lp ?? null
    ),
    games,
    wins,
    losses,
    winRate: games > 0 ? (wins / games) * 100 : 0,
    kda: deaths > 0 ? (kills + assists) / deaths : kills + assists,
    killsPerGame: games > 0 ? kills / games : 0,
    deathsPerGame: games > 0 ? deaths / games : 0,
    assistsPerGame: games > 0 ? assists / games : 0,
    csPerMin: totalMinutes > 0 ? cs / totalMinutes : 0,
    dpm: totalMinutes > 0 ? dmg / totalMinutes : 0,
    gpm: totalMinutes > 0 ? gold / totalMinutes : 0,
    visionPerMin: totalMinutes > 0 ? vision / totalMinutes : 0,
    kpPct: games > 0 ? (kpSum / games) * 100 : 0,
    damageSharePct: games > 0 ? (dmgShareSum / games) * 100 : 0,
    goldSharePct: games > 0 ? (goldShareSum / games) * 100 : 0,
    avgGameMinutes: games > 0 ? totalMinutes / games : 0,
    avgGoldDiff: goldDiffCount > 0 ? goldDiffSum / goldDiffCount : null,
    avgGoldDiff15: goldDiff15Count > 0 ? goldDiff15Sum / goldDiff15Count : null,
    soloKills,
    hasSoloKillsData: soloKillsCount > 0,
    firstBloodPct:
      firstBloodGames > 0 ? (firstBloodCount / firstBloodGames) * 100 : null,
    turretDpm: totalMinutes > 0 ? turretDmg / totalMinutes : 0,
    mitigatedPerMin: totalMinutes > 0 ? mitigatedDmg / totalMinutes : 0,
    objectiveDpm: totalMinutes > 0 ? objectiveDmg / totalMinutes : 0,
    leagueRating: 0,
    topChampions,
    masteryTop4: Array.isArray(row?.mastery_top4) ? row.mastery_top4 : [],
    matches,
    syncedAt: row?.synced_at ?? null,
    deepSyncedAt: row?.deep_synced_at ?? null,
    syncError: row?.sync_error ?? null,
  };
}

const LEAGUE_TO_RIOT_POSITION: Record<string, string> = {
  top: "TOP",
  jungle: "JUNGLE",
  mid: "MIDDLE",
  bot: "BOTTOM",
  support: "UTILITY",
};

/**
 * Returns top SoloQ champions filtered strictly to the player's league role
 * (when teamPosition is available on synced matches).
 */
export function getRoleFilteredSoloChampions(
  matches: CompactRiotMatch[],
  leagueRole: string,
  limit = 7
): { name: string; games: number; wins: number; winRate: number }[] {
  const targetPos = LEAGUE_TO_RIOT_POSITION[leagueRole.toLowerCase()];
  const positioned = matches.filter((m) => Boolean(m.teamPosition));
  const scoped =
    targetPos && positioned.length > 0
      ? matches.filter((m) => m.teamPosition?.toUpperCase() === targetPos)
      : matches;

  const champMap = new Map<string, { games: number; wins: number }>();
  for (const m of scoped) {
    const cur = champMap.get(m.championName) ?? { games: 0, wins: 0 };
    cur.games += 1;
    if (m.win) cur.wins += 1;
    champMap.set(m.championName, cur);
  }

  return [...champMap.entries()]
    .map(([name, val]) => ({
      name,
      games: val.games,
      wins: val.wins,
      winRate: (val.wins / val.games) * 100,
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, limit);
}

/**
 * Computes a role-normalized 0–100 composite rating ("Strand"-style Z-score)
 * where each player is compared strictly against peers in the same role.
 * This prevents Support/Vision score inflation and rewards role-appropriate impact.
 */
export function computeRoleNormalizedRatings(
  players: AggregatedPlayerStats[]
): AggregatedPlayerStats[] {
  type MetricExtractor = (p: AggregatedPlayerStats) => number;

  const ROLE_METRICS: Record<string, MetricExtractor[]> = {
    top: [
      (p) => p.kda,
      (p) => p.kpPct,
      (p) => p.dpm,
      (p) => p.csPerMin,
      (p) => p.avgGoldDiff ?? 0,
      (p) => (p.games > 0 ? p.soloKills / p.games : 0),
      (p) => p.turretDpm,
      (p) => p.mitigatedPerMin,
    ],
    mid: [
      (p) => p.kda,
      (p) => p.kpPct,
      (p) => p.dpm,
      (p) => p.csPerMin,
      (p) => p.gpm,
      (p) => p.damageSharePct,
      (p) => (p.games > 0 ? p.soloKills / p.games : 0),
    ],
    bot: [
      (p) => p.kda,
      (p) => p.kpPct,
      (p) => p.avgGoldDiff ?? 0,
      (p) => p.csPerMin,
      (p) => p.gpm,
      (p) => p.damageSharePct,
      (p) => (p.gpm > 0 ? p.dpm / p.gpm : 0),
    ],
    jungle: [
      (p) => p.kda,
      (p) => p.kpPct,
      (p) => p.csPerMin,
      (p) => p.visionPerMin,
      (p) => p.assistsPerGame,
      (p) => p.objectiveDpm,
      (p) => p.firstBloodPct ?? 0,
    ],
    support: [
      (p) => p.kda,
      (p) => p.kpPct,
      (p) => p.assistsPerGame,
      (p) => p.visionPerMin,
      (p) => p.firstBloodPct ?? 0,
    ],
  };

  const activeByRole = new Map<string, AggregatedPlayerStats[]>();
  for (const p of players) {
    if (p.games <= 0) continue;
    const roleKey = (p.role || "").trim().toLowerCase();
    const list = activeByRole.get(roleKey) ?? [];
    list.push(p);
    activeByRole.set(roleKey, list);
  }

  const ratingByKey = new Map<string, number>();

  for (const [roleKey, group] of activeByRole.entries()) {
    const metrics = ROLE_METRICS[roleKey] ?? ROLE_METRICS.mid;
    const stats = metrics.map((fn) => {
      const vals = group.map(fn);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance =
        vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
      const stdDev = Math.sqrt(variance);
      return { fn, mean, stdDev };
    });

    for (const p of group) {
      let sumZ = 0;
      for (const { fn, mean, stdDev } of stats) {
        const z =
          stdDev > 0 ? Math.max(-2.5, Math.min(2.5, (fn(p) - mean) / stdDev)) : 0;
        sumZ += z;
      }
      const avgZ = sumZ / stats.length;
      const confidence = Math.min(1, Math.sqrt(p.games / 3));
      const rating =
        Math.round(
          Math.max(10, Math.min(99, 50 + 15 * avgZ * confidence)) * 10
        ) / 10;
      ratingByKey.set(p.playerKey, rating);
    }
  }

  return players.map((p) => ({
    ...p,
    leagueRating: p.games > 0 ? ratingByKey.get(p.playerKey) ?? 50 : 0,
  }));
}

export function formatMinutesSeconds(minutesDecimal: number): string {
  if (!Number.isFinite(minutesDecimal) || minutesDecimal <= 0) return "0:00";
  const totalSec = Math.round(minutesDecimal * 60);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const PRIO_THRESHOLDS = {
  solo: {
    minTotalGames: 12,
    minChampGames: 4,
    minWr: 0.45,
    minShare: 0.14,
    minScore: 1.15,
  },
  league: {
    minTotalGames: 3,
    minChampGames: 2,
    minWr: 0.45,
    minShare: 0.1,
    minScore: 1.0,
  },
} as const;

/**
 * Computes up to 3 High Priority pick ranks (1 = highest, 3 = lowest) for a
 * player's champion pool using median-anchored play rate, win rate, and a
 * one-way log-mastery bonus. Returns an empty map if no champion qualifies.
 */
export function getPriorityPickRanks(
  champs: { name: string; games: number; wins: number }[],
  masteryTop4?: { championName: string; championPoints: number }[],
  mode: "solo" | "league" = "solo"
): Map<string, 1 | 2 | 3> {
  const t = PRIO_THRESHOLDS[mode];
  const result = new Map<string, 1 | 2 | 3>();
  const totalGames = champs.reduce((s, c) => s + c.games, 0);
  if (totalGames < t.minTotalGames || champs.length < 2) return result;

  const sortedCounts = champs.map((c) => c.games).sort((a, b) => a - b);
  const median = sortedCounts[Math.floor(sortedCounts.length / 2)];

  const masteryMap = new Map<string, number>();
  for (const m of masteryTop4 ?? []) {
    masteryMap.set(m.championName.toLowerCase(), m.championPoints);
  }

  const scored: { name: string; score: number }[] = [];
  for (const c of champs) {
    if (c.games < t.minChampGames) continue;
    const wr = c.wins / c.games;
    if (wr < t.minWr) continue;
    const share = c.games / totalGames;
    if (share < t.minShare) continue;

    const relToMedian = median > 0 ? c.games / median : 1;
    const wrScore = (wr - 0.5) * 1.5;
    const pts = masteryMap.get(c.name.toLowerCase()) ?? 0;
    const masteryBonus =
      pts >= 100_000
        ? Math.min(0.25, 0.1 + Math.max(0, Math.log10(pts / 100_000)) * 0.15)
        : 0;

    const score =
      share * 2.5 + Math.min(2.2, relToMedian) * 0.35 + wrScore + masteryBonus;
    if (score >= t.minScore) {
      scored.push({ name: c.name, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  scored.slice(0, 3).forEach((entry, idx) => {
    result.set(entry.name, (idx + 1) as 1 | 2 | 3);
  });
  return result;
}

export function getPriorityPickClass(rank: 1 | 2 | 3 | undefined): string {
  if (rank === 1) return "border-[#ff5a52] bg-[#ff5a52]/20";
  if (rank === 2) return "border-[#ff5a52]/65 bg-[#ff5a52]/10";
  if (rank === 3) return "border-[#ff5a52]/40 bg-[#ff5a52]/5";
  return "";
}

export type StatsStageBucket = "regular" | "playoffs";

export function isPlayoffMatchLabel(
  matchLabel?: string | null,
  regularSeasonRounds?: number | null
): boolean {
  const raw = (matchLabel ?? "").trim();
  if (!raw) return false;
  const prefix = raw.split("_")[0].trim().toLowerCase();
  if (
    /(playoff|quarter|semi|final|bracket|upper|lower|losers|winners|elim|gauntlet|play-?in)/.test(
      prefix
    )
  ) {
    return true;
  }
  if (/^(po|qf|sf|gf|ub|lb|wb|wr|lr)\d*$/.test(prefix)) {
    return true;
  }
  if (
    typeof regularSeasonRounds === "number" &&
    Number.isFinite(regularSeasonRounds) &&
    regularSeasonRounds > 0
  ) {
    const roundNumMatch = prefix.match(/^(?:round|week|r|w)\s*(\d+)$/i);
    if (roundNumMatch && Number(roundNumMatch[1]) > regularSeasonRounds) {
      return true;
    }
  }
  return false;
}

export function isMatchPlayoff(match: {
  matchLabel?: string | null;
  isPlayoff?: boolean;
}): boolean {
  return typeof match.isPlayoff === "boolean"
    ? match.isPlayoff
    : isPlayoffMatchLabel(match.matchLabel);
}

export function filterPlayersByStage(
  players: AggregatedPlayerStats[],
  stage: StatsStageBucket
): AggregatedPlayerStats[] {
  const wantPlayoffs = stage === "playoffs";
  return players.map((p) => {
    const stageMatches = p.matches.filter(
      (m) => isMatchPlayoff(m) === wantPlayoffs
    );
    const syntheticRow: RiotPlayerStatRow = {
      player_key: p.playerKey,
      riot_id: p.riotId,
      puuid: null,
      season_id: null,
      division_id: p.divisionId,
      team_id: p.teamId,
      role: p.role,
      solo_tier: p.soloTier,
      solo_rank: p.soloRank,
      solo_lp: p.soloLp,
      solo_wins: null,
      solo_losses: null,
      matches: stageMatches,
      mastery_top4: p.masteryTop4,
      deep_synced_at: p.deepSyncedAt,
      sync_error: p.syncError,
      synced_at: p.syncedAt ?? "",
    };
    return aggregatePlayerStats(syntheticRow, {
      playerKey: p.playerKey,
      riotId: p.riotId,
      teamId: p.teamId,
      teamName: p.teamName,
      teamLogoUrl: p.teamLogoUrl,
      divisionId: p.divisionId,
      divisionName: p.divisionName,
      role: p.role,
      altAccounts: p.altAccounts,
      isSub: p.isSub,
    });
  });
}

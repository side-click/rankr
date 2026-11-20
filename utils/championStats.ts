import type { LoadedStatsContext } from "@/utils/riotStatsServer";
import type { ScdlGameDetail, ScdlSeriesDetail } from "@/utils/scdlSheetStats";

function normChamp(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export interface ChampionRoleStat {
  role: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface ChampionBannedByTeam {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  bans: number;
  totalTeamGames: number;
}

export interface ChampionPlayerRow {
  playerKey: string;
  playerName: string;
  teamId: string | null;
  teamName: string;
  logoUrl: string | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  dpm: number;
  damageShare: number;
  csPerMin: number;
  isCarrying: boolean;
}

export interface ChampionRecentGame {
  seriesKey: string;
  gameId: string;
  matchLabel: string;
  roundLabel: string;
  side: "Blue" | "Red";
  win: boolean;
  playerName: string;
  playerKey: string;
  role: string;
  pickSlot: string | null;
  opponentChampion: string | null;
  gameDuration: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  dpm: number;
  goldDiff15: number;
  teamId: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  opponentName: string;
}

export interface ChampionStatsPayload {
  championName: string;
  totalLeagueGames: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  pickRate: number;
  bans: number;
  banRate: number;
  presence: number;
  firstPickCount: number;
  firstPickRate: number;
  blueGames: number;
  blueWins: number;
  blueWinRate: number;
  redGames: number;
  redWins: number;
  redWinRate: number;
  roles: ChampionRoleStat[];
  mostBannedBy: ChampionBannedByTeam[];
  playerLeaderboard: ChampionPlayerRow[];
  recentGames: ChampionRecentGame[];
}

/** Flatten series into games (sheet order: later = more recent). */
export function flattenSeriesGames(series: ScdlSeriesDetail[]): ScdlGameDetail[] {
  return series.flatMap((s) => s.games);
}

export function computeChampionStats(
  ctx: LoadedStatsContext,
  series: ScdlSeriesDetail[],
  championName: string,
  divisionFilter?: string
): ChampionStatsPayload {
  const target = normChamp(championName);
  const divObj =
    divisionFilter && divisionFilter !== "all"
      ? ctx.divisions.find((d) => d.slug.toLowerCase() === divisionFilter.toLowerCase())
      : null;

  const teamByName = new Map(ctx.teams.map((t) => [t.teamName.trim().toLowerCase(), t]));
  const teamMeta = (name: string) => teamByName.get(name.trim().toLowerCase()) ?? null;

  const allGames = flattenSeriesGames(series).filter((g) => {
    if (!divObj) return true;
    return teamMeta(g.blueTeam)?.divisionId === divObj.id;
  });

  let bans = 0;
  let firstPickCount = 0;
  let games = 0;
  let wins = 0;
  let blueGames = 0;
  let blueWins = 0;
  let redGames = 0;
  let redWins = 0;

  const roleMap = new Map<string, { games: number; wins: number }>();
  const bannedByMap = new Map<string, ChampionBannedByTeam>();
  const playerMap = new Map<
    string,
    {
      playerKey: string;
      playerName: string;
      teamId: string | null;
      teamName: string;
      logoUrl: string | null;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      totalDpm: number;
      totalDmgShare: number;
      totalCsPerMin: number;
    }
  >();
  const recent: { order: number; row: ChampionRecentGame }[] = [];

  allGames.forEach((g, order) => {
    const draft = g.draft;

    if (draft) {
      if ([...(draft.blueBans ?? []), ...(draft.redBans ?? [])].some((b) => normChamp(b) === target)) {
        bans += 1;
      }
      if (draft.bluePicks?.[0] && normChamp(draft.bluePicks[0]) === target) {
        firstPickCount += 1;
      }
      for (const [teamName, teamBans] of [
        [g.blueTeam, draft.blueBans],
        [g.redTeam, draft.redBans],
      ] as const) {
        const meta = teamMeta(teamName);
        const key = meta?.teamId ?? `name:${teamName.toLowerCase()}`;
        const entry = bannedByMap.get(key) ?? {
          teamId: meta?.teamId ?? "",
          teamName,
          logoUrl: meta?.logoUrl ?? null,
          bans: 0,
          totalTeamGames: 0,
        };
        entry.totalTeamGames += 1;
        if ((teamBans ?? []).some((b) => normChamp(b) === target)) entry.bans += 1;
        bannedByMap.set(key, entry);
      }
    }

    const minutes = g.gameDuration > 0 ? g.gameDuration / 60 : 0;
    const teamDamage = new Map<string, number>();
    for (const p of g.players) {
      teamDamage.set(p.teamName, (teamDamage.get(p.teamName) ?? 0) + p.damageDealt);
    }

    for (const p of g.players) {
      if (normChamp(p.champion) !== target) continue;

      games += 1;
      if (p.win) wins += 1;
      if (p.side === "Blue") {
        blueGames += 1;
        if (p.win) blueWins += 1;
      } else {
        redGames += 1;
        if (p.win) redWins += 1;
      }

      const rStat = roleMap.get(p.role) ?? { games: 0, wins: 0 };
      rStat.games += 1;
      if (p.win) rStat.wins += 1;
      roleMap.set(p.role, rStat);

      const meta = teamMeta(p.teamName);
      const pKey = p.displayName.toLowerCase();
      const tDmg = teamDamage.get(p.teamName) ?? 0;
      const dpm = minutes > 0 ? p.damageDealt / minutes : 0;
      const pStat = playerMap.get(pKey) ?? {
        playerKey: pKey,
        playerName: p.displayName,
        teamId: meta?.teamId ?? null,
        teamName: p.teamName,
        logoUrl: meta?.logoUrl ?? null,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        totalDpm: 0,
        totalDmgShare: 0,
        totalCsPerMin: 0,
      };
      pStat.games += 1;
      if (p.win) pStat.wins += 1;
      pStat.kills += p.kills;
      pStat.deaths += p.deaths;
      pStat.assists += p.assists;
      pStat.totalDpm += dpm;
      pStat.totalDmgShare += tDmg > 0 ? (p.damageDealt / tDmg) * 100 : 0;
      pStat.totalCsPerMin += minutes > 0 ? p.cs / minutes : 0;
      playerMap.set(pKey, pStat);

      const opp = g.players.find(
        (o) => o.teamName.toLowerCase() !== p.teamName.toLowerCase() && o.role === p.role
      );
      let pickSlot: string | null = null;
      if (draft) {
        const sidePicks = p.side === "Blue" ? draft.bluePicks : draft.redPicks;
        const idx = (sidePicks ?? []).findIndex((c) => normChamp(c) === target);
        if (idx >= 0) {
          pickSlot = `${p.side === "Blue" ? "B" : "R"}${idx + 1}`;
        }
      }

      recent.push({
        order,
        row: {
          seriesKey: g.seriesKey,
          gameId: g.gameId,
          matchLabel: g.matchLabel,
          roundLabel: g.roundLabel,
          side: p.side,
          win: p.win,
          playerName: p.displayName,
          playerKey: pKey,
          role: p.role,
          pickSlot,
          opponentChampion: opp?.champion ?? null,
          gameDuration: g.gameDuration,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          cs: p.cs,
          dpm: Math.round(dpm),
          goldDiff15: p.goldDiff15,
          teamId: meta?.teamId ?? null,
          teamName: p.teamName,
          teamLogoUrl: meta?.logoUrl ?? null,
          opponentName: p.teamName === g.blueTeam ? g.redTeam : g.blueTeam,
        },
      });
    }
  });

  const totalLeagueGames = allGames.length;
  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

  const roles: ChampionRoleStat[] = [...roleMap.entries()]
    .map(([role, s]) => ({
      role,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      winRate: pct(s.wins, s.games),
    }))
    .sort((a, b) => b.games - a.games);

  const mostBannedBy = [...bannedByMap.values()]
    .filter((b) => b.bans > 0)
    .sort((a, b) => b.bans - a.bans || b.totalTeamGames - a.totalTeamGames)
    .slice(0, 6);

  const playerLeaderboard: ChampionPlayerRow[] = [...playerMap.values()]
    .map((p) => ({
      playerKey: p.playerKey,
      playerName: p.playerName,
      teamId: p.teamId,
      teamName: p.teamName,
      logoUrl: p.logoUrl,
      games: p.games,
      wins: p.wins,
      losses: p.games - p.wins,
      winRate: pct(p.wins, p.games),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      kda: p.deaths > 0 ? (p.kills + p.assists) / p.deaths : p.kills + p.assists,
      dpm: p.games > 0 ? p.totalDpm / p.games : 0,
      damageShare: p.games > 0 ? p.totalDmgShare / p.games : 0,
      csPerMin: p.games > 0 ? p.totalCsPerMin / p.games : 0,
      isCarrying: false,
    }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.kda - a.kda);

  // "Carrying the Champ": best win rate among players with 3+ games
  let bestIdx = -1;
  let bestWr = -1;
  playerLeaderboard.forEach((p, i) => {
    if (p.games >= 3 && p.winRate > bestWr) {
      bestWr = p.winRate;
      bestIdx = i;
    }
  });
  if (bestIdx >= 0) playerLeaderboard[bestIdx].isCarrying = true;

  recent.sort((a, b) => b.order - a.order);

  return {
    championName,
    totalLeagueGames,
    games,
    wins,
    losses: games - wins,
    winRate: pct(wins, games),
    pickRate: pct(games, totalLeagueGames),
    bans,
    banRate: pct(bans, totalLeagueGames),
    presence: pct(games + bans, totalLeagueGames),
    firstPickCount,
    firstPickRate: pct(firstPickCount, totalLeagueGames),
    blueGames,
    blueWins,
    blueWinRate: pct(blueWins, blueGames),
    redGames,
    redWins,
    redWinRate: pct(redWins, redGames),
    roles,
    mostBannedBy,
    playerLeaderboard,
    recentGames: recent.slice(0, 15).map((r) => r.row),
  };
}

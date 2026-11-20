import draftsData from "@/data/scdl_drafts.json";
import type { LoadedStatsContext } from "@/utils/riotStatsServer";
import type { DraftRecord } from "@/utils/scdlSheetStats";

const DRAFTS_BY_GAME_ID = draftsData as Record<string, DraftRecord>;

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
  division: string;
  date: string;
  side: "Blue" | "Red";
  win: boolean;
  playerName: string;
  playerKey: string;
  kills: number;
  deaths: number;
  assists: number;
  teamId: string;
  teamName: string;
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

export function computeChampionStats(
  ctx: LoadedStatsContext,
  championName: string,
  divisionFilter?: string
): ChampionStatsPayload {
  const targetNorm = normChamp(championName);
  const divSlug = divisionFilter && divisionFilter !== "all" ? divisionFilter.toLowerCase() : null;

  const divObj = divSlug
    ? ctx.divisions.find((d) => d.slug.toLowerCase() === divSlug)
    : null;
  const teams = divObj
    ? ctx.teams.filter((t) => t.divisionId === divObj.id)
    : ctx.teams;

  const seenGameIds = new Set<string>();
  const seenTeamGames = new Set<string>();
  let totalLeagueGames = 0;
  let bans = 0;
  let firstPickCount = 0;

  let games = 0;
  let wins = 0;
  let blueGames = 0;
  let blueWins = 0;
  let redGames = 0;
  let redWins = 0;

  const roleMap = new Map<string, { games: number; wins: number }>();
  const bannedByMap = new Map<
    string,
    { teamId: string; teamName: string; logoUrl: string | null; bans: number; totalTeamGames: number }
  >();
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
  const recentGames: ChampionRecentGame[] = [];

  for (const team of teams) {
    for (const player of team.players ?? []) {
      for (const m of player.matches ?? []) {
        if (!m.matchId || !m.matchId.startsWith("SCDL_")) continue;
        const gameId = m.matchId.replace(/^SCDL_/, "");

        if (!seenGameIds.has(gameId)) {
          seenGameIds.add(gameId);
          totalLeagueGames += 1;

          const draft = DRAFTS_BY_GAME_ID[gameId];
          const gameBans = draft?.bans ?? [];
          for (const b of gameBans) {
            if (normChamp(b) === targetNorm) {
              bans += 1;
              break;
            }
          }
          if (draft?.bluePicks?.[0] && normChamp(draft.bluePicks[0]) === targetNorm) {
            firstPickCount += 1;
          }
        }

        const isBlue = m.teamId === 100;
        const draft = DRAFTS_BY_GAME_ID[gameId];
        const teamGameKey = `${gameId}:${team.teamId}`;
        if (draft && !seenTeamGames.has(teamGameKey)) {
          seenTeamGames.add(teamGameKey);
          const teamBans = isBlue ? draft.blueBans : draft.redBans;
          const entry = bannedByMap.get(team.teamId) ?? {
            teamId: team.teamId,
            teamName: team.teamName,
            logoUrl: team.logoUrl,
            bans: 0,
            totalTeamGames: 0,
          };
          entry.totalTeamGames += 1;
          if (teamBans?.some((b) => normChamp(b) === targetNorm)) {
            entry.bans += 1;
          }
          bannedByMap.set(team.teamId, entry);
        }

        if (normChamp(m.championName) !== targetNorm) continue;

        games += 1;
        if (m.win) wins += 1;
        if (isBlue) {
          blueGames += 1;
          if (m.win) blueWins += 1;
        } else {
          redGames += 1;
          if (m.win) redWins += 1;
        }

        const roleKey = (player.role || "unknown").toLowerCase();
        const rStat = roleMap.get(roleKey) ?? { games: 0, wins: 0 };
        rStat.games += 1;
        if (m.win) rStat.wins += 1;
        roleMap.set(roleKey, rStat);

        const mins = m.gameDuration > 0 ? m.gameDuration / 60 : 0;
        const dpm = mins > 0 ? m.totalDamageDealtToChampions / mins : 0;
        const csPerMin = mins > 0 ? m.cs / mins : 0;

        const pKey = player.riotId.split("#")[0].trim().toLowerCase();
        const pStat = playerMap.get(pKey) ?? {
          playerKey: pKey,
          playerName: player.riotId.split("#")[0].trim() || player.riotId,
          teamId: team.teamId,
          teamName: team.teamName,
          logoUrl: team.logoUrl,
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
        if (m.win) pStat.wins += 1;
        pStat.kills += m.kills;
        pStat.deaths += m.deaths;
        pStat.assists += m.assists;
        pStat.totalDpm += dpm;
        pStat.totalDmgShare +=
          m.teamDamage && m.teamDamage > 0
            ? (m.totalDamageDealtToChampions / m.teamDamage) * 100
            : 0;
        pStat.totalCsPerMin += csPerMin;
        playerMap.set(pKey, pStat);

        recentGames.push({
          seriesKey: m.matchLabel ?? gameId,
          gameId,
          matchLabel: m.matchLabel ?? `${team.teamName} (${isBlue ? "Blue" : "Red"})`,
          division: team.divisionName,
          // Sheet rows carry no date; gameCreation holds sheet row order (later = more recent)
          date: String(m.gameCreation ?? 0).padStart(10, "0"),
          side: isBlue ? "Blue" : "Red",
          win: m.win,
          playerName: pStat.playerName,
          playerKey: pKey,
          kills: m.kills,
          deaths: m.deaths,
          assists: m.assists,
          teamId: team.teamId,
          teamName: team.teamName,
          opponentName: "",
        });
      }
    }
  }

  const losses = games - wins;
  const winRate = games > 0 ? (wins / games) * 100 : 0;
  const pickRate = totalLeagueGames > 0 ? (games / totalLeagueGames) * 100 : 0;
  const banRate = totalLeagueGames > 0 ? (bans / totalLeagueGames) * 100 : 0;
  const presence =
    totalLeagueGames > 0 ? ((games + bans) / totalLeagueGames) * 100 : 0;
  const firstPickRate =
    totalLeagueGames > 0 ? (firstPickCount / totalLeagueGames) * 100 : 0;

  const roles: ChampionRoleStat[] = [...roleMap.entries()]
    .map(([role, s]) => ({
      role,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      winRate: s.games > 0 ? (s.wins / s.games) * 100 : 0,
    }))
    .sort((a, b) => b.games - a.games);

  const mostBannedBy = [...bannedByMap.values()]
    .filter((b) => b.bans > 0)
    .sort((a, b) => b.bans - a.bans || b.totalTeamGames - a.totalTeamGames)
    .slice(0, 6);

  const playerLeaderboard: ChampionPlayerRow[] = [...playerMap.values()]
    .map((p) => {
      const kda = p.deaths > 0 ? (p.kills + p.assists) / p.deaths : p.kills + p.assists;
      return {
        playerKey: p.playerKey,
        playerName: p.playerName,
        teamId: p.teamId,
        teamName: p.teamName,
        logoUrl: p.logoUrl,
        games: p.games,
        wins: p.wins,
        losses: p.games - p.wins,
        winRate: p.games > 0 ? (p.wins / p.games) * 100 : 0,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        kda,
        dpm: p.games > 0 ? p.totalDpm / p.games : 0,
        damageShare: p.games > 0 ? p.totalDmgShare / p.games : 0,
        csPerMin: p.games > 0 ? p.totalCsPerMin / p.games : 0,
        isCarrying: false,
      };
    })
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate || b.kda - a.kda);

  // Flag "Carrying the Champ" (>= 3 games, highest win rate)
  let bestWr = -1;
  let bestIdx = -1;
  playerLeaderboard.forEach((p, idx) => {
    if (p.games >= 3 && p.winRate > bestWr) {
      bestWr = p.winRate;
      bestIdx = idx;
    }
  });
  if (bestIdx >= 0) {
    playerLeaderboard[bestIdx].isCarrying = true;
  }

  recentGames.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    championName,
    totalLeagueGames,
    games,
    wins,
    losses,
    winRate,
    pickRate,
    bans,
    banRate,
    presence,
    firstPickCount,
    firstPickRate,
    blueGames,
    blueWins,
    blueWinRate: blueGames > 0 ? (blueWins / blueGames) * 100 : 0,
    redGames,
    redWins,
    redWinRate: redGames > 0 ? (redWins / redGames) * 100 : 0,
    roles,
    mostBannedBy,
    playerLeaderboard,
    recentGames: recentGames.slice(0, 15),
  };
}

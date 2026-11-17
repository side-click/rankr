import type { CompactRiotMatch } from "@/utils/riotApi";
import draftBansData from "@/data/scdl_draft_bans.json";
import {
  aggregatePlayerStats,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
  type RiotPlayerStatRow,
} from "@/utils/riotStatsAggregation";

const DRAFT_BANS_BY_GAME_ID = draftBansData as Record<
  string,
  { blueTeam: string; redTeam: string; bans: string[]; sourceUrl: string }
>;

const SCDL_SHEET_ID = "1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A";
const SCDL_SHEET_GIDS = [
  { gid: "1733612942", label: "Tab 1" },
  { gid: "1849724071", label: "Tab 2" },
];

export interface SheetSyncSummary {
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  fetchedAt: string;
  rowCount: number;
  matchCount: number;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[%,$]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseBool(raw: string | undefined): boolean {
  return (raw ?? "").trim().toUpperCase() === "TRUE";
}

function normalizeRiotKey(raw: string): string {
  return raw.replace(/\s+#/g, "#").trim().toLowerCase();
}

function normalizeRoleKey(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === "adc" || r === "bottom") return "bot";
  if (r === "supp" || r === "utility") return "support";
  if (r === "jg") return "jungle";
  if (r === "middle") return "mid";
  return r || "mid";
}

interface ParsedSheetRow {
  matchLabel: string;
  gameId: string;
  teamName: string;
  playerName: string;
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  cs: number;
  damageDealt: number;
  gameLength: number;
  visionScore: number;
  win: boolean;
  side: "Blue" | "Red";
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  soloKills: number;
  firstBlood: boolean;
  teamKills: number;
  damageTaken: number;
  damageMitigated: number;
  ccScore: number;
  wardsPlaced: number;
  wardsDestroyed: number;
  controlWardsBought: number;
  damageToObjectives: number;
  damageToTurrets: number;
  dragons: number;
  barons: number;
  largestKillingSpree: number;
  rowOrder: number;
}

function parseCsvRows(csvText: string, startOrder: number): ParsedSheetRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const colIndex = new Map<string, number>();
  headers.forEach((h, idx) => {
    if (!colIndex.has(h)) colIndex.set(h, idx);
  });

  const get = (cols: string[], name: string): string => {
    const idx = colIndex.get(name);
    return idx !== undefined ? (cols[idx] ?? "").trim() : "";
  };

  const rows: ParsedSheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const gameId = get(cols, "Game ID");
    const playerName = get(cols, "Player Name");
    const champion = get(cols, "Champion");
    if (!gameId || !playerName || !champion) continue;

    rows.push({
      matchLabel: get(cols, "Match"),
      gameId,
      teamName: get(cols, "Team Name"),
      playerName,
      champion,
      role: normalizeRoleKey(get(cols, "Role")),
      kills: parseNum(get(cols, "Kills")),
      deaths: parseNum(get(cols, "Deaths")),
      assists: parseNum(get(cols, "Assists")),
      gold: parseNum(get(cols, "Gold")),
      cs: parseNum(get(cols, "CS")),
      damageDealt: parseNum(get(cols, "Damage Dealt")),
      gameLength: parseNum(get(cols, "Game Length")),
      visionScore: parseNum(get(cols, "Vision Score")),
      win: parseBool(get(cols, "Win")),
      side: get(cols, "Blue/Red").toLowerCase() === "red" ? "Red" : "Blue",
      doubleKills: parseNum(get(cols, "Double Kills")),
      tripleKills: parseNum(get(cols, "Triple Kills")),
      quadraKills: parseNum(get(cols, "Quadra Kills")),
      pentaKills: parseNum(get(cols, "Penta Kills")),
      soloKills: parseNum(get(cols, "Solo Kills")),
      firstBlood: parseBool(get(cols, "First Blood Participation")),
      teamKills: parseNum(get(cols, "Team Kills")),
      damageTaken: parseNum(get(cols, "Damage Taken")),
      damageMitigated: parseNum(get(cols, "Damage Mitigated")),
      ccScore: parseNum(get(cols, "CC Score")),
      wardsPlaced: parseNum(get(cols, "Wards Placed")),
      wardsDestroyed: parseNum(get(cols, "Wards Destroyed")),
      controlWardsBought: parseNum(get(cols, "Control Wards Bought")),
      damageToObjectives: parseNum(get(cols, "Damage to Objectives")),
      damageToTurrets: parseNum(get(cols, "Damage to Turrets")),
      dragons: parseNum(get(cols, "Dragons")),
      barons: parseNum(get(cols, "Barons")),
      largestKillingSpree: parseNum(get(cols, "Largest Killing Spree")),
      rowOrder: startOrder + i,
    });
  }
  return rows;
}

export async function fetchScdlSheetStats(
  rosterPlayers: AggregatedPlayerStats[],
  rosterTeams: AggregatedTeamStats[]
): Promise<SheetSyncSummary> {
  const csvTexts = await Promise.all(
    SCDL_SHEET_GIDS.map(async ({ gid }) => {
      const url = `https://docs.google.com/spreadsheets/d/${SCDL_SHEET_ID}/export?format=csv&gid=${gid}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch SCDL sheet tab ${gid} (${res.status})`);
      }
      return res.text();
    })
  );

  let allRows: ParsedSheetRow[] = [];
  for (let t = 0; t < csvTexts.length; t++) {
    allRows = allRows.concat(parseCsvRows(csvTexts[t], t * 100_000));
  }

  // Deduplicate by (gameId + normalized playerName) in case a game appears in both tabs
  const seenRowKeys = new Set<string>();
  const uniqueRows: ParsedSheetRow[] = [];
  for (const r of allRows) {
    const key = `${r.gameId}::${normalizeRiotKey(r.playerName)}`;
    if (seenRowKeys.has(key)) continue;
    seenRowKeys.add(key);
    uniqueRows.push(r);
  }

  // Group by gameId + teamName for team totals
  const teamGameTotals = new Map<
    string,
    { kills: number; damage: number; gold: number }
  >();
  // Group by gameId for lane opponent lookup
  const rowsByGame = new Map<string, ParsedSheetRow[]>();

  for (const r of uniqueRows) {
    const tgKey = `${r.gameId}::${r.teamName.toLowerCase()}`;
    const tot = teamGameTotals.get(tgKey) ?? { kills: 0, damage: 0, gold: 0 };
    tot.kills += r.kills;
    tot.damage += r.damageDealt;
    tot.gold += r.gold;
    teamGameTotals.set(tgKey, tot);

    const gList = rowsByGame.get(r.gameId) ?? [];
    gList.push(r);
    rowsByGame.set(r.gameId, gList);
  }

  // Lookup maps from active roster
  const rosterByKey = new Map<string, AggregatedPlayerStats>();
  const rosterByDisplay = new Map<string, AggregatedPlayerStats>();
  for (const p of rosterPlayers) {
    rosterByKey.set(normalizeRiotKey(p.playerKey), p);
    rosterByDisplay.set(p.displayName.trim().toLowerCase(), p);
  }

  const teamMetaByName = new Map<string, AggregatedTeamStats>();
  for (const t of rosterTeams) {
    teamMetaByName.set(t.teamName.trim().toLowerCase(), t);
  }

  // Group matches by playerKey
  const matchesByPlayerKey = new Map<
    string,
    {
      meta: AggregatedPlayerStats;
      matches: CompactRiotMatch[];
    }
  >();

  // Seed with all roster players so 0-game roster players still appear cleanly
  for (const p of rosterPlayers) {
    matchesByPlayerKey.set(p.playerKey, {
      meta: p,
      matches: [],
    });
  }

  const uniqueGames = new Set<string>();

  for (const r of uniqueRows) {
    uniqueGames.add(r.gameId);
    const normKey = normalizeRiotKey(r.playerName);
    const dispKey = r.playerName.split("#")[0].trim().toLowerCase();

    const matchedRoster =
      rosterByKey.get(normKey) ?? rosterByDisplay.get(dispKey);
    if (!matchedRoster) continue;

    const bucket = matchesByPlayerKey.get(matchedRoster.playerKey);
    if (!bucket) continue;

    const tgKey = `${r.gameId}::${r.teamName.toLowerCase()}`;
    const tot = teamGameTotals.get(tgKey) ?? {
      kills: r.teamKills,
      damage: r.damageDealt,
      gold: r.gold,
    };
    const teamKills = r.teamKills > 0 ? r.teamKills : tot.kills;

    const gameRows = rowsByGame.get(r.gameId) ?? [];
    const opp = gameRows.find(
      (o) =>
        o.teamName.toLowerCase() !== r.teamName.toLowerCase() &&
        o.role === r.role
    );

    const compact: CompactRiotMatch = {
      matchId: `SCDL_${r.gameId}`,
      gameCreation: r.rowOrder,
      gameDuration: r.gameLength,
      queueId: 0,
      win: r.win,
      championName: r.champion,
      teamId: r.side === "Blue" ? 100 : 200,
      teamPosition: r.role.toUpperCase(),
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      cs: r.cs,
      totalDamageDealtToChampions: r.damageDealt,
      totalDamageTaken: r.damageTaken,
      damageSelfMitigated: r.damageMitigated,
      damageDealtToObjectives: r.damageToObjectives,
      damageDealtToTurrets: r.damageToTurrets,
      timeCCingOthers: r.ccScore,
      goldEarned: r.gold,
      visionScore: r.visionScore,
      wardsPlaced: r.wardsPlaced,
      wardsKilled: r.wardsDestroyed,
      controlWardsBought: r.controlWardsBought,
      teamKills,
      teamDamage: tot.damage,
      teamGold: tot.gold,
      opponentChampion: opp?.champion,
      goldDiff: opp ? r.gold - opp.gold : undefined,
      csDiff: opp ? r.cs - opp.cs : undefined,
      dmgDiff: opp ? r.damageDealt - opp.damageDealt : undefined,
      soloKills: r.soloKills,
      firstBlood: r.firstBlood,
      doubleKills: r.doubleKills,
      tripleKills: r.tripleKills,
      quadraKills: r.quadraKills,
      pentaKills: r.pentaKills,
      largestKillingSpree: r.largestKillingSpree,
      dragonKills: r.dragons,
      baronKills: r.barons,
      bans: DRAFT_BANS_BY_GAME_ID[r.gameId]?.bans,
    };

    bucket.matches.push(compact);
  }

  const nowIso = new Date().toISOString();
  const aggregatedPlayers: AggregatedPlayerStats[] = [];

  for (const { meta, matches } of matchesByPlayerKey.values()) {
    const fakeRow: RiotPlayerStatRow = {
      player_key: meta.playerKey,
      riot_id: meta.riotId,
      puuid: null,
      season_id: null,
      division_id: meta.divisionId,
      team_id: meta.teamId,
      role: meta.role,
      solo_tier: meta.soloTier,
      solo_rank: meta.soloRank,
      solo_lp: meta.soloLp,
      solo_wins: null,
      solo_losses: null,
      matches,
      sync_error: null,
      synced_at: matches.length > 0 ? nowIso : "",
    };

    aggregatedPlayers.push(
      aggregatePlayerStats(fakeRow, {
        playerKey: meta.playerKey,
        riotId: meta.riotId,
        teamId: meta.teamId,
        teamName: meta.teamName,
        teamLogoUrl: meta.teamLogoUrl,
        divisionId: meta.divisionId,
        divisionName: meta.divisionName,
        role: meta.role,
      })
    );
  }

  const playersByTeam = new Map<string, AggregatedPlayerStats[]>();
  for (const p of aggregatedPlayers) {
    if (!p.teamId) continue;
    const list = playersByTeam.get(p.teamId) ?? [];
    list.push(p);
    playersByTeam.set(p.teamId, list);
  }

  const aggregatedTeams: AggregatedTeamStats[] = rosterTeams.map((t) => {
    const teamPlayers = playersByTeam.get(t.teamId) ?? [];
    const teamMatches = teamPlayers.flatMap((p) => p.matches);
    const uniqueTeamMatches = new Map<string, CompactRiotMatch>();
    for (const m of teamMatches) {
      if (!uniqueTeamMatches.has(m.matchId)) {
        uniqueTeamMatches.set(m.matchId, m);
      }
    }
    const distinctMatches = [...uniqueTeamMatches.values()];
    const games = distinctMatches.length;
    const wins = distinctMatches.filter((m) => m.win).length;

    const totalKills = teamMatches.reduce((s, m) => s + m.kills, 0);
    const totalDeaths = teamMatches.reduce((s, m) => s + m.deaths, 0);
    const totalAssists = teamMatches.reduce((s, m) => s + m.assists, 0);
    const totalDmg = teamMatches.reduce(
      (s, m) => s + m.totalDamageDealtToChampions,
      0
    );
    const totalGold = teamMatches.reduce((s, m) => s + m.goldEarned, 0);
    const totalCs = teamMatches.reduce((s, m) => s + m.cs, 0);
    const totalPlayerMinutes =
      teamMatches.reduce((s, m) => s + m.gameDuration, 0) / 60;
    const totalGameMinutes =
      distinctMatches.reduce((s, m) => s + m.gameDuration, 0) / 60;

    const blueMatches = distinctMatches.filter((m) => m.teamId === 100);
    const redMatches = distinctMatches.filter((m) => m.teamId === 200);

    const champMap = new Map<string, { games: number; wins: number }>();
    for (const m of teamMatches) {
      const c = champMap.get(m.championName) ?? { games: 0, wins: 0 };
      c.games += 1;
      if (m.win) c.wins += 1;
      champMap.set(m.championName, c);
    }

    return {
      teamId: t.teamId,
      teamName: t.teamName,
      logoUrl: t.logoUrl,
      divisionId: t.divisionId,
      divisionName: t.divisionName,
      players: teamPlayers,
      games,
      wins,
      winRate: games > 0 ? (wins / games) * 100 : 0,
      avgKda:
        totalDeaths > 0
          ? (totalKills + totalAssists) / totalDeaths
          : totalKills + totalAssists,
      avgDpm: totalPlayerMinutes > 0 ? totalDmg / totalPlayerMinutes : 0,
      avgGpm: totalPlayerMinutes > 0 ? totalGold / totalPlayerMinutes : 0,
      avgCsPerMin: totalPlayerMinutes > 0 ? totalCs / totalPlayerMinutes : 0,
      avgGameMinutes: games > 0 ? totalGameMinutes / games : 0,
      blueGames: blueMatches.length,
      blueWins: blueMatches.filter((m) => m.win).length,
      redGames: redMatches.length,
      redWins: redMatches.filter((m) => m.win).length,
      topChampions: [...champMap.entries()]
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => b.games - a.games || b.wins - a.wins),
    };
  });

  return {
    players: aggregatedPlayers,
    teams: aggregatedTeams,
    fetchedAt: nowIso,
    rowCount: uniqueRows.length,
    matchCount: uniqueGames.size,
  };
}

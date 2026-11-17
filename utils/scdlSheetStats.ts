import type { CompactRiotMatch } from "@/utils/riotApi";
import draftsData from "@/data/scdl_drafts.json";
import {
  aggregatePlayerStats,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
  type RiotPlayerStatRow,
} from "@/utils/riotStatsAggregation";

export interface DraftRecord {
  blueTeam: string;
  redTeam: string;
  blueBans: string[];
  redBans: string[];
  bluePicks: string[];
  redPicks: string[];
  bans: string[];
  sourceUrl: string;
}

const DRAFTS_BY_GAME_ID = draftsData as Record<string, DraftRecord>;

const SCDL_SHEET_ID = "1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A";
const SCDL_SHEET_GIDS = [
  { gid: "1733612942", label: "Tab 1" },
  { gid: "1849724071", label: "Tab 2" },
];

export interface UnrosteredSheetPlayer {
  riotId: string;
  teamName: string;
  role: string;
  games: number;
}

export interface SheetSyncSummary {
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  unrosteredPlayers: UnrosteredSheetPlayer[];
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
  goldDiff15: number;
  turretPlates: number;
  objectivesStolen: number;
  questionPings: number;
  flashKey?: "D" | "F";
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
      goldDiff15: parseNum(get(cols, "GDiff@15")),
      turretPlates: parseNum(get(cols, "Turret Plates")),
      objectivesStolen: parseNum(get(cols, "Objectives Stolen")),
      questionPings: parseNum(get(cols, "? Pings")),
      flashKey:
        get(cols, "Summoner D").toLowerCase() === "flash"
          ? "D"
          : get(cols, "Summoner F").toLowerCase() === "flash"
          ? "F"
          : undefined,
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

  // Lookup maps from active roster (including alt accounts)
  const rosterByKey = new Map<string, AggregatedPlayerStats>();
  const rosterByDisplay = new Map<string, AggregatedPlayerStats>();
  for (const p of rosterPlayers) {
    rosterByKey.set(normalizeRiotKey(p.playerKey), p);
    rosterByDisplay.set(p.displayName.trim().toLowerCase(), p);
    for (const alt of p.altAccounts ?? []) {
      const altKey = normalizeRiotKey(alt);
      if (altKey && !rosterByKey.has(altKey)) {
        rosterByKey.set(altKey, p);
      }
      const altDisp = alt.split("#")[0].trim().toLowerCase();
      if (altDisp && !rosterByDisplay.has(altDisp)) {
        rosterByDisplay.set(altDisp, p);
      }
    }
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
  const unrosteredMap = new Map<string, UnrosteredSheetPlayer>();

  for (const r of uniqueRows) {
    uniqueGames.add(r.gameId);
    const normKey = normalizeRiotKey(r.playerName);
    const dispKey = r.playerName.split("#")[0].trim().toLowerCase();

    const matchedRoster =
      rosterByKey.get(normKey) ?? rosterByDisplay.get(dispKey);
    if (!matchedRoster) {
      const existing = unrosteredMap.get(normKey);
      if (existing) {
        existing.games += 1;
      } else {
        unrosteredMap.set(normKey, {
          riotId: r.playerName,
          teamName: r.teamName,
          role: r.role,
          games: 1,
        });
      }
      continue;
    }

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
      bans: DRAFTS_BY_GAME_ID[r.gameId]?.bans,
      flashKey: r.flashKey,
      goldDiff15: r.goldDiff15,
      questionPings: r.questionPings,
      turretPlates: r.turretPlates,
      objectivesStolen: r.objectivesStolen,
      matchLabel: r.matchLabel,
      teamName: r.teamName,
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

    const seriesBuckets = new Map<string, { w: number; l: number }>();
    for (const m of distinctMatches) {
      const sKey = m.matchLabel?.trim() || m.matchId;
      const b = seriesBuckets.get(sKey) ?? { w: 0, l: 0 };
      if (m.win) b.w += 1;
      else b.l += 1;
      seriesBuckets.set(sKey, b);
    }
    let seriesWins = 0;
    let seriesLosses = 0;
    for (const b of seriesBuckets.values()) {
      if (b.w > b.l) seriesWins += 1;
      else if (b.l > b.w) seriesLosses += 1;
    }

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
      seriesWins,
      seriesLosses,
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

  const unrosteredPlayers = [...unrosteredMap.values()].sort(
    (a, b) =>
      a.teamName.localeCompare(b.teamName) ||
      b.games - a.games ||
      a.riotId.localeCompare(b.riotId)
  );

  return {
    players: aggregatedPlayers,
    teams: aggregatedTeams,
    unrosteredPlayers,
    fetchedAt: nowIso,
    rowCount: uniqueRows.length,
    matchCount: uniqueGames.size,
  };
}

export interface ScdlGamePlayerRow {
  playerName: string;
  displayName: string;
  teamName: string;
  role: string;
  champion: string;
  side: "Blue" | "Red";
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageDealt: number;
  visionScore: number;
  goldDiff: number | null;
  goldDiff15: number;
  soloKills: number;
}

export interface ScdlGameDetail {
  gameId: string;
  seriesKey: string;
  matchLabel: string;
  roundLabel: string;
  gameDuration: number;
  blueTeam: string;
  redTeam: string;
  winnerTeam: string;
  blueKills: number;
  redKills: number;
  draft: DraftRecord | null;
  players: ScdlGamePlayerRow[];
}

export interface ScdlSeriesDetail {
  seriesKey: string;
  matchLabel: string;
  roundLabel: string;
  teamA: string;
  teamB: string;
  teamAWins: number;
  teamBWins: number;
  games: ScdlGameDetail[];
}

function formatRoundLabel(matchLabel: string): string {
  const raw = matchLabel.split("_")[0] ?? "";
  return raw ? raw.replace(/([a-zA-Z]+)(\d+)/, "$1 $2") : "League Match";
}

async function fetchAllUniqueSheetRows(): Promise<ParsedSheetRow[]> {
  const csvTexts = await Promise.all(
    SCDL_SHEET_GIDS.map(async ({ gid }) => {
      const url = `https://docs.google.com/spreadsheets/d/${SCDL_SHEET_ID}/export?format=csv&gid=${gid}`;
      const res = await fetch(url, { next: { revalidate: 120 } });
      if (!res.ok) return "";
      return res.text();
    })
  );
  let allRows: ParsedSheetRow[] = [];
  for (let t = 0; t < csvTexts.length; t++) {
    if (csvTexts[t]) allRows = allRows.concat(parseCsvRows(csvTexts[t], t * 100_000));
  }
  const seen = new Set<string>();
  const unique: ParsedSheetRow[] = [];
  for (const r of allRows) {
    const k = `${r.gameId}::${normalizeRiotKey(r.playerName)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }
  return unique;
}

export async function fetchAllScdlSeries(): Promise<ScdlSeriesDetail[]> {
  const rows = await fetchAllUniqueSheetRows();
  const byGame = new Map<string, ParsedSheetRow[]>();
  for (const r of rows) {
    const list = byGame.get(r.gameId) ?? [];
    list.push(r);
    byGame.set(r.gameId, list);
  }

  const seriesMap = new Map<string, ScdlGameDetail[]>();

  for (const [gameId, gRows] of byGame.entries()) {
    const blueRows = gRows.filter((r) => r.side === "Blue");
    const redRows = gRows.filter((r) => r.side === "Red");
    const blueTeam = blueRows[0]?.teamName ?? "Blue";
    const redTeam = redRows[0]?.teamName ?? "Red";
    const winnerTeam = gRows.find((r) => r.win)?.teamName ?? blueTeam;
    const matchLabel = gRows[0]?.matchLabel || gameId;
    const seriesKey = matchLabel;
    const gameDuration = gRows[0]?.gameLength ?? 0;

    const players: ScdlGamePlayerRow[] = gRows.map((r) => {
      const opp = gRows.find(
        (o) =>
          o.teamName.toLowerCase() !== r.teamName.toLowerCase() &&
          o.role === r.role
      );
      return {
        playerName: r.playerName,
        displayName: r.playerName.split("#")[0].trim() || r.playerName,
        teamName: r.teamName,
        role: r.role,
        champion: r.champion,
        side: r.side,
        win: r.win,
        kills: r.kills,
        deaths: r.deaths,
        assists: r.assists,
        cs: r.cs,
        gold: r.gold,
        damageDealt: r.damageDealt,
        visionScore: r.visionScore,
        goldDiff: opp ? r.gold - opp.gold : null,
        goldDiff15: r.goldDiff15,
        soloKills: r.soloKills,
      };
    });

    const detail: ScdlGameDetail = {
      gameId,
      seriesKey,
      matchLabel,
      roundLabel: formatRoundLabel(matchLabel),
      gameDuration,
      blueTeam,
      redTeam,
      winnerTeam,
      blueKills: blueRows.reduce((s, r) => s + r.kills, 0),
      redKills: redRows.reduce((s, r) => s + r.kills, 0),
      draft: DRAFTS_BY_GAME_ID[gameId] ?? null,
      players,
    };

    const sList = seriesMap.get(seriesKey) ?? [];
    sList.push(detail);
    seriesMap.set(seriesKey, sList);
  }

  const seriesList: ScdlSeriesDetail[] = [];
  for (const [seriesKey, games] of seriesMap.entries()) {
    const first = games[0];
    const teamA = first.blueTeam;
    const teamB = first.redTeam;
    const teamAWins = games.filter(
      (g) => g.winnerTeam.toLowerCase() === teamA.toLowerCase()
    ).length;
    const teamBWins = games.length - teamAWins;
    seriesList.push({
      seriesKey,
      matchLabel: first.matchLabel,
      roundLabel: first.roundLabel,
      teamA,
      teamB,
      teamAWins,
      teamBWins,
      games,
    });
  }

function roundSortRank(label: string): number {
  const m = label.match(/round\s*(\d+)/i);
  if (m) return Number(m[1]);
  if (/quarter/i.test(label)) return 1001;
  if (/semi/i.test(label)) return 1002;
  if (/final/i.test(label)) return 1003;
  return 999;
}

  seriesList.sort(
    (a, b) =>
      roundSortRank(a.roundLabel) - roundSortRank(b.roundLabel) ||
      a.matchLabel.localeCompare(b.matchLabel)
  );

  return seriesList;
}

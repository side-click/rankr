import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
  missingDraftGames: { gameId: string; matchLabel: string }[];
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

export interface SheetSourceConfig {
  sheetId?: string | null;
  gids?: string[] | null;
  bypassCache?: boolean;
}

const SNAPSHOT_WRITE_INTERVAL_MS = 5 * 60_000;
const lastSnapshotWriteBySheet = new Map<string, number>();

function getSnapshotClient(requireServiceRole: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = requireServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function saveSheetSnapshot(
  sheetId: string,
  gids: string[],
  csvTexts: string[],
  force = false
): Promise<void> {
  const now = Date.now();
  const lastWrite = lastSnapshotWriteBySheet.get(sheetId) ?? 0;
  if (!force && now - lastWrite < SNAPSHOT_WRITE_INTERVAL_MS) return;
  const sb = getSnapshotClient(true);
  if (!sb) return;
  lastSnapshotWriteBySheet.set(sheetId, now);
  try {
    await sb.from("sheet_snapshots").upsert(
      {
        sheet_id: sheetId,
        gids,
        csv_tabs: csvTexts,
        fetched_at: new Date(now).toISOString(),
      },
      { onConflict: "sheet_id" }
    );
  } catch {
    // Non-fatal if sheet_snapshots migration hasn't been applied yet
  }
}

async function loadSheetSnapshotFallback(
  sheetId: string
): Promise<ParsedSheetRow[] | null> {
  const sb = getSnapshotClient(false);
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("sheet_snapshots")
      .select("csv_tabs")
      .eq("sheet_id", sheetId)
      .maybeSingle();
    if (error || !Array.isArray(data?.csv_tabs)) return null;
    const csvTexts = (data.csv_tabs as unknown[]).filter(
      (t): t is string => typeof t === "string" && t.length > 0
    );
    if (csvTexts.length === 0) return null;
    return dedupeParsedRows(csvTexts);
  } catch {
    return null;
  }
}

async function fetchCsvTabsFromGoogle(
  sheetId: string,
  gids: string[],
  bypassCache: boolean
): Promise<string[]> {
  return Promise.all(
    gids.map(async (gid) => {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const res = await fetch(
        url,
        bypassCache ? { cache: "no-store" } : { next: { revalidate: 120 } }
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch SCDL sheet tab ${gid} (${res.status})`);
      }
      return res.text();
    })
  );
}

const fetchUniqueSheetRowsCached = cache(
  async (sheetId: string, gidsKey: string): Promise<ParsedSheetRow[]> => {
    const gids = gidsKey.split(",").filter(Boolean);
    try {
      const csvTexts = await fetchCsvTabsFromGoogle(sheetId, gids, false);
      const rows = dedupeParsedRows(csvTexts);
      if (rows.length > 0) {
        void saveSheetSnapshot(sheetId, gids, csvTexts, false);
        return rows;
      }
    } catch {
      // Fall back to Supabase snapshot below
    }
    const fallback = await loadSheetSnapshotFallback(sheetId);
    if (fallback) return fallback;
    throw new Error(`Failed to load SCDL sheet ${sheetId} and no backup snapshot exists`);
  }
);

function dedupeParsedRows(csvTexts: string[]): ParsedSheetRow[] {
  let allRows: ParsedSheetRow[] = [];
  for (let t = 0; t < csvTexts.length; t++) {
    if (csvTexts[t]) {
      allRows = allRows.concat(parseCsvRows(csvTexts[t], t * 100_000));
    }
  }
  const seenRowKeys = new Set<string>();
  const uniqueRows: ParsedSheetRow[] = [];
  for (const r of allRows) {
    const key = `${r.gameId}::${normalizeRiotKey(r.playerName)}`;
    if (seenRowKeys.has(key)) continue;
    seenRowKeys.add(key);
    uniqueRows.push(r);
  }
  return uniqueRows;
}

async function loadUniqueSheetRows(
  config?: SheetSourceConfig
): Promise<ParsedSheetRow[]> {
  const sheetId = config?.sheetId?.trim() || SCDL_SHEET_ID;
  const gids =
    config?.gids && config.gids.length > 0
      ? config.gids
      : SCDL_SHEET_GIDS.map((g) => g.gid);

  if (config?.bypassCache) {
    try {
      const csvTexts = await fetchCsvTabsFromGoogle(sheetId, gids, true);
      const rows = dedupeParsedRows(csvTexts);
      if (rows.length > 0) {
        await saveSheetSnapshot(sheetId, gids, csvTexts, true);
        return rows;
      }
    } catch (err) {
      const fallback = await loadSheetSnapshotFallback(sheetId);
      if (fallback) return fallback;
      throw err;
    }
  }

  return fetchUniqueSheetRowsCached(sheetId, gids.join(","));
}

export async function fetchScdlSheetStats(
  rosterPlayers: AggregatedPlayerStats[],
  rosterTeams: AggregatedTeamStats[],
  config?: SheetSourceConfig
): Promise<SheetSyncSummary> {
  const uniqueRows = await loadUniqueSheetRows(config);

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
  const missingDraftMap = new Map<string, { gameId: string; matchLabel: string }>();

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

    const draftRecord = DRAFTS_BY_GAME_ID[r.gameId];
    if (!draftRecord && r.gameId && !missingDraftMap.has(r.gameId)) {
      missingDraftMap.set(r.gameId, {
        gameId: r.gameId,
        matchLabel: r.matchLabel || r.gameId,
      });
    }

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

    const seriesBuckets = new Map<
      string,
      { w: number; l: number; order: number }
    >();
    distinctMatches.forEach((m, idx) => {
      const sKey = m.matchLabel?.trim() || m.matchId;
      const roundMatch = sKey.match(/(\d+)/);
      const order = roundMatch
        ? Number(roundMatch[1]) * 1_000_000 + idx
        : m.gameCreation || idx;
      const b = seriesBuckets.get(sKey) ?? { w: 0, l: 0, order };
      if (m.win) b.w += 1;
      else b.l += 1;
      b.order = Math.max(b.order, order);
      seriesBuckets.set(sKey, b);
    });
    let seriesWins = 0;
    let seriesLosses = 0;
    for (const b of seriesBuckets.values()) {
      if (b.w > b.l) seriesWins += 1;
      else if (b.l > b.w) seriesLosses += 1;
    }
    let seriesStreak = 0;
    const orderedSeries = [...seriesBuckets.values()].sort(
      (a, b) => b.order - a.order
    );
    for (const b of orderedSeries) {
      if (b.w > b.l) {
        seriesStreak += 1;
      } else if (b.l > b.w) {
        break;
      }
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
      seriesStreak,
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

  // Build head-to-head series records across unique sheet games
  const h2hGamesBySeries = new Map<
    string,
    Map<string, { teamA: string; teamB: string; winner: string }>
  >();
  for (const r of uniqueRows) {
    const sKey = r.matchLabel?.trim() || r.gameId;
    let gMap = h2hGamesBySeries.get(sKey);
    if (!gMap) {
      gMap = new Map();
      h2hGamesBySeries.set(sKey, gMap);
    }
    const existing = gMap.get(r.gameId) ?? {
      teamA: "",
      teamB: "",
      winner: "",
    };
    const tLower = r.teamName.trim().toLowerCase();
    if (!existing.teamA) existing.teamA = tLower;
    else if (existing.teamA !== tLower && !existing.teamB) existing.teamB = tLower;
    if (r.win) existing.winner = tLower;
    gMap.set(r.gameId, existing);
  }

  // h2hSeriesRecord[teamLower][oppLower] = { wins, losses }
  // h2hGameRecord[teamLower][oppLower] = { wins, losses }
  const h2hRecord = new Map<
    string,
    Map<string, { wins: number; losses: number }>
  >();
  const h2hGameRecord = new Map<
    string,
    Map<string, { wins: number; losses: number }>
  >();
  const addRecord = (
    map: Map<string, Map<string, { wins: number; losses: number }>>,
    winner: string,
    loser: string
  ) => {
    if (!map.has(winner)) map.set(winner, new Map());
    if (!map.has(loser)) map.set(loser, new Map());
    const wEntry = map.get(winner)!.get(loser) ?? { wins: 0, losses: 0 };
    wEntry.wins += 1;
    map.get(winner)!.set(loser, wEntry);
    const lEntry = map.get(loser)!.get(winner) ?? { wins: 0, losses: 0 };
    lEntry.losses += 1;
    map.get(loser)!.set(winner, lEntry);
  };

  for (const gMap of h2hGamesBySeries.values()) {
    const gamesList = [...gMap.values()].filter((g) => g.teamA && g.teamB);
    if (gamesList.length === 0) continue;
    for (const g of gamesList) {
      if (g.winner === g.teamA) {
        addRecord(h2hGameRecord, g.teamA, g.teamB);
      } else if (g.winner === g.teamB) {
        addRecord(h2hGameRecord, g.teamB, g.teamA);
      }
    }
    const tA = gamesList[0].teamA;
    const tB = gamesList[0].teamB;
    let aWins = 0;
    let bWins = 0;
    for (const g of gamesList) {
      if (g.winner === tA) aWins++;
      else if (g.winner === tB) bWins++;
    }
    if (aWins === bWins) continue;
    const sWinner = aWins > bWins ? tA : tB;
    const sLoser = aWins > bWins ? tB : tA;
    addRecord(h2hRecord, sWinner, sLoser);
  }

  // Compute division standings & seeds per official rulebook Section 4.4:
  // Primary: Overall series win/loss record.
  // Tiebreakers (4.4.1 for 2 teams, 4.4.2 for 3+ teams):
  //   1. Highest head-to-head match winning percentage among the tied teams.
  //   2. Highest individual game winning percentage in matches played between the tied teams.
  //   3. Highest individual game winning percentage across all matches in the season.
  // After any step, if some teams separate while others remain tied, restart from Step 1
  // using only the remaining tied teams.
  const getH2HWinPct = (
    team: AggregatedTeamStats,
    tiedNames: Set<string>,
    recordMap: Map<string, Map<string, { wins: number; losses: number }>>
  ): number => {
    const teamLower = team.teamName.trim().toLowerCase();
    const oppMap = recordMap.get(teamLower);
    if (!oppMap) return 0;
    let w = 0;
    let l = 0;
    for (const [opp, rec] of oppMap.entries()) {
      if (opp !== teamLower && tiedNames.has(opp)) {
        w += rec.wins;
        l += rec.losses;
      }
    }
    return w + l > 0 ? w / (w + l) : 0;
  };

  const splitByScore = (
    group: AggregatedTeamStats[],
    scoreFn: (t: AggregatedTeamStats) => number
  ): AggregatedTeamStats[][] => {
    const scored = group
      .map((team) => ({ team, score: scoreFn(team) }))
      .sort((a, b) => b.score - a.score);
    const subGroups: AggregatedTeamStats[][] = [];
    const EPS = 1e-9;
    for (const item of scored) {
      const last = subGroups[subGroups.length - 1];
      if (!last) {
        subGroups.push([item.team]);
      } else {
        const prevScore = scoreFn(last[0]);
        if (Math.abs(prevScore - item.score) <= EPS) {
          last.push(item.team);
        } else {
          subGroups.push([item.team]);
        }
      }
    }
    return subGroups;
  };

  const resolveTieGroup = (
    group: AggregatedTeamStats[]
  ): AggregatedTeamStats[] => {
    if (group.length <= 1) return group;

    const tiedNames = new Set(group.map((t) => t.teamName.trim().toLowerCase()));
    const steps: Array<(t: AggregatedTeamStats) => number> = [
      // Step 1: Head-to-head match winning percentage among tied teams
      (t) => getH2HWinPct(t, tiedNames, h2hRecord),
      // Step 2: Individual game winning percentage in matches between tied teams
      (t) => getH2HWinPct(t, tiedNames, h2hGameRecord),
      // Step 3: Individual game winning percentage across all season matches
      (t) => (t.games > 0 ? t.wins / t.games : 0),
    ];

    for (const stepScore of steps) {
      const subGroups = splitByScore(group, stepScore);
      if (subGroups.length > 1) {
        return subGroups.flatMap((sub) =>
          sub.length > 1 ? resolveTieGroup(sub) : sub
        );
      }
    }

    // Still tied after all criteria (would be resolved by Bo1 tiebreaker match)
    return [...group].sort(
      (a, b) => b.avgKda - a.avgKda || a.teamName.localeCompare(b.teamName)
    );
  };

  const teamsByDiv = new Map<string, AggregatedTeamStats[]>();
  for (const team of aggregatedTeams) {
    const list = teamsByDiv.get(team.divisionId) ?? [];
    list.push(team);
    teamsByDiv.set(team.divisionId, list);
  }
  for (const [divId, divList] of teamsByDiv.entries()) {
    divList.sort((a, b) => {
      const aHas = a.games > 0 ? 1 : 0;
      const bHas = b.games > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;

      const aSW = a.seriesWins ?? a.wins;
      const aSL = a.seriesLosses ?? Math.max(0, a.games - a.wins);
      const bSW = b.seriesWins ?? b.wins;
      const bSL = b.seriesLosses ?? Math.max(0, b.games - b.wins);
      const aSPct = aSW + aSL > 0 ? aSW / (aSW + aSL) : 0;
      const bSPct = bSW + bSL > 0 ? bSW / (bSW + bSL) : 0;
      if (Math.abs(bSPct - aSPct) > 1e-9) return bSPct - aSPct;
      return (bSW - bSL) - (aSW - aSL);
    });

    // Group teams with identical overall series win/loss record and resolve ties
    const recordGroups: AggregatedTeamStats[][] = [];
    for (const t of divList) {
      const sW = t.seriesWins ?? t.wins;
      const sL = t.seriesLosses ?? Math.max(0, t.games - t.wins);
      const key = `${t.games > 0 ? 1 : 0}:${sW}:${sL}`;
      const last = recordGroups[recordGroups.length - 1];
      if (last) {
        const lastSW = last[0].seriesWins ?? last[0].wins;
        const lastSL = last[0].seriesLosses ?? Math.max(0, last[0].games - last[0].wins);
        const lastKey = `${last[0].games > 0 ? 1 : 0}:${lastSW}:${lastSL}`;
        if (lastKey === key) {
          last.push(t);
          continue;
        }
      }
      recordGroups.push([t]);
    }

    const sortedDiv = recordGroups.flatMap((group) => resolveTieGroup(group));
    sortedDiv.forEach((t, idx) => {
      t.seed = idx + 1;
    });
    teamsByDiv.set(divId, sortedDiv);
  }

  const unrosteredPlayers = [...unrosteredMap.values()].sort(
    (a, b) =>
      a.teamName.localeCompare(b.teamName) ||
      b.games - a.games ||
      a.riotId.localeCompare(b.riotId)
  );

  const missingDraftGames = [...missingDraftMap.values()].sort((a, b) =>
    a.matchLabel.localeCompare(b.matchLabel)
  );

  return {
    players: aggregatedPlayers,
    teams: aggregatedTeams,
    unrosteredPlayers,
    missingDraftGames,
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
  blueDeaths: number;
  blueAssists: number;
  blueDragons: number;
  blueBarons: number;
  redKills: number;
  redDeaths: number;
  redAssists: number;
  redDragons: number;
  redBarons: number;
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

export async function fetchAllScdlSeries(
  config?: SheetSourceConfig
): Promise<ScdlSeriesDetail[]> {
  const rows = await loadUniqueSheetRows(config).catch(() => []);
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
      blueDeaths: blueRows.reduce((s, r) => s + r.deaths, 0),
      blueAssists: blueRows.reduce((s, r) => s + r.assists, 0),
      blueDragons: blueRows.reduce((s, r) => s + r.dragons, 0),
      blueBarons: blueRows.reduce((s, r) => s + r.barons, 0),
      redKills: redRows.reduce((s, r) => s + r.kills, 0),
      redDeaths: redRows.reduce((s, r) => s + r.deaths, 0),
      redAssists: redRows.reduce((s, r) => s + r.assists, 0),
      redDragons: redRows.reduce((s, r) => s + r.dragons, 0),
      redBarons: redRows.reduce((s, r) => s + r.barons, 0),
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

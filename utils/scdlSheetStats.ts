import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { CompactRiotMatch } from "@/utils/riotApi";
import draftsData from "@/data/scdl_drafts.json";
import {
  aggregatePlayerStats,
  isMatchPlayoff,
  isPlayoffMatchLabel,
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

export const SCDL_SHEET_ID = "1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A";
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

export interface IncompleteDataGame {
  gameId: string;
  matchLabel: string;
  issues: string[];
}

export interface DraftIntegrityIssue {
  gameId: string;
  matchLabel: string;
  issue: string;
}

export interface PlayoffSeriesMatchup {
  seriesKey: string;
  matchLabel: string;
  roundLabel: string;
  roundOrder: number;
  divisionId: string;
  teamAId: string | null;
  teamAName: string;
  teamALogoUrl: string | null;
  teamASeed: number | null;
  teamAWins: number;
  teamBId: string | null;
  teamBName: string;
  teamBLogoUrl: string | null;
  teamBSeed: number | null;
  teamBWins: number;
  winnerTeamName: string | null;
  gamesCount: number;
}

export interface SheetSyncSummary {
  players: AggregatedPlayerStats[];
  subPlayers: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  unrosteredPlayers: UnrosteredSheetPlayer[];
  missingDraftGames: { gameId: string; matchLabel: string }[];
  incompleteDataGames: IncompleteDataGame[];
  draftIntegrityIssues: DraftIntegrityIssue[];
  playoffSeries: PlayoffSeriesMatchup[];
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
  missingFields?: string[];
  isPlayoff?: boolean;
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

    const matchRaw = get(cols, "Match");
    const teamRaw = get(cols, "Team Name");
    const roleRaw = get(cols, "Role");
    const sideRaw = get(cols, "Blue/Red");
    const winRaw = get(cols, "Win");
    const lengthRaw = get(cols, "Game Length");
    const goldRaw = get(cols, "Gold");
    const dmgRaw = get(cols, "Damage Dealt");
    const killsRaw = get(cols, "Kills");
    const deathsRaw = get(cols, "Deaths");
    const assistsRaw = get(cols, "Assists");
    const csRaw = get(cols, "CS");
    const visionRaw = get(cols, "Vision Score");

    const missingFields: string[] = [];
    if (!matchRaw) missingFields.push("Match");
    if (!teamRaw) missingFields.push("Team Name");
    if (!roleRaw) missingFields.push("Role");
    if (!/^(blue|red)$/i.test(sideRaw)) missingFields.push("Blue/Red");
    if (!/^(true|false)$/i.test(winRaw)) missingFields.push("Win");
    if (!lengthRaw || parseNum(lengthRaw) <= 0) missingFields.push("Game Length");
    if (!goldRaw || parseNum(goldRaw) <= 0) missingFields.push("Gold");
    if (!dmgRaw || parseNum(dmgRaw) <= 0) missingFields.push("Damage Dealt");
    if (!killsRaw) missingFields.push("Kills");
    if (!deathsRaw) missingFields.push("Deaths");
    if (!assistsRaw) missingFields.push("Assists");
    if (!csRaw) missingFields.push("CS");
    if (!visionRaw) missingFields.push("Vision Score");

    if (colIndex.has("GDiff@15") && !get(cols, "GDiff@15")) {
      missingFields.push("GDiff@15");
    }
    if (
      colIndex.has("Control Wards Bought") &&
      !get(cols, "Control Wards Bought")
    ) {
      missingFields.push("Control Wards Bought");
    }
    if (colIndex.has("? Pings") && !get(cols, "? Pings")) {
      missingFields.push("? Pings");
    }
    if (
      colIndex.has("First Blood Participation") &&
      !/^(true|false)$/i.test(get(cols, "First Blood Participation"))
    ) {
      missingFields.push("First Blood Participation");
    }
    if (
      (colIndex.has("Summoner D") || colIndex.has("Summoner F")) &&
      !get(cols, "Summoner D") &&
      !get(cols, "Summoner F")
    ) {
      missingFields.push("Summoner D/F");
    }

    rows.push({
      matchLabel: matchRaw,
      gameId,
      teamName: teamRaw,
      playerName,
      champion,
      role: normalizeRoleKey(roleRaw),
      kills: parseNum(killsRaw),
      deaths: parseNum(deathsRaw),
      assists: parseNum(assistsRaw),
      gold: parseNum(goldRaw),
      cs: parseNum(csRaw),
      damageDealt: parseNum(dmgRaw),
      gameLength: parseNum(lengthRaw),
      visionScore: parseNum(visionRaw),
      win: parseBool(winRaw),
      side: sideRaw.toLowerCase() === "red" ? "Red" : "Blue",
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
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      rowOrder: startOrder + i,
    });
  }
  return rows;
}

export interface SheetSourceConfig {
  seasonId?: string | null;
  seasonSlug?: string | null;
  provider?: "google_sheet" | "supabase_native" | "none" | null;
  sheetId?: string | null;
  gids?: string[] | null;
  playoffGids?: string[] | null;
  scheduleGid?: string | null;
  regularSeasonRounds?: number | null;
  creditsLabel?: string | null;
  creditsUrl?: string | null;
  creditsAttribution?: string | null;
  bypassCache?: boolean;
}

const fetchMergedDraftsFromDb = unstable_cache(
  async (
    seasonId?: string,
    seasonSlug?: string
  ): Promise<Record<string, DraftRecord>> => {
    const merged: Record<string, DraftRecord> =
      !seasonId || seasonSlug === "season-4-5" ? { ...DRAFTS_BY_GAME_ID } : {};
    const sb = getSnapshotClient(false);
    if (!sb) return merged;
    try {
      let q = sb
        .from("match_drafts")
        .select(
          "game_id, blue_team, red_team, blue_bans, red_bans, blue_picks, red_picks, source_url"
        );
      if (seasonId) {
        q = q.eq("season_id", seasonId);
      }
      const { data, error } = await q;
      if (error || !Array.isArray(data)) return merged;
      for (const row of data) {
        const gameId = String(row.game_id ?? "").trim();
        if (!gameId) continue;
        const isRealBan = (b: unknown): b is string =>
          typeof b === "string" &&
          b.trim().length > 0 &&
          !/^(nothing|none|no\s*ban|-|—|n\/a)$/i.test(b.trim());
        const blueBans = Array.isArray(row.blue_bans)
          ? (row.blue_bans as unknown[]).filter(isRealBan)
          : [];
        const redBans = Array.isArray(row.red_bans)
          ? (row.red_bans as unknown[]).filter(isRealBan)
          : [];
        const bluePicks = Array.isArray(row.blue_picks)
          ? (row.blue_picks as string[])
          : [];
        const redPicks = Array.isArray(row.red_picks)
          ? (row.red_picks as string[])
          : [];
        merged[gameId] = {
          blueTeam: String(row.blue_team ?? "Blue"),
          redTeam: String(row.red_team ?? "Red"),
          blueBans,
          redBans,
          bluePicks,
          redPicks,
          bans: [...blueBans, ...redBans],
          sourceUrl: String(row.source_url ?? ""),
        };
      }
    } catch {
      // Non-fatal if match_drafts migration hasn't been applied yet
    }
    return merged;
  },
  ["merged-match-drafts"],
  { revalidate: 60, tags: ["public-stats", "match-drafts"] }
);

const loadMergedDraftsCached = cache(
  async (seasonId?: string, seasonSlug?: string) =>
    fetchMergedDraftsFromDb(seasonId, seasonSlug)
);

async function loadSupabaseNativeRows(
  seasonId: string
): Promise<ParsedSheetRow[]> {
  const sb = getSnapshotClient(false);
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("league_game_participants")
      .select("*")
      .eq("season_id", seasonId)
      .order("row_order", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((r, idx) => ({
      matchLabel: String(r.match_label ?? r.game_id ?? ""),
      gameId: String(r.game_id ?? ""),
      teamName: String(r.team_name ?? ""),
      playerName: String(r.player_name ?? ""),
      champion: String(r.champion ?? ""),
      role: normalizeRoleKey(String(r.role ?? "mid")),
      kills: Number(r.kills ?? 0),
      deaths: Number(r.deaths ?? 0),
      assists: Number(r.assists ?? 0),
      gold: Number(r.gold ?? 0),
      cs: Number(r.cs ?? 0),
      damageDealt: Number(r.damage_dealt ?? 0),
      gameLength: Number(r.game_length ?? 0),
      visionScore: Number(r.vision_score ?? 0),
      win: Boolean(r.win),
      side: String(r.side ?? "Blue").toLowerCase() === "red" ? "Red" : "Blue",
      doubleKills: Number(r.double_kills ?? 0),
      tripleKills: Number(r.triple_kills ?? 0),
      quadraKills: Number(r.quadra_kills ?? 0),
      pentaKills: Number(r.penta_kills ?? 0),
      soloKills: Number(r.solo_kills ?? 0),
      firstBlood: Boolean(r.first_blood),
      teamKills: Number(r.team_kills ?? 0),
      damageTaken: Number(r.damage_taken ?? 0),
      damageMitigated: Number(r.damage_mitigated ?? 0),
      ccScore: Number(r.cc_score ?? 0),
      wardsPlaced: Number(r.wards_placed ?? 0),
      wardsDestroyed: Number(r.wards_destroyed ?? 0),
      controlWardsBought: Number(r.control_wards_bought ?? 0),
      damageToObjectives: Number(r.damage_to_objectives ?? 0),
      damageToTurrets: Number(r.damage_to_turrets ?? 0),
      dragons: Number(r.dragons ?? 0),
      barons: Number(r.barons ?? 0),
      largestKillingSpree: Number(r.largest_killing_spree ?? 0),
      goldDiff15: Number(r.gold_diff_15 ?? 0),
      turretPlates: Number(r.turret_plates ?? 0),
      objectivesStolen: Number(r.objectives_stolen ?? 0),
      questionPings: Number(r.question_pings ?? 0),
      flashKey:
        r.flash_key === "D" || r.flash_key === "F" ? r.flash_key : undefined,
      rowOrder: Number(r.row_order ?? idx + 1),
    }));
  } catch {
    return [];
  }
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
  sheetId: string,
  playoffGidsSet?: Set<string>,
  regularSeasonRounds?: number | null
): Promise<{ rows: ParsedSheetRow[]; fetchedAtMs: number; gids: string[] } | null> {
  const sb = getSnapshotClient(false);
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("sheet_snapshots")
      .select("gids, csv_tabs, fetched_at")
      .eq("sheet_id", sheetId)
      .maybeSingle();
    if (error || !Array.isArray(data?.csv_tabs)) return null;
    const csvTexts = (data.csv_tabs as unknown[]).filter(
      (t): t is string => typeof t === "string" && t.length > 0
    );
    if (csvTexts.length === 0) return null;
    const snapGids = Array.isArray(data.gids)
      ? (data.gids as unknown[]).map((g) => String(g))
      : [];
    const playoffIndices = new Set<number>();
    if (playoffGidsSet && playoffGidsSet.size > 0) {
      snapGids.forEach((gid, idx) => {
        if (playoffGidsSet.has(gid)) playoffIndices.add(idx);
      });
    }
    const rows = dedupeParsedRows(
      csvTexts,
      playoffIndices,
      regularSeasonRounds
    );
    if (rows.length === 0) return null;
    const fetchedAtMs = data.fetched_at
      ? new Date(String(data.fetched_at)).getTime()
      : 0;
    return {
      rows,
      fetchedAtMs: Number.isFinite(fetchedAtMs) ? fetchedAtMs : 0,
      gids: snapGids,
    };
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

const SNAPSHOT_STALE_MS = 120_000;
const inFlightRefreshBySheet = new Set<string>();

function refreshSheetFromGoogleInBackground(
  sheetId: string,
  gids: string[],
  playoffIndices: Set<number>,
  regularSeasonRounds?: number | null
) {
  if (inFlightRefreshBySheet.has(sheetId)) return;
  inFlightRefreshBySheet.add(sheetId);
  void fetchCsvTabsFromGoogle(sheetId, gids, true)
    .then(async (csvTexts) => {
      const rows = dedupeParsedRows(
        csvTexts,
        playoffIndices,
        regularSeasonRounds
      );
      if (rows.length > 0) {
        await saveSheetSnapshot(sheetId, gids, csvTexts, true);
      }
    })
    .catch(() => {})
    .finally(() => {
      inFlightRefreshBySheet.delete(sheetId);
    });
}

const fetchUniqueSheetRowsCached = cache(
  async (
    sheetId: string,
    gidsKey: string,
    playoffGidsKey: string,
    regularRoundsKey: string
  ): Promise<ParsedSheetRow[]> => {
    const gids = gidsKey.split(",").filter(Boolean);
    const playoffSet = new Set(playoffGidsKey.split(",").filter(Boolean));
    const regularSeasonRounds = regularRoundsKey ? Number(regularRoundsKey) : null;
    const playoffIndices = new Set<number>();
    gids.forEach((g, idx) => {
      if (playoffSet.has(g)) playoffIndices.add(idx);
    });

    // 1. Stale-while-revalidate: serve from fast Supabase snapshot (~15ms) first if available
    const snap = await loadSheetSnapshotFallback(
      sheetId,
      playoffSet,
      regularSeasonRounds
    );
    const sameGids =
      snap &&
      snap.gids.length === gids.length &&
      snap.gids.every((g, i) => g === gids[i]);
    if (snap && snap.rows.length > 0 && sameGids) {
      if (Date.now() - snap.fetchedAtMs > SNAPSHOT_STALE_MS) {
        refreshSheetFromGoogleInBackground(
          sheetId,
          gids,
          playoffIndices,
          regularSeasonRounds
        );
      }
      return snap.rows;
    }

    // 2. Cold start or newly configured GIDs: fetch from Google Sheets and seed snapshot
    const csvTexts = await fetchCsvTabsFromGoogle(sheetId, gids, false);
    const rows = dedupeParsedRows(csvTexts, playoffIndices, regularSeasonRounds);
    if (rows.length > 0) {
      void saveSheetSnapshot(sheetId, gids, csvTexts, true);
      return rows;
    }
    if (snap && snap.rows.length > 0) return snap.rows;
    throw new Error(`Failed to load SCDL sheet ${sheetId} and no backup snapshot exists`);
  }
);

function dedupeParsedRows(
  csvTexts: string[],
  playoffIndices?: Set<number>,
  regularSeasonRounds?: number | null
): ParsedSheetRow[] {
  let allRows: ParsedSheetRow[] = [];
  for (let t = 0; t < csvTexts.length; t++) {
    if (csvTexts[t]) {
      const tabIsPlayoff = playoffIndices?.has(t) ?? false;
      const parsed = parseCsvRows(csvTexts[t], t * 100_000).map((r) => ({
        ...r,
        isPlayoff:
          tabIsPlayoff ||
          isPlayoffMatchLabel(r.matchLabel, regularSeasonRounds),
      }));
      allRows = allRows.concat(parsed);
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

export async function loadUniqueSheetRows(
  config?: SheetSourceConfig
): Promise<ParsedSheetRow[]> {
  if (config?.provider === "none") {
    return [];
  }
  if (config?.provider === "supabase_native") {
    return config.seasonId ? loadSupabaseNativeRows(config.seasonId) : [];
  }

  const isLegacy45 =
    !config ||
    !config.seasonSlug ||
    config.seasonSlug === "season-4-5" ||
    config.seasonSlug.includes("4-5");
  const sheetId =
    config?.sheetId?.trim() || (isLegacy45 ? SCDL_SHEET_ID : "");
  if (!sheetId) return [];

  const regGids =
    config?.gids && config.gids.length > 0
      ? config.gids
      : isLegacy45
      ? SCDL_SHEET_GIDS.map((g) => g.gid)
      : [];
  const playoffGids = (config?.playoffGids ?? []).filter(Boolean);
  const gids = [...new Set([...regGids, ...playoffGids])];
  if (gids.length === 0) return [];

  const playoffSet = new Set(playoffGids);
  const playoffIndices = new Set<number>();
  gids.forEach((g, idx) => {
    if (playoffSet.has(g)) playoffIndices.add(idx);
  });

  if (config?.bypassCache) {
    try {
      const csvTexts = await fetchCsvTabsFromGoogle(sheetId, gids, true);
      const rows = dedupeParsedRows(
        csvTexts,
        playoffIndices,
        config?.regularSeasonRounds
      );
      if (rows.length > 0) {
        await saveSheetSnapshot(sheetId, gids, csvTexts, true);
        return rows;
      }
    } catch (err) {
      const fallback = await loadSheetSnapshotFallback(
        sheetId,
        playoffSet,
        config?.regularSeasonRounds
      );
      if (fallback) return fallback.rows;
      throw err;
    }
  }

  return fetchUniqueSheetRowsCached(
    sheetId,
    gids.join(","),
    playoffGids.join(","),
    config?.regularSeasonRounds ? String(config.regularSeasonRounds) : ""
  );
}

export async function fetchScdlSheetStats(
  rosterPlayers: AggregatedPlayerStats[],
  rosterTeams: AggregatedTeamStats[],
  config?: SheetSourceConfig
): Promise<SheetSyncSummary> {
  const [uniqueRows, draftsByGameId] = await Promise.all([
    loadUniqueSheetRows(config),
    loadMergedDraftsCached(
      config?.seasonId ?? undefined,
      config?.seasonSlug ?? undefined
    ),
  ]);

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
  const subMatchesByBucket = new Map<
    string,
    {
      meta: {
        playerKey: string;
        riotId: string;
        teamId: string | null;
        teamName: string;
        teamLogoUrl: string | null;
        divisionId: string | null;
        divisionName: string;
        role: string;
      };
      matches: CompactRiotMatch[];
    }
  >();

  for (const r of uniqueRows) {
    uniqueGames.add(r.gameId);
    const normKey = normalizeRiotKey(r.playerName);
    const dispKey = r.playerName.split("#")[0].trim().toLowerCase();

    const matchedRoster =
      rosterByKey.get(normKey) ?? rosterByDisplay.get(dispKey);
    let targetBucket: { matches: CompactRiotMatch[] } | undefined;

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
      const teamMeta = teamMetaByName.get(r.teamName.trim().toLowerCase());
      const subKey = `sub::${normKey}::${teamMeta?.divisionId ?? "none"}::${r.role}`;
      let subBucket = subMatchesByBucket.get(subKey);
      if (!subBucket) {
        subBucket = {
          meta: {
            playerKey: subKey,
            riotId: r.playerName,
            teamId: null,
            teamName: "",
            teamLogoUrl: null,
            divisionId: teamMeta?.divisionId ?? null,
            divisionName: teamMeta?.divisionName ?? "Division",
            role: r.role,
          },
          matches: [],
        };
        subMatchesByBucket.set(subKey, subBucket);
      }
      targetBucket = subBucket;
    } else {
      targetBucket = matchesByPlayerKey.get(matchedRoster.playerKey);
    }

    const bucket = targetBucket;
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

    const draftRecord = draftsByGameId[r.gameId];
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
      bans: draftsByGameId[r.gameId]?.bans,
      flashKey: r.flashKey,
      goldDiff15: r.goldDiff15,
      questionPings: r.questionPings,
      turretPlates: r.turretPlates,
      objectivesStolen: r.objectivesStolen,
      matchLabel: r.matchLabel,
      isPlayoff:
        r.isPlayoff ??
        isPlayoffMatchLabel(r.matchLabel, config?.regularSeasonRounds),
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

  const subPlayers: AggregatedPlayerStats[] = [];
  for (const { meta, matches } of subMatchesByBucket.values()) {
    const fakeRow: RiotPlayerStatRow = {
      player_key: meta.playerKey,
      riot_id: meta.riotId,
      puuid: null,
      season_id: null,
      division_id: meta.divisionId,
      team_id: meta.teamId,
      role: meta.role,
      solo_tier: null,
      solo_rank: null,
      solo_lp: null,
      solo_wins: null,
      solo_losses: null,
      matches,
      sync_error: null,
      synced_at: matches.length > 0 ? nowIso : "",
    };
    subPlayers.push(
      aggregatePlayerStats(fakeRow, {
        playerKey: meta.playerKey,
        riotId: meta.riotId,
        teamId: meta.teamId,
        teamName: meta.teamName,
        teamLogoUrl: meta.teamLogoUrl,
        divisionId: meta.divisionId,
        divisionName: meta.divisionName,
        role: meta.role,
        isSub: true,
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
    const teamMatches = teamPlayers
      .flatMap((p) => p.matches)
      .filter((m) => !isMatchPlayoff(m));
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

  // Build head-to-head series records across unique regular season sheet games
  const h2hGamesBySeries = new Map<
    string,
    Map<string, { teamA: string; teamB: string; winner: string }>
  >();
  for (const r of uniqueRows) {
    if (
      r.isPlayoff ??
      isPlayoffMatchLabel(r.matchLabel, config?.regularSeasonRounds)
    ) {
      continue;
    }
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

  // Build incomplete data audit across unique games (ignoring Ban)
  const incompleteDataGames: IncompleteDataGame[] = [];
  for (const [gameId, gRows] of rowsByGame.entries()) {
    const issues: string[] = [];
    if (gRows.length !== 10) {
      issues.push(`Expected 10 player rows (found ${gRows.length})`);
    }
    const fieldCounts = new Map<string, number>();
    for (const r of gRows) {
      for (const f of r.missingFields ?? []) {
        fieldCounts.set(f, (fieldCounts.get(f) ?? 0) + 1);
      }
    }
    for (const [field, cnt] of fieldCounts.entries()) {
      issues.push(
        `Missing ${field} (${cnt} ${cnt === 1 ? "row" : "rows"})`
      );
    }
    if (issues.length > 0) {
      incompleteDataGames.push({
        gameId,
        matchLabel: gRows[0]?.matchLabel || gameId,
        issues,
      });
    }
  }
  incompleteDataGames.sort((a, b) =>
    a.matchLabel.localeCompare(b.matchLabel)
  );

  // Build Playoff series bracket matchups (using frozen regular-season seeds)
  const teamStatsByName = new Map<string, AggregatedTeamStats>();
  for (const t of aggregatedTeams) {
    teamStatsByName.set(t.teamName.trim().toLowerCase(), t);
  }
  const playoffSeriesMap = new Map<
    string,
    Map<string, { teamA: string; teamB: string; winner: string }>
  >();
  for (const r of uniqueRows) {
    if (
      !(
        r.isPlayoff ??
        isPlayoffMatchLabel(r.matchLabel, config?.regularSeasonRounds)
      )
    ) {
      continue;
    }
    const sKey = r.matchLabel.trim() || r.gameId;
    let gMap = playoffSeriesMap.get(sKey);
    if (!gMap) {
      gMap = new Map();
      playoffSeriesMap.set(sKey, gMap);
    }
    const existing = gMap.get(r.gameId) ?? {
      teamA: "",
      teamB: "",
      winner: "",
    };
    const tName = r.teamName.trim();
    if (!existing.teamA) existing.teamA = tName;
    else if (
      existing.teamA.toLowerCase() !== tName.toLowerCase() &&
      !existing.teamB
    ) {
      existing.teamB = tName;
    }
    if (r.win) existing.winner = tName;
    gMap.set(r.gameId, existing);
  }

  const playoffSeries: PlayoffSeriesMatchup[] = [];
  for (const [seriesKey, gMap] of playoffSeriesMap.entries()) {
    const gamesList = [...gMap.values()];
    if (gamesList.length === 0) continue;
    const teamAName = gamesList[0].teamA;
    const teamBName = gamesList[0].teamB || "TBD";
    let teamAWins = 0;
    let teamBWins = 0;
    for (const g of gamesList) {
      if (g.winner.toLowerCase() === teamAName.toLowerCase()) teamAWins++;
      else if (teamBName && g.winner.toLowerCase() === teamBName.toLowerCase())
        teamBWins++;
    }
    const teamAMeta = teamStatsByName.get(teamAName.toLowerCase());
    const teamBMeta = teamStatsByName.get(teamBName.toLowerCase());
    const divisionId = teamAMeta?.divisionId ?? teamBMeta?.divisionId ?? "";
    const roundLabel = formatRoundLabel(seriesKey);
    const lowerPrefix = seriesKey.split("_")[0].trim().toLowerCase();
    let roundOrder = 3;
    if (/play-?in/i.test(lowerPrefix)) roundOrder = 1;
    else if (/quarter|^qf\d*$/i.test(lowerPrefix)) roundOrder = 2;
    else if (/semi|^sf\d*$/i.test(lowerPrefix)) roundOrder = 4;
    else if (/final|^gf\d*$/i.test(lowerPrefix)) roundOrder = 5;

    const winnerTeamName =
      teamAWins > teamBWins
        ? teamAName
        : teamBWins > teamAWins
        ? teamBName
        : null;

    playoffSeries.push({
      seriesKey,
      matchLabel: seriesKey,
      roundLabel,
      roundOrder,
      divisionId,
      teamAId: teamAMeta?.teamId ?? null,
      teamAName: teamAMeta?.teamName ?? teamAName,
      teamALogoUrl: teamAMeta?.logoUrl ?? null,
      teamASeed: teamAMeta?.seed ?? null,
      teamAWins,
      teamBId: teamBMeta?.teamId ?? null,
      teamBName: teamBMeta?.teamName ?? teamBName,
      teamBLogoUrl: teamBMeta?.logoUrl ?? null,
      teamBSeed: teamBMeta?.seed ?? null,
      teamBWins,
      winnerTeamName,
      gamesCount: gamesList.length,
    });
  }
  playoffSeries.sort(
    (a, b) =>
      a.roundOrder - b.roundOrder || a.matchLabel.localeCompare(b.matchLabel)
  );

  // Audit draft dataset integrity: duplicate source URLs and pick vs played-champion mismatches
  const draftIntegrityIssues: DraftIntegrityIssue[] = [];
  const normChamp = (s: string) => {
    const k = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (k === "wukong") return "monkeyking";
    if (k === "renataglasc") return "renata";
    return k;
  };
  const gamesBySourceUrl = new Map<string, string[]>();
  for (const [gameId, gRows] of rowsByGame.entries()) {
    const draft = draftsByGameId[gameId];
    if (!draft) continue;
    const matchLabel = gRows[0]?.matchLabel || gameId;
    const src = draft.sourceUrl?.trim().replace(/\/+$/, "").toLowerCase();
    if (src) {
      const list = gamesBySourceUrl.get(src) ?? [];
      list.push(gameId);
      gamesBySourceUrl.set(src, list);
    }
    const draftPicks = [...draft.bluePicks, ...draft.redPicks]
      .map(normChamp)
      .filter(Boolean);
    const playedSet = new Set(gRows.map((r) => normChamp(r.champion)));
    if (draftPicks.length >= 10 && playedSet.size >= 8) {
      const matchesCount = draftPicks.filter((c) => playedSet.has(c)).length;
      if (matchesCount < 7) {
        draftIntegrityIssues.push({
          gameId,
          matchLabel,
          issue: `Pick mismatch: only ${matchesCount}/10 draft picks match played champions`,
        });
      }
    }
  }
  for (const [src, gIds] of gamesBySourceUrl.entries()) {
    if (gIds.length > 1) {
      for (const gid of gIds) {
        const gRows = rowsByGame.get(gid);
        draftIntegrityIssues.push({
          gameId: gid,
          matchLabel: gRows?.[0]?.matchLabel || gid,
          issue: `Duplicate draft URL shared across ${gIds.length} games (${src})`,
        });
      }
    }
  }
  draftIntegrityIssues.sort((a, b) =>
    a.matchLabel.localeCompare(b.matchLabel)
  );

  return {
    players: aggregatedPlayers,
    subPlayers,
    teams: aggregatedTeams,
    unrosteredPlayers,
    missingDraftGames,
    incompleteDataGames,
    draftIntegrityIssues,
    playoffSeries,
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
  const [rows, draftsByGameId] = await Promise.all([
    loadUniqueSheetRows(config).catch(() => []),
    loadMergedDraftsCached(
      config?.seasonId ?? undefined,
      config?.seasonSlug ?? undefined
    ),
  ]);
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
      draft: draftsByGameId[gameId] ?? null,
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

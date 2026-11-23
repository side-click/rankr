import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestDdragonVersion } from "@/utils/riotApi";
import {
  loadUniqueSheetRows,
  SCDL_SHEET_ID,
  type SheetSourceConfig,
} from "@/utils/scdlSheetStats";

export interface DraftImportEntry {
  gameId: string;
  matchLabel: string;
  url: string;
  reason?: string;
}

export interface DraftImportSummary {
  totalSheetGames: number;
  alreadyCompleteCount: number;
  imported: DraftImportEntry[];
  manualReview: DraftImportEntry[];
  warnings: DraftImportEntry[];
  unmatched: { gameId: string; matchLabel: string }[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function normChampKey(s: string): string {
  const k = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (k === "wukong") return "monkeyking";
  if (k === "renataglasc") return "renata";
  return k;
}

async function buildChampionNormalizer() {
  const ver = await getLatestDdragonVersion();
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`,
    { next: { revalidate: 3600 } }
  );
  const dd = (await res.json()) as {
    data: Record<string, { id: string; key: string; name: string }>;
  };

  const byKey = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const champ of Object.values(dd.data)) {
    byKey.set(String(champ.key), champ.id);
    byName.set(normChampKey(champ.id), champ.id);
    byName.set(normChampKey(champ.name), champ.id);
  }

  return (raw: unknown): string | null => {
    if (raw == null) return null;
    if (typeof raw === "number") return byKey.get(String(raw)) ?? String(raw);
    const s = String(raw).trim();
    if (!s || /^none$/i.test(s)) return null;
    if (/^\d+$/.test(s)) return byKey.get(s) ?? s;
    return byName.get(normChampKey(s)) ?? s;
  };
}

function parseScheduleDraftLinks(html: string): {
  byRoundAndTeams: Map<string, string>;
  byTeamsOnly: Map<string, string[]>;
} {
  const byRoundAndTeams = new Map<string, string>();
  const byTeamsOnly = new Map<string, string[]>();
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let baronRound = 0;
  let dragonRound = 0;

  for (const rowMatch of rows) {
    const trHtml = rowMatch[1];
    const cells = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => m[1]
    );
    if (cells.length === 0) continue;

    cells.forEach((cellHtml, idx) => {
      const txt = stripTags(cellHtml);
      const rm = txt.match(/ROUND\s*(\d+)/i);
      if (rm) {
        const rNum = Number(rm[1]);
        if (idx < cells.length / 2) baronRound = rNum;
        else dragonRound = rNum;
      }
    });

    for (let idx = 0; idx < cells.length; idx++) {
      const urlMatch = cells[idx].match(
        /href="https:\/\/www\.google\.com\/url\?q=([^&"]+)/i
      );
      const url = urlMatch ? decodeURIComponent(urlMatch[1]) : null;
      if (!url) continue;

      const isLeft = idx < cells.length / 2;
      const startCol = isLeft ? 0 : Math.floor(cells.length / 2);
      const roundNum = isLeft ? baronRound : dragonRound;

      const textCells = cells
        .slice(startCol, idx)
        .map((c) => stripTags(c))
        .filter(
          (t) =>
            t &&
            !/^(vs|draft|\d+)$/i.test(t) &&
            !/^round\s*\d+/i.test(t)
        );
      if (textCells.length >= 2) {
        const n1 = normTeam(textCells[0]);
        const n2 = normTeam(textCells[textCells.length - 1]);
        if (roundNum > 0) {
          byRoundAndTeams.set(`${roundNum}::${n1}::${n2}`, url);
          byRoundAndTeams.set(`${roundNum}::${n2}::${n1}`, url);
        }
        const pairKey = [n1, n2].sort().join("::");
        const list = byTeamsOnly.get(pairKey) ?? [];
        if (!list.includes(url)) list.push(url);
        byTeamsOnly.set(pairKey, list);
      }
    }
  }

  return { byRoundAndTeams, byTeamsOnly };
}

async function fetchLowBudgetDraft(
  url: string,
  normalizeChamp: (raw: unknown) => string | null
) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);

  if (parts[0] === "fearless" && parts[1]) {
    const fRes = await fetch(
      `https://backend.lowbudgetlcs.com/draft/api/pastFearless/${parts[1]}`,
      { cache: "no-store" }
    );
    const fJson = (await fRes.json()) as {
      draftLobbyCodes?: string[];
      team1Picks?: string[];
      team2Picks?: string[];
      team1Bans?: string[];
      team2Bans?: string[];
    };
    const lobbyCode = fJson?.draftLobbyCodes?.[0];
    if (lobbyCode) {
      const dRes = await fetch(
        `https://backend.lowbudgetlcs.com/draft/api/pastDraft/${lobbyCode}`,
        { cache: "no-store" }
      );
      const dJson = (await dRes.json()) as {
        isValid?: boolean;
        draftState?: {
          blueBans?: string[];
          redBans?: string[];
          bluePicks?: string[];
          redPicks?: string[];
        };
      };
      if (dJson?.isValid && dJson?.draftState) {
        const ds = dJson.draftState;
        return {
          blueBans: (ds.blueBans ?? []).map(normalizeChamp).filter(Boolean) as string[],
          redBans: (ds.redBans ?? []).map(normalizeChamp).filter(Boolean) as string[],
          bluePicks: (ds.bluePicks ?? []).map(normalizeChamp).filter(Boolean) as string[],
          redPicks: (ds.redPicks ?? []).map(normalizeChamp).filter(Boolean) as string[],
        };
      }
    }
    if (Array.isArray(fJson?.team1Picks)) {
      return {
        blueBans: (fJson.team1Bans ?? []).map(normalizeChamp).filter(Boolean) as string[],
        redBans: (fJson.team2Bans ?? []).map(normalizeChamp).filter(Boolean) as string[],
        bluePicks: (fJson.team1Picks ?? []).map(normalizeChamp).filter(Boolean) as string[],
        redPicks: (fJson.team2Picks ?? []).map(normalizeChamp).filter(Boolean) as string[],
      };
    }
    throw new Error("Empty pastFearless response");
  }

  for (const code of parts) {
    const res = await fetch(
      `https://backend.lowbudgetlcs.com/draft/api/pastDraft/${code}`,
      { cache: "no-store" }
    );
    const json = (await res.json()) as {
      isValid?: boolean;
      draftState?: {
        blueBans?: string[];
        redBans?: string[];
        bluePicks?: string[];
        redPicks?: string[];
      };
    };
    if (json?.isValid && json?.draftState) {
      const ds = json.draftState;
      const bluePicks = (ds.bluePicks ?? []).map(normalizeChamp).filter(Boolean) as string[];
      const redPicks = (ds.redPicks ?? []).map(normalizeChamp).filter(Boolean) as string[];
      if (bluePicks.length >= 5 && redPicks.length >= 5) {
        return {
          blueBans: (ds.blueBans ?? []).map(normalizeChamp).filter(Boolean) as string[],
          redBans: (ds.redBans ?? []).map(normalizeChamp).filter(Boolean) as string[],
          bluePicks,
          redPicks,
        };
      }
    }
  }
  throw new Error("No completed draftState found for lowbudgetlcs link");
}

async function fetchDraftifyDraft(
  url: string,
  normalizeChamp: (raw: unknown) => string | null
) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  const seriesId = parts[parts.length - 1];
  const gameNum = Number(u.searchParams.get("game") ?? "1") || 1;
  const res = await fetch(
    `https://draftify.lol/api/series/${seriesId}/results`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`draftify API ${res.status}`);
  const json = (await res.json()) as {
    games?: {
      number?: number;
      bans?: { blue?: unknown[]; red?: unknown[] };
      picks?: { blue?: unknown[]; red?: unknown[] };
    }[];
  };
  const game =
    (json.games ?? []).find((g) => Number(g.number) === gameNum) ??
    json.games?.[0];
  if (!game) throw new Error("No game in draftify results");

  const extractIds = (arr: unknown[] | undefined): string[] =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => {
        if (x && typeof x === "object") {
          const obj = x as { championId?: unknown; id?: unknown };
          return normalizeChamp(obj.championId ?? obj.id);
        }
        return normalizeChamp(x);
      })
      .filter((x): x is string => Boolean(x));

  return {
    blueBans: extractIds(game.bans?.blue),
    redBans: extractIds(game.bans?.red),
    bluePicks: extractIds(game.picks?.blue),
    redPicks: extractIds(game.picks?.red),
  };
}

export async function importMissingDraftsForSeason(
  config: SheetSourceConfig | undefined,
  supabase: SupabaseClient
): Promise<DraftImportSummary> {
  const isLegacy45 =
    !config ||
    !config.seasonSlug ||
    config.seasonSlug === "season-4-5" ||
    config.seasonSlug.includes("4-5");
  const sheetId =
    config?.sheetId?.trim() || (isLegacy45 ? SCDL_SHEET_ID : "");
  const scheduleGid =
    config?.scheduleGid?.trim() || (isLegacy45 ? "728267243" : "");

  if (!sheetId || !scheduleGid) {
    throw new Error(
      "Missing Stats Sheet ID or Schedule / Draft Links Tab GID on this season (configure in Admin → Seasons)."
    );
  }

  const [uniqueRows, existingRes, normalizeChamp] = await Promise.all([
    loadUniqueSheetRows({ ...config, bypassCache: true }),
    supabase.from("match_drafts").select("game_id, source_url"),
    buildChampionNormalizer(),
  ]);

  const existingGameIds = new Set<string>();
  const usedSourceUrls = new Map<string, string>();
  for (const row of existingRes.data ?? []) {
    const gid = String(row.game_id ?? "").trim();
    if (!gid) continue;
    existingGameIds.add(gid);
    const src = row.source_url ? normUrl(String(row.source_url)) : "";
    if (src && !usedSourceUrls.has(src)) {
      usedSourceUrls.set(src, gid);
    }
  }

  const gamesById = new Map<
    string,
    {
      gameId: string;
      matchLabel: string;
      roundNum: number;
      blueTeam: string;
      redTeam: string;
      playedChamps: Set<string>;
    }
  >();

  for (const r of uniqueRows) {
    if (!r.gameId) continue;
    const entry = gamesById.get(r.gameId) ?? {
      gameId: r.gameId,
      matchLabel: r.matchLabel || r.gameId,
      roundNum: Number(r.matchLabel.match(/Round\s*(\d+)/i)?.[1] ?? 0),
      blueTeam: "",
      redTeam: "",
      playedChamps: new Set<string>(),
    };
    if (r.side === "Blue" && r.teamName) entry.blueTeam = r.teamName;
    if (r.side === "Red" && r.teamName) entry.redTeam = r.teamName;
    if (r.champion) entry.playedChamps.add(normChampKey(r.champion));
    gamesById.set(r.gameId, entry);
  }

  const totalSheetGames = gamesById.size;
  const missingGames = [...gamesById.values()].filter(
    (g) => !existingGameIds.has(g.gameId)
  );
  const alreadyCompleteCount = totalSheetGames - missingGames.length;

  if (missingGames.length === 0) {
    return {
      totalSheetGames,
      alreadyCompleteCount,
      imported: [],
      manualReview: [],
      warnings: [],
      unmatched: [],
    };
  }

  const schedRes = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview/sheet?gid=${scheduleGid}`,
    { cache: "no-store" }
  );
  if (!schedRes.ok) {
    throw new Error(
      `Failed to fetch Schedule Tab (${schedRes.status}) from Google Sheets.`
    );
  }
  const { byRoundAndTeams, byTeamsOnly } = parseScheduleDraftLinks(
    await schedRes.text()
  );

  const imported: DraftImportEntry[] = [];
  const manualReview: DraftImportEntry[] = [];
  const warnings: DraftImportEntry[] = [];
  const unmatched: { gameId: string; matchLabel: string }[] = [];
  const upsertMap = new Map<string, Record<string, unknown>>();

  for (const g of missingGames) {
    let url =
      g.roundNum > 0
        ? byRoundAndTeams.get(
            `${g.roundNum}::${normTeam(g.blueTeam)}::${normTeam(g.redTeam)}`
          )
        : undefined;
    if (!url) {
      const pairKey = [normTeam(g.blueTeam), normTeam(g.redTeam)]
        .sort()
        .join("::");
      const candidates = byTeamsOnly.get(pairKey) ?? [];
      if (candidates.length === 1) url = candidates[0];
    }

    if (!url) {
      unmatched.push({ gameId: g.gameId, matchLabel: g.matchLabel });
      continue;
    }

    const normalizedUrl = normUrl(url);
    const existingOwner = usedSourceUrls.get(normalizedUrl);
    if (existingOwner && existingOwner !== g.gameId) {
      warnings.push({
        gameId: g.gameId,
        matchLabel: g.matchLabel,
        url,
        reason: `Duplicate draft URL (already used by game ${existingOwner})`,
      });
      continue;
    }

    if (url.includes("drafter.lol")) {
      manualReview.push({
        gameId: g.gameId,
        matchLabel: g.matchLabel,
        url,
        reason: "drafter.lol blocks automated server fetches",
      });
      continue;
    }

    try {
      let parsed: {
        blueBans: string[];
        redBans: string[];
        bluePicks: string[];
        redPicks: string[];
      };
      if (url.includes("lowbudgetlcs.com")) {
        parsed = await fetchLowBudgetDraft(url, normalizeChamp);
      } else if (url.includes("draftify.lol")) {
        parsed = await fetchDraftifyDraft(url, normalizeChamp);
      } else {
        manualReview.push({
          gameId: g.gameId,
          matchLabel: g.matchLabel,
          url,
          reason: "Unsupported draft site domain",
        });
        continue;
      }

      const allPicks = [...parsed.bluePicks, ...parsed.redPicks];
      if (parsed.bluePicks.length !== 5 || parsed.redPicks.length !== 5) {
        warnings.push({
          gameId: g.gameId,
          matchLabel: g.matchLabel,
          url,
          reason: `Incomplete picks (${parsed.bluePicks.length} Blue + ${parsed.redPicks.length} Red)`,
        });
        continue;
      }

      const overlap = allPicks.filter((c) =>
        g.playedChamps.has(normChampKey(c))
      ).length;
      if (g.playedChamps.size >= 8 && overlap < 7) {
        warnings.push({
          gameId: g.gameId,
          matchLabel: g.matchLabel,
          url,
          reason: `Pick mismatch (${overlap}/10 draft picks match played champions — wrong link?)`,
        });
        continue;
      }

      usedSourceUrls.set(normalizedUrl, g.gameId);
      upsertMap.set(g.gameId, {
        game_id: g.gameId,
        season_id: config?.seasonId ?? null,
        blue_team: g.blueTeam || "Blue",
        red_team: g.redTeam || "Red",
        blue_bans: parsed.blueBans,
        red_bans: parsed.redBans,
        blue_picks: parsed.bluePicks,
        red_picks: parsed.redPicks,
        source_url: url,
        updated_at: new Date().toISOString(),
      });
      imported.push({ gameId: g.gameId, matchLabel: g.matchLabel, url });
    } catch (err) {
      warnings.push({
        gameId: g.gameId,
        matchLabel: g.matchLabel,
        url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const upsertRows = [...upsertMap.values()];
  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from("match_drafts")
      .upsert(upsertRows, { onConflict: "game_id" });
    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
  }

  return {
    totalSheetGames,
    alreadyCompleteCount,
    imported,
    manualReview,
    warnings,
    unmatched,
  };
}

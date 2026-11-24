import { getChampionCatalog } from "@/utils/championData";
import type { LeagueRole } from "@/utils/roles";

export interface MatchupStatEntry {
  championId: string;
  name: string;
  iconUrl: string;
  winRate: number;
  games: number;
}

export interface ChampionMatchupsResponse {
  championId: string;
  role: LeagueRole;
  tier: "platinum_plus";
  counters: MatchupStatEntry[];
  counteredBy: MatchupStatEntry[];
}

const ROLE_TO_LOLALYTICS_LANE: Record<LeagueRole, string> = {
  top: "top",
  jungle: "jungle",
  mid: "middle",
  bot: "bottom",
  support: "support",
};

const SPECIAL_LOLALYTICS_SLUGS = new Map<string, string>([
  ["MonkeyKing", "wukong"],
  ["Nunu", "nunu"],
  ["Renata", "renata"],
  ["FiddleSticks", "fiddlesticks"],
]);

export function toLolalyticsSlug(championId: string): string {
  const special = SPECIAL_LOLALYTICS_SLUGS.get(championId);
  if (special) {
    return special;
  }
  return championId.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function decodeQwikMatchups(html: string): {
  cid: number;
  vsWr: number;
  n: number;
}[] {
  const match = html.match(/<script type="qwik\/json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) return [];

  const parsed = JSON.parse(match[1]) as { objs?: unknown[] };
  const objs = parsed.objs;
  if (!Array.isArray(objs)) return [];

  const resolve = (ref: unknown): unknown => {
    if (typeof ref === "string" && /^[0-9a-z]+$/.test(ref)) {
      const idx = parseInt(ref, 36);
      if (idx >= 0 && idx < objs.length) return objs[idx];
    }
    return ref;
  };

  const rawArray = objs.find((o) => {
    if (!Array.isArray(o) || o.length === 0) return false;
    const first = resolve(o[0]);
    return (
      Boolean(first) &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      "cid" in (first as Record<string, unknown>) &&
      "vsWr" in (first as Record<string, unknown>) &&
      "n" in (first as Record<string, unknown>)
    );
  });

  if (!Array.isArray(rawArray)) return [];

  const results: { cid: number; vsWr: number; n: number }[] = [];
  for (const ref of rawArray) {
    const obj = resolve(ref);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
    const rec = obj as Record<string, unknown>;
    const cid = Number(resolve(rec.cid));
    const vsWr = Number(resolve(rec.vsWr));
    const n = Number(resolve(rec.n));
    if (Number.isFinite(cid) && Number.isFinite(vsWr) && Number.isFinite(n) && n > 0) {
      results.push({ cid, vsWr, n });
    }
  }
  return results;
}

export async function getChampionMatchups(
  championId: string,
  role: LeagueRole
): Promise<ChampionMatchupsResponse> {
  const catalog = await getChampionCatalog();
  const validChamp = catalog.champions.find(
    (c) => c.id.toLowerCase() === championId.trim().toLowerCase()
  );
  if (!validChamp) {
    throw new Error("Unknown championId");
  }

  const slug = toLolalyticsSlug(validChamp.id);
  const lane = ROLE_TO_LOLALYTICS_LANE[role];
  const url = `https://lolalytics.com/lol/${encodeURIComponent(
    slug
  )}/counters/?lane=${lane}&tier=platinum_plus`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    throw new Error(`Lolalytics returned status ${res.status}`);
  }

  const html = await res.text();
  const rawMatchups = decodeQwikMatchups(html);

  const byKey = new Map<number, (typeof catalog.champions)[number]>();
  for (const c of catalog.champions) {
    const keyNum = Number(c.key);
    if (Number.isFinite(keyNum)) byKey.set(keyNum, c);
  }

  const entries: MatchupStatEntry[] = [];
  for (const m of rawMatchups) {
    const champ = byKey.get(m.cid);
    if (!champ || champ.id === validChamp.id) continue;
    entries.push({
      championId: champ.id,
      name: champ.name,
      iconUrl: champ.iconUrl,
      winRate: Number(m.vsWr.toFixed(2)),
      games: m.n,
    });
  }

  const minGames =
    entries.filter((e) => e.games >= 50).length >= 10
      ? 50
      : entries.filter((e) => e.games >= 20).length >= 10
      ? 20
      : 5;

  const significant = entries.filter((e) => e.games >= minGames);
  const pool = significant.length >= 6 ? significant : entries;

  const counters = [...pool]
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    .slice(0, 6);

  const counteredBy = [...pool]
    .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
    .slice(0, 6);

  return {
    championId: validChamp.id,
    role,
    tier: "platinum_plus",
    counters,
    counteredBy,
  };
}

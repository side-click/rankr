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

const SPECIAL_LOLALYTICS_SLUGS: Record<string, string> = {
  MonkeyKing: "wukong",
  Nunu: "nunu",
  Renata: "renata",
  FiddleSticks: "fiddlesticks",
};

export function toLolalyticsSlug(championId: string): string {
  if (SPECIAL_LOLALYTICS_SLUGS[championId]) {
    return SPECIAL_LOLALYTICS_SLUGS[championId];
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
  const slug = toLolalyticsSlug(championId);
  const lane = ROLE_TO_LOLALYTICS_LANE[role];
  const url = `https://lolalytics.com/lol/${encodeURIComponent(
    slug
  )}/counters/?lane=${lane}&tier=platinum_plus`;

  const [catalog, res] = await Promise.all([
    getChampionCatalog(),
    fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    }),
  ]);

  if (!res.ok) {
    throw new Error(`Lolalytics returned status ${res.status}`);
  }

  const html = await res.text();
  const rawMatchups = decodeQwikMatchups(html);

  const byKey = new Map<number, (typeof catalog.champions)[number]>();
  for (const c of catalog.champions) {
    byKey.set(Number(c.key), c);
  }

  const mapped: MatchupStatEntry[] = [];
  for (const m of rawMatchups) {
    const champ = byKey.get(m.cid);
    if (!champ) continue;
    mapped.push({
      championId: champ.id,
      name: champ.name,
      iconUrl: champ.iconUrl,
      winRate: m.vsWr,
      games: m.n,
    });
  }

  // Counters: > 51% WR, top 5 by games played, ordered by strongest WR first
  const counters = mapped
    .filter((m) => m.winRate > 51)
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
    .sort((a, b) => b.winRate - a.winRate);

  // Countered By: < 49% WR, top 5 by games played, ordered by lowest WR first
  const counteredBy = mapped
    .filter((m) => m.winRate < 49)
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
    .sort((a, b) => a.winRate - b.winRate);

  return {
    championId,
    role,
    tier: "platinum_plus",
    counters,
    counteredBy,
  };
}

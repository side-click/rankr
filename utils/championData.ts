import { getChampionIconUrl, getLatestDdragonVersion } from "@/utils/riotApi";
import type { LeagueRole } from "@/utils/roles";

export interface ChampionCatalogItem {
  id: string; // DDragon id e.g. "Aatrox", "MonkeyKing"
  key: string; // Numeric string key e.g. "266"
  name: string; // Display name e.g. "Aatrox", "Wukong"
  roles: LeagueRole[]; // Guaranteed >= 1 role, sorted by global playRate desc
  rolePlayRates: Partial<Record<LeagueRole, number>>;
  iconUrl: string;
}

export interface ChampionCatalogResponse {
  ddVersion: string;
  ratesPatch: string | null;
  champions: ChampionCatalogItem[];
}

interface DdragonChampionEntry {
  id: string;
  key: string;
  name: string;
  tags?: string[];
}

type MerakiRoleKey = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

const MERAKI_TO_LEAGUE_ROLE: Record<MerakiRoleKey, LeagueRole> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "mid",
  BOTTOM: "bot",
  UTILITY: "support",
};

function inferFallbackRolesFromTags(tags: string[] = []): LeagueRole[] {
  const roles: LeagueRole[] = [];
  const addRole = (r: LeagueRole) => {
    if (!roles.includes(r)) roles.push(r);
  };

  for (const tag of tags) {
    if (tag === "Marksman") addRole("bot");
    else if (tag === "Support") addRole("support");
    else if (tag === "Fighter" || tag === "Tank") addRole("top");
    else if (tag === "Mage" || tag === "Assassin") addRole("mid");
  }

  if (roles.length === 0) {
    roles.push("mid");
  }
  return roles;
}

export async function getChampionCatalog(): Promise<ChampionCatalogResponse> {
  const ddVersion = await getLatestDdragonVersion();

  const [ddRes, merakiRes] = await Promise.all([
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`,
      { next: { revalidate: 3600 } }
    ),
    fetch(
      "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/championrates.json",
      { next: { revalidate: 3600 } }
    ).catch(() => null),
  ]);

  if (!ddRes.ok) {
    throw new Error(`Failed to load Data Dragon champions (${ddRes.status})`);
  }

  const ddJson = (await ddRes.json()) as {
    data: Record<string, DdragonChampionEntry>;
  };

  let ratesPatch: string | null = null;
  let ratesData: Record<
    string,
    Partial<Record<MerakiRoleKey, { playRate?: number }>>
  > = {};

  if (merakiRes && merakiRes.ok) {
    try {
      const merakiJson = (await merakiRes.json()) as {
        patch?: string;
        data?: Record<
          string,
          Partial<Record<MerakiRoleKey, { playRate?: number }>>
        >;
      };
      ratesPatch = merakiJson.patch ?? null;
      ratesData = merakiJson.data ?? {};
    } catch {
      // fallback to DDragon tags below
    }
  }

  const champions: ChampionCatalogItem[] = Object.values(ddJson.data ?? {})
    .map((champ) => {
      const rateEntry = ratesData[champ.key];
      const roleRates: { role: LeagueRole; playRate: number }[] = [];
      const rolePlayRates: Partial<Record<LeagueRole, number>> = {};

      if (rateEntry) {
        for (const [mKey, lRole] of Object.entries(MERAKI_TO_LEAGUE_ROLE) as [
          MerakiRoleKey,
          LeagueRole
        ][]) {
          const pr = Number(rateEntry[mKey]?.playRate ?? 0);
          if (Number.isFinite(pr) && pr > 0) {
            roleRates.push({ role: lRole, playRate: pr });
            rolePlayRates[lRole] = pr;
          }
        }
      }

      roleRates.sort((a, b) => b.playRate - a.playRate);
      const roles =
        roleRates.length > 0
          ? roleRates.map((r) => r.role)
          : inferFallbackRolesFromTags(champ.tags);

      return {
        id: champ.id,
        key: champ.key,
        name: champ.name,
        roles,
        rolePlayRates,
        iconUrl: getChampionIconUrl(champ.id, ddVersion),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ddVersion,
    ratesPatch,
    champions,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { getChampionCatalog } from "@/utils/championData";
import { getChampionMatchups } from "@/utils/lolalyticsMatchups";
import type { LeagueRole } from "@/utils/roles";

export const revalidate = 86400;

const VALID_ROLES = new Set<LeagueRole>([
  "top",
  "jungle",
  "mid",
  "bot",
  "support",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const championId = searchParams.get("championId")?.trim() ?? "";
  const role = (searchParams.get("role")?.trim() ?? "") as LeagueRole;

  if (!championId || !/^[A-Za-z]{2,32}$/.test(championId) || !VALID_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Missing or invalid championId or role" },
      { status: 400 }
    );
  }

  try {
    const catalog = await getChampionCatalog();
    const matched = catalog.champions.find(
      (c) => c.id.toLowerCase() === championId.toLowerCase()
    );
    if (!matched) {
      return NextResponse.json(
        { error: "Unknown championId" },
        { status: 400 }
      );
    }

    const data = await getChampionMatchups(matched.id, role);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load matchup data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

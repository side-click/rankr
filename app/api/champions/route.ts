import { NextResponse } from "next/server";
import { getChampionCatalog } from "@/utils/championData";

export const revalidate = 3600;

export async function GET() {
  try {
    const catalog = await getChampionCatalog();
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load champion catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

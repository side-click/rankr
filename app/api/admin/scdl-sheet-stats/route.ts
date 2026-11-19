import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/scdlSheetStats";

export async function GET() {
  const auth = await getServerAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ctx = await loadAdminStatsContext({ includeRiotStats: false });
    const summary = await fetchScdlSheetStats(ctx.players, ctx.teams, {
      ...ctx.sheetConfig,
      bypassCache: true,
    });
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load SCDL sheet stats",
      },
      { status: 500 }
    );
  }
}

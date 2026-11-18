import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/scdlSheetStats";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ctx = await loadAdminStatsContext();
    const summary = await fetchScdlSheetStats(ctx.players, ctx.teams, {
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

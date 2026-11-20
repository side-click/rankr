import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      gameId?: string;
      seasonId?: string | null;
      blueTeam?: string;
      redTeam?: string;
      blueBans?: string[];
      redBans?: string[];
      bluePicks?: string[];
      redPicks?: string[];
      sourceUrl?: string;
    };

    const gameId = String(body.gameId ?? "").trim();
    const blueTeam = String(body.blueTeam ?? "").trim();
    const redTeam = String(body.redTeam ?? "").trim();

    if (!gameId || !blueTeam || !redTeam) {
      return NextResponse.json(
        { error: "gameId, blueTeam, and redTeam are required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.from("match_drafts").upsert(
      {
        game_id: gameId,
        season_id: body.seasonId ?? null,
        blue_team: blueTeam,
        red_team: redTeam,
        blue_bans: Array.isArray(body.blueBans) ? body.blueBans : [],
        red_bans: Array.isArray(body.redBans) ? body.redBans : [],
        blue_picks: Array.isArray(body.bluePicks) ? body.bluePicks : [],
        red_picks: Array.isArray(body.redPicks) ? body.redPicks : [],
        source_url: body.sourceUrl?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "game_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, gameId });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save match draft",
      },
      { status: 500 }
    );
  }
}

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/leagueStats";
import { createClient } from "@/utils/supabase/server";
import {
  assertSeasonOperatorAccess,
  getServerAuthContext,
} from "@/utils/supabase/serverAuth";

export async function GET(req: Request) {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin && !auth.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const requestedSeasonId = searchParams.get("seasonId")?.trim() || null;
    let seasonSlug: string | undefined;

    if (requestedSeasonId) {
      const scope = await assertSeasonOperatorAccess(
        auth,
        supabase,
        requestedSeasonId
      );
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
      seasonSlug = scope.season.slug;
    }

    const ctx = await loadAdminStatsContext({
      includeRiotStats: false,
      seasonSlug,
    });
    if (!ctx.authorized) {
      return NextResponse.json({ error: "Forbidden for this league." }, { status: 403 });
    }

    const summary = await fetchScdlSheetStats(ctx.players, ctx.teams, {
      ...ctx.sheetConfig,
      bypassCache: true,
    });
    revalidateTag("public-stats");
    revalidateTag("home-stats");
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load league sheet stats",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin && !auth.isOperator) {
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
    const seasonId = body.seasonId ? String(body.seasonId).trim() : null;

    if (!gameId || !blueTeam || !redTeam) {
      return NextResponse.json(
        { error: "gameId, blueTeam, and redTeam are required." },
        { status: 400 }
      );
    }

    if (!seasonId) {
      if (!auth.isAdmin) {
        return NextResponse.json(
          { error: "seasonId is required for league operators." },
          { status: 400 }
        );
      }
    } else {
      const scope = await assertSeasonOperatorAccess(auth, supabase, seasonId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const { error } = await supabase.from("match_drafts").upsert(
      {
        game_id: gameId,
        season_id: seasonId,
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

    revalidateTag("match-drafts");
    revalidateTag("public-stats");
    revalidateTag("home-stats");

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

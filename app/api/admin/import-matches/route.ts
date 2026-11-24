import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

interface IncomingParticipantRow {
  game_id: string;
  match_label: string;
  team_name: string;
  player_name: string;
  champion: string;
  role: string;
  side?: string;
  win?: boolean;
  game_length?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  gold?: number;
  cs?: number;
  damage_dealt?: number;
  vision_score?: number;
  row_order?: number;
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
      seasonId?: string;
      rows?: IncomingParticipantRow[];
    };

    const seasonId = String(body.seasonId ?? "").trim();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!seasonId || rows.length === 0) {
      return NextResponse.json(
        { error: "seasonId and non-empty rows are required." },
        { status: 400 }
      );
    }
    if (rows.length > 500) {
      return NextResponse.json(
        { error: "Batch limit exceeded (max 500 participant rows per upload)." },
        { status: 400 }
      );
    }

    const { data: season } = await supabase
      .from("seasons")
      .select("id, league_id")
      .eq("id", seasonId)
      .maybeSingle();

    if (!season) {
      return NextResponse.json({ error: "Season not found." }, { status: 404 });
    }

    if (
      !auth.isAdmin &&
      !auth.operatorLeagueIds.includes(String(season.league_id))
    ) {
      return NextResponse.json({ error: "Forbidden for this league." }, { status: 403 });
    }

    const gameIds = Array.from(
      new Set(rows.map((r) => String(r.game_id ?? "").trim()).filter(Boolean))
    );

    if (gameIds.length > 0) {
      const { error: delError } = await supabase
        .from("league_game_participants")
        .delete()
        .eq("season_id", seasonId)
        .in("game_id", gameIds);
      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 });
      }
    }

    const insertRows = rows.map((r, idx) => ({
      season_id: seasonId,
      game_id: String(r.game_id ?? `upload-${idx}`).trim(),
      match_label: String(r.match_label ?? r.game_id ?? "Match").trim(),
      team_name: String(r.team_name ?? "").trim(),
      player_name: String(r.player_name ?? "").trim(),
      champion: String(r.champion ?? "").trim(),
      role: String(r.role ?? "mid").trim().toLowerCase(),
      side: String(r.side ?? "Blue").toLowerCase() === "red" ? "Red" : "Blue",
      win: Boolean(r.win),
      game_length: Number(r.game_length ?? 0),
      kills: Number(r.kills ?? 0),
      deaths: Number(r.deaths ?? 0),
      assists: Number(r.assists ?? 0),
      gold: Number(r.gold ?? 0),
      cs: Number(r.cs ?? 0),
      damage_dealt: Number(r.damage_dealt ?? 0),
      vision_score: Number(r.vision_score ?? 0),
      row_order: Number(r.row_order ?? idx + 1),
    }));

    const { error } = await supabase
      .from("league_game_participants")
      .insert(insertRows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag("public-stats");
    revalidateTag("home-stats");

    return NextResponse.json({
      ok: true,
      insertedCount: insertRows.length,
      gamesCount: gameIds.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to import match data",
      },
      { status: 500 }
    );
  }
}

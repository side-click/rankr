import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Scaffold callback endpoint for Riot Tournament-V5 post-game webhooks.
 * Once RIOT_TOURNAMENT_API_KEY + RIOT_TOURNAMENT_WEBHOOK_SECRET are configured,
 * Riot posts { gameId, shortCode, metaData } here when a tournament game ends,
 * triggering Match-V5 + Timeline ingestion into league_match_records and league_game_participants.
 */
export async function POST(req: Request) {
  const expectedSecret = process.env.RIOT_TOURNAMENT_WEBHOOK_SECRET?.trim();
  const url = new URL(req.url);
  const providedSecret =
    req.headers.get("x-rankr-webhook-secret") ||
    url.searchParams.get("secret") ||
    "";

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as {
      gameId?: number | string;
      shortCode?: string;
      metaData?: string;
    };

    const gameId = payload.gameId ? String(payload.gameId) : null;
    const shortCode = payload.shortCode ? String(payload.shortCode) : null;
    if (!gameId && !shortCode) {
      return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
    }

    const supabase = await createClient();
    if (shortCode) {
      await supabase
        .from("tournament_codes")
        .update({
          status: "completed",
          riot_game_id: gameId,
        })
        .eq("code", shortCode);
    }

    return NextResponse.json({ ok: true, receivedGameId: gameId });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}

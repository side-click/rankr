import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/utils/moderationServer";

function safeSecretEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Callback endpoint for Riot Tournament-V5 post-game webhooks.
 * Expects `x-rankr-webhook-secret` header (or `Authorization: Bearer <secret>`).
 */
export async function POST(req: Request) {
  const expectedSecret = process.env.RIOT_TOURNAMENT_WEBHOOK_SECRET?.trim();
  const bearerHeader = req.headers.get("authorization") ?? "";
  const bearerSecret = bearerHeader.toLowerCase().startsWith("bearer ")
    ? bearerHeader.slice(7).trim()
    : "";
  const providedSecret =
    req.headers.get("x-rankr-webhook-secret")?.trim() || bearerSecret;

  if (
    !expectedSecret ||
    !providedSecret ||
    !safeSecretEqual(providedSecret, expectedSecret)
  ) {
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
      return NextResponse.json(
        { error: "Invalid callback payload" },
        { status: 400 }
      );
    }

    const adminDb = getServiceRoleClient();
    if (!adminDb) {
      return NextResponse.json(
        { error: "Webhook service role not configured" },
        { status: 500 }
      );
    }

    if (shortCode) {
      const { error } = await adminDb
        .from("tournament_codes")
        .update({
          status: "completed",
          riot_game_id: gameId,
        })
        .eq("code", shortCode);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import {
  RiotRateLimitError,
  syncPlayerFromRiot,
  type SyncedPlayerInput,
} from "@/utils/riotApi";

export async function POST(request: Request) {
  const apiKey = process.env.RIOT_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "RIOT_API_KEY is not configured in environment variables." },
      { status: 500 }
    );
  }

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

  const body = (await request.json().catch(() => null)) as {
    players?: SyncedPlayerInput[];
    matchCount?: number;
  } | null;

  const players = Array.isArray(body?.players) ? body.players.slice(0, 5) : [];
  const matchCount = Math.min(Math.max(Number(body?.matchCount ?? 5), 1), 10);

  if (players.length === 0) {
    return NextResponse.json(
      { error: "No players provided in batch." },
      { status: 400 }
    );
  }

  const results = [];
  try {
    for (const player of players) {
      const synced = await syncPlayerFromRiot(player, apiKey, matchCount);
      if (synced.sync_error) {
        console.warn("[riot-sync] player_error", {
          riotId: synced.riot_id,
          error: synced.sync_error,
        });
      } else {
        console.info("[riot-sync] player_ok", {
          riotId: synced.riot_id,
          solo: synced.solo_tier
            ? `${synced.solo_tier} ${synced.solo_rank ?? ""} ${
                synced.solo_lp ?? 0
              }LP`
            : "Unranked",
          matches: synced.matches.length,
        });
      }
      results.push(synced);
    }
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      console.warn("[riot-sync] rate_limited", {
        retryAfterSeconds: err.retryAfterSeconds,
      });
      if (results.length > 0) {
        await supabase
          .from("riot_player_stats")
          .upsert(results, { onConflict: "player_key" });
      }
      return NextResponse.json(
        {
          error: err.message,
          retryAfterSeconds: err.retryAfterSeconds,
        },
        { status: 429 }
      );
    }
    throw err;
  }

  const { error: upsertErr } = await supabase
    .from("riot_player_stats")
    .upsert(results, { onConflict: "player_key" });

  if (upsertErr) {
    return NextResponse.json(
      {
        error: `Supabase cache error: ${upsertErr.message}`,
        needsMigration:
          upsertErr.message.includes("riot_player_stats") ||
          upsertErr.code === "42P01",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, results });
}

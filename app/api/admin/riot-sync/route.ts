import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
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
  for (const player of players) {
    const synced = await syncPlayerFromRiot(player, apiKey, matchCount);
    results.push(synced);
    // Small pacing delay to stay comfortably within Riot Personal API Key limits
    await new Promise((r) => setTimeout(r, 150));
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

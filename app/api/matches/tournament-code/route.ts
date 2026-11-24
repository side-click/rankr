import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { generateTournamentCodeForMatch } from "@/utils/riotTournamentApi";

export async function POST(req: Request) {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      matchId?: string;
      gameNumber?: number;
      regenerate?: boolean;
    };

    const matchId = String(body.matchId ?? "").trim();
    const gameNumber = Math.max(1, Math.min(7, Number(body.gameNumber ?? 1)));
    const regenerate = Boolean(body.regenerate);

    if (!matchId) {
      return NextResponse.json(
        { error: "matchId is required." },
        { status: 400 }
      );
    }

    const { data: match, error: matchErr } = await supabase
      .from("season_matches")
      .select(
        "id, season_id, round_label, team_a_id, team_b_id, seasons ( id, league_id )"
      )
      .eq("id", matchId)
      .maybeSingle();

    if (matchErr || !match) {
      return NextResponse.json(
        { error: matchErr?.message || "Match not found." },
        { status: 404 }
      );
    }

    const seasonObj = Array.isArray(match.seasons)
      ? match.seasons[0]
      : match.seasons;
    const leagueId = String(
      (seasonObj as { league_id?: string } | null)?.league_id ?? ""
    );

    const isLeagueOperator =
      auth.isAdmin ||
      (Boolean(leagueId) && auth.operatorLeagueIds.includes(leagueId));
    const isMatchCaptain =
      (match.team_a_id && auth.captainTeamIds.includes(match.team_a_id)) ||
      (match.team_b_id && auth.captainTeamIds.includes(match.team_b_id));

    if (!isLeagueOperator && !isMatchCaptain) {
      return NextResponse.json(
        { error: "Only site admins, league operators, or assigned team captains can generate tournament codes." },
        { status: 403 }
      );
    }

    if (!regenerate) {
      const { data: existing } = await supabase
        .from("tournament_codes")
        .select("*")
        .eq("match_id", matchId)
        .eq("game_number", gameNumber)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          codeRow: existing,
          isStub: existing.provider === "placeholder",
        });
      }
    } else if (!isLeagueOperator) {
      return NextResponse.json(
        { error: "Only operators or admins can regenerate an existing code." },
        { status: 403 }
      );
    }

    const [{ data: teamA }, { data: teamB }] = await Promise.all([
      match.team_a_id
        ? supabase.from("teams").select("name").eq("id", match.team_a_id).maybeSingle()
        : Promise.resolve({ data: null }),
      match.team_b_id
        ? supabase.from("teams").select("name").eq("id", match.team_b_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const generated = await generateTournamentCodeForMatch({
      matchId,
      gameNumber,
      seasonId: String(match.season_id),
      roundLabel: String(match.round_label || "Match"),
      teamAName: teamA?.name || "Blue",
      teamBName: teamB?.name || "Red",
    });

    if (regenerate) {
      await supabase
        .from("tournament_codes")
        .delete()
        .eq("match_id", matchId)
        .eq("game_number", gameNumber);
    }

    const { data: inserted, error: insErr } = await supabase
      .from("tournament_codes")
      .insert({
        match_id: matchId,
        game_number: gameNumber,
        code: generated.code,
        provider: generated.provider,
        riot_tournament_id: generated.riotTournamentId,
        status: "generated",
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      codeRow: inserted,
      isStub: inserted.provider === "placeholder",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate tournament code",
      },
      { status: 500 }
    );
  }
}

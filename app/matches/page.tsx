import type { Metadata } from "next";
import { Swords } from "lucide-react";
import {
  TeamMatchHub,
  type MatchHubPlayerKeyMap,
  type MatchHubTeamStatInfo,
} from "@/components/matches/TeamMatchHub";
import { RetroWindow } from "@/components/RetroWindow";
import { SignInRequiredWindow } from "@/components/SignInRequiredWindow";
import type {
  Division,
  Season,
  SeasonMatch,
  Team,
  TournamentCode,
} from "@/types/database";
import { fetchScdlSheetStats } from "@/utils/leagueStats";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { createClient } from "@/utils/supabase/server";
import {
  getCaptainTeamIds,
  getServerAuthContext,
} from "@/utils/supabase/serverAuth";

export const metadata: Metadata = {
  title: "Team Match Hub | Rankr",
};

export const dynamic = "force-dynamic";

export default async function MatchesHubPage() {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);

  if (!auth.user) {
    return (
      <SignInRequiredWindow
        title="Team Match Hub — Sign In Required"
        message="Sign in with Discord to access your team schedule, opponent scouting, and tournament codes."
      />
    );
  }

  const captainTeamIds = await getCaptainTeamIds(supabase, auth.discordId);
  const hasMatchHubAccess =
    auth.isAdmin || auth.isOperator || captainTeamIds.length > 0;

  if (!hasMatchHubAccess) {
    return (
      <RetroWindow title="Team Match Hub — Restricted" theme="scdl">
        <div className="py-8 px-4 text-center space-y-2.5">
          <Swords className="w-9 h-9 mx-auto text-[#c89b3c]" />
          <h1 className="text-base font-bold text-[#f0ede0]">
            Captain or Operator Assignment Required
          </h1>
          <p className="text-xs text-[#a6a89e] max-w-md mx-auto">
            Ask a league operator to link your Discord ID to your team in Admin Console → Teams.
          </p>
        </div>
      </RetroWindow>
    );
  }

  const [{ data: seasons }, { data: divisions }, { data: teams }, matchesRes, codesRes] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("*, leagues ( id, name, short_name, slug )")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("divisions").select("*").order("name"),
      supabase
        .from("teams")
        .select("*")
        .eq("is_active", true)
        .order("default_order", { ascending: true }),
      supabase
        .from("season_matches")
        .select("*")
        .order("round_number", { ascending: true }),
      supabase.from("tournament_codes").select("*"),
    ]);

  const seasonList = (seasons ?? []) as Season[];
  const divisionList = (divisions ?? []) as Division[];
  const teamList = (teams ?? []) as Team[];
  const matchList = !matchesRes.error
    ? ((matchesRes.data ?? []) as SeasonMatch[])
    : [];
  const codeList = !codesRes.error
    ? ((codesRes.data ?? []) as TournamentCode[])
    : [];

  const divById = new Map(divisionList.map((d) => [d.id, d]));
  const seasonById = new Map(seasonList.map((s) => [s.id, s]));
  const opLeagueSet = new Set(auth.operatorLeagueIds);
  const captainTeamSet = new Set(captainTeamIds);

  const accessibleTeamIds = teamList
    .filter((t) => {
      if (auth.isAdmin) return true;
      if (captainTeamSet.has(t.id)) return true;
      const div = divById.get(t.division_id);
      const season = div ? seasonById.get(div.season_id) : null;
      return Boolean(season && opLeagueSet.has(season.league_id));
    })
    .map((t) => t.id);

  // Load stats for the primary accessible team's season so Match Hub displays accurate W-L and seeds
  const firstAccessibleTeam = teamList.find((t) =>
    accessibleTeamIds.includes(t.id)
  );
  const firstAccessibleSeasonSlug = firstAccessibleTeam
    ? seasonById.get(
        divById.get(firstAccessibleTeam.division_id)?.season_id ?? ""
      )?.slug
    : seasonList.find((s) => s.is_active)?.slug ?? seasonList[0]?.slug;

  const statsCtx = await loadPublicStatsContext(firstAccessibleSeasonSlug, {
    includeRiotStats: false,
  }).catch(() => null);

  const teamStatsMap: Record<string, MatchHubTeamStatInfo> = {};
  const playerKeyByName: MatchHubPlayerKeyMap = {};

  if (statsCtx) {
    const sheetSummary = await fetchScdlSheetStats(
      statsCtx.players,
      statsCtx.teams,
      statsCtx.sheetConfig
    ).catch(() => null);

    const effectiveTeams = sheetSummary?.teams ?? statsCtx.teams;
    const effectivePlayers = sheetSummary?.players ?? statsCtx.players;

    for (const t of effectiveTeams) {
      teamStatsMap[t.teamId] = {
        teamId: t.teamId,
        wins: t.seriesWins ?? t.wins,
        losses: t.seriesLosses ?? Math.max(0, t.games - t.wins),
        seed: t.seed ?? null,
      };
    }

    for (const p of effectivePlayers) {
      const full = p.riotId.trim().toLowerCase();
      const short = full.split("#")[0].trim();
      if (full) playerKeyByName[full] = p.playerKey;
      if (short) playerKeyByName[short] = p.playerKey;
    }
  }

  return (
    <TeamMatchHub
      seasons={seasonList}
      divisions={divisionList}
      teams={teamList}
      accessibleTeamIds={accessibleTeamIds}
      matches={matchList}
      initialCodes={codeList}
      teamStatsMap={teamStatsMap}
      playerKeyByName={playerKeyByName}
    />
  );
}

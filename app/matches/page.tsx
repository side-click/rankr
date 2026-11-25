import type { Metadata } from "next";
import {
  TeamMatchHub,
  type MatchHubPlayerKeyMap,
  type MatchHubTeamStatInfo,
} from "@/components/matches/TeamMatchHub";
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

  const captainTeamIds = auth.user
    ? await getCaptainTeamIds(supabase, auth.discordId, auth)
    : [];

  const [{ data: seasons }, { data: divisions }, { data: teams }, matchesRes] =
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
    ]);

  const seasonList = (seasons ?? []) as Season[];
  const divisionList = (divisions ?? []) as Division[];
  const teamList = (teams ?? []) as Team[];
  const matchList = !matchesRes.error
    ? ((matchesRes.data ?? []) as SeasonMatch[])
    : [];

  const divById = new Map(divisionList.map((d) => [d.id, d]));
  const seasonById = new Map(seasonList.map((s) => [s.id, s]));
  const opLeagueSet = new Set(auth.operatorLeagueIds);
  const captainTeamSet = new Set(captainTeamIds);

  const codeAccessTeamIds = auth.user
    ? teamList
        .filter((t) => {
          if (auth.isAdmin) return true;
          if (captainTeamSet.has(t.id)) return true;
          const div = divById.get(t.division_id);
          const season = div ? seasonById.get(div.season_id) : null;
          return Boolean(season && opLeagueSet.has(season.league_id));
        })
        .map((t) => t.id)
    : [];
  const codeAccessTeamSet = new Set(codeAccessTeamIds);

  let codeList: TournamentCode[] = [];
  if (codeAccessTeamIds.length > 0) {
    const codesRes = await supabase.from("tournament_codes").select("*");
    if (!codesRes.error && Array.isArray(codesRes.data)) {
      const matchById = new Map(matchList.map((m) => [m.id, m]));
      codeList = (codesRes.data as TournamentCode[]).filter((c) => {
        if (auth.isAdmin) return true;
        const match = matchById.get(c.match_id);
        if (!match) return false;
        return Boolean(
          (match.team_a_id && codeAccessTeamSet.has(match.team_a_id)) ||
            (match.team_b_id && codeAccessTeamSet.has(match.team_b_id))
        );
      });
    }
  }

  const accessibleTeamIds = teamList.map((t) => t.id);
  const defaultTeam =
    teamList.find((t) => captainTeamSet.has(t.id)) ??
    teamList.find((t) => codeAccessTeamSet.has(t.id)) ??
    teamList[0];
  const defaultTeamId = defaultTeam?.id ?? "";

  // Load stats for the primary default team's season so Match Hub displays accurate W-L and seeds
  const defaultSeasonSlug = defaultTeam
    ? seasonById.get(divById.get(defaultTeam.division_id)?.season_id ?? "")
        ?.slug
    : seasonList.find((s) => s.is_active)?.slug ?? seasonList[0]?.slug;

  const statsCtx = await loadPublicStatsContext(defaultSeasonSlug, {
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
      codeAccessTeamIds={codeAccessTeamIds}
      defaultTeamId={defaultTeamId}
      matches={matchList}
      initialCodes={codeList}
      teamStatsMap={teamStatsMap}
      playerKeyByName={playerKeyByName}
    />
  );
}

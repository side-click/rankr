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
  title: "Team Hub | Rankr",
};

export const dynamic = "force-dynamic";

export default async function TeamHubPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; team?: string }>;
}) {
  const [params, auth, supabase] = await Promise.all([
    searchParams,
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

  const requestedSeasonParam = params.season?.trim() ?? "";
  const captainDefaultTeam = teamList.find((t) => captainTeamSet.has(t.id));
  const captainSeason = captainDefaultTeam
    ? seasonById.get(divById.get(captainDefaultTeam.division_id)?.season_id ?? "")
    : undefined;

  const selectedSeason =
    (requestedSeasonParam
      ? seasonList.find(
          (s) => s.slug === requestedSeasonParam || s.id === requestedSeasonParam
        )
      : undefined) ??
    captainSeason ??
    seasonList.find(
      (s) => s.is_active && matchList.some((m) => m.season_id === s.id)
    ) ??
    seasonList.find(
      (s) =>
        s.is_active &&
        Boolean((s as { stats_sheet_id?: string | null }).stats_sheet_id)
    ) ??
    seasonList.find((s) => s.is_active) ??
    seasonList[0];

  const seasonDivisions = selectedSeason
    ? divisionList.filter((d) => d.season_id === selectedSeason.id)
    : [];
  const seasonDivIds = new Set(seasonDivisions.map((d) => d.id));
  const seasonTeams = teamList.filter((t) => seasonDivIds.has(t.division_id));
  const seasonMatches = selectedSeason
    ? matchList.filter((m) => m.season_id === selectedSeason.id)
    : [];

  const codeAccessTeamIds = auth.user
    ? seasonTeams
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
  if (codeAccessTeamIds.length > 0 && seasonMatches.length > 0) {
    const codesRes = await supabase
      .from("tournament_codes")
      .select("*")
      .in(
        "match_id",
        seasonMatches.map((m) => m.id)
      );
    if (!codesRes.error && Array.isArray(codesRes.data)) {
      const matchById = new Map(seasonMatches.map((m) => [m.id, m]));
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

  const accessibleTeamIds = seasonTeams.map((t) => t.id);
  const requestedTeamId = params.team?.trim() ?? "";
  const defaultTeam =
    (requestedTeamId
      ? seasonTeams.find((t) => t.id === requestedTeamId)
      : undefined) ??
    seasonTeams.find((t) => captainTeamSet.has(t.id)) ??
    seasonTeams.find((t) => codeAccessTeamSet.has(t.id)) ??
    seasonTeams[0];
  const defaultTeamId = defaultTeam?.id ?? "";

  const statsCtx = await loadPublicStatsContext(selectedSeason?.slug, {
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
      selectedSeasonSlug={selectedSeason?.slug ?? ""}
      divisions={seasonDivisions}
      teams={seasonTeams}
      accessibleTeamIds={accessibleTeamIds}
      codeAccessTeamIds={codeAccessTeamIds}
      defaultTeamId={defaultTeamId}
      matches={seasonMatches}
      initialCodes={codeList}
      teamStatsMap={teamStatsMap}
      playerKeyByName={playerKeyByName}
    />
  );
}

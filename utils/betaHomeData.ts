import { createClient } from "@/utils/supabase/server";
import type { BallotCardData } from "@/components/BallotCard";
import { loadConsensusPageData } from "@/utils/consensusData";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { computeRoleNormalizedRatings } from "@/utils/riotStatsAggregation";
import {
  fetchAllScdlSeries,
  fetchScdlSheetStats,
} from "@/utils/scdlSheetStats";
import { resolveDivisionTheme } from "@/utils/themes";

export interface BetaSeasonSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  leagueName: string;
  leagueShortName: string;
  leagueLogoUrl: string | null;
  playerCount: number;
  divisions: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    themeKey: string;
    primaryColor: string;
    teamCount: number;
  }[];
}

export interface BetaStandingRow {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  seed: number | null;
  seriesWins: number;
  seriesLosses: number;
  gamesWins: number;
  gamesLosses: number;
}

export interface BetaDivisionStandings {
  divisionId: string;
  divisionName: string;
  divisionSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  teams: BetaStandingRow[];
}

export interface BetaTopPerformer {
  playerKey: string;
  displayName: string;
  role: string;
  teamName: string;
  teamLogoUrl: string | null;
  rating: number;
  games: number;
  kda: number;
  dpm: number;
}

export interface BetaDivisionTopPerformers {
  divisionId: string;
  divisionName: string;
  divisionSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  players: BetaTopPerformer[];
}

export interface BetaRecentMatch {
  seriesKey: string;
  roundLabel: string;
  teamA: string;
  teamALogoUrl: string | null;
  teamAWins: number;
  teamB: string;
  teamBLogoUrl: string | null;
  teamBWins: number;
  divisionName: string | null;
  divisionColor: string;
}

export interface BetaConsensusSnapshot {
  seasonSlug: string;
  seasonName: string;
  divisionName: string;
  divisionSlug: string;
  divisionLogoUrl: string | null;
  primaryColor: string;
  editionName: string;
  submissionCount: number;
  topTeams: {
    rank: number;
    teamName: string;
    teamLogoUrl: string | null;
    averageRank: number;
  }[];
}

export interface BetaHomeData {
  allSeasons: BetaSeasonSummary[];
  liveSeasons: BetaSeasonSummary[];
  archivedSeasons: BetaSeasonSummary[];
  focusedSeason: BetaSeasonSummary | null;
  recentBallots: BallotCardData[];
  divisionStandings: BetaDivisionStandings[];
  divisionTopPerformers: BetaDivisionTopPerformers[];
  topPerformers: BetaTopPerformer[];
  recentMatches: BetaRecentMatch[];
  consensusSnapshots: BetaConsensusSnapshot[];
}

function unwrap<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export async function loadBetaHomeData(
  focusedSeasonSlug?: string
): Promise<BetaHomeData> {
  const supabase = await createClient();

  const [
    { data: seasonsRaw },
    { data: divisionsRaw },
    { data: divisionThemesRaw },
    { data: activeTeamsRaw },
    { data: seasonPlayersRaw },
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, slug, is_active, created_at, leagues ( * )")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("divisions")
      .select("id, season_id, name, slug, logo_url, theme_key")
      .order("name"),
    supabase.from("division_themes").select("*").order("name"),
    supabase.from("teams").select("id, division_id").eq("is_active", true),
    supabase
      .from("season_players")
      .select("id, season_id")
      .eq("is_active", true),
  ]);

  const allSeasons: BetaSeasonSummary[] = (seasonsRaw ?? []).map((s) => {
    const league = unwrap(
      s.leagues as unknown as
        | { name?: string; short_name?: string; logo_url?: string | null }
        | { name?: string; short_name?: string; logo_url?: string | null }[]
        | null
    );
    const seasonDivs = (divisionsRaw ?? [])
      .filter((d) => d.season_id === s.id)
      .map((d) => {
        const theme = resolveDivisionTheme(d.theme_key, divisionThemesRaw);
        const teamCount = (activeTeamsRaw ?? []).filter(
          (t) => t.division_id === d.id
        ).length;
        return {
          id: d.id,
          name: d.name,
          slug: d.slug,
          logoUrl: d.logo_url,
          themeKey: d.theme_key,
          primaryColor: theme.primary_color,
          teamCount,
        };
      });
    const playerCount = (seasonPlayersRaw ?? []).filter(
      (p) => p.season_id === s.id
    ).length;

    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      isActive: Boolean(s.is_active),
      leagueName: league?.name ?? "League",
      leagueShortName: league?.short_name ?? league?.name ?? "League",
      leagueLogoUrl: league?.logo_url ?? null,
      playerCount,
      divisions: seasonDivs,
    };
  });

  const liveSeasons = allSeasons.filter((s) => s.isActive);
  const archivedSeasons = allSeasons.filter((s) => !s.isActive);

  const focusedSeason = focusedSeasonSlug
    ? allSeasons.find((s) => s.slug === focusedSeasonSlug) ?? null
    : liveSeasons.length === 1
    ? liveSeasons[0]
    : null;

  const targetSeasons = focusedSeason
    ? [focusedSeason]
    : liveSeasons.length > 0
    ? liveSeasons
    : allSeasons.slice(0, 1);
  const targetSeasonIds = targetSeasons.map((s) => s.id);

  // Query recent published ballots scoped to targetSeasons
  let ballotsQuery = supabase
    .from("ballots")
    .select(
      `
      id,
      title,
      ranking_type,
      tier_variant,
      tier_data,
      published_at,
      season_id,
      division_id,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      division_logo_snapshot,
      edition_name_snapshot,
      profiles ( username, avatar_url ),
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, theme_key, logo_url ),
      editions ( name ),
      ballot_entries ( rank, team_name_snapshot, teams ( name, logo_url ) )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(6);

  if (targetSeasonIds.length > 0) {
    ballotsQuery = ballotsQuery.in("season_id", targetSeasonIds);
  }

  // Fetch consensus snapshots + stats in parallel
  const consensusPromises = targetSeasons.flatMap((s) =>
    s.divisions.map((d) =>
      loadConsensusPageData({ season: s.slug, division: d.slug })
        .then((res) => ({
          seasonSlug: s.slug,
          seasonName: s.name,
          divisionName: d.name,
          divisionSlug: d.slug,
          divisionLogoUrl: d.logoUrl,
          primaryColor: d.primaryColor,
          editionName: res.editionName,
          submissionCount: res.submissionCount,
          topTeams: res.rows.slice(0, 3).map((r) => ({
            rank: r.consensusRank,
            teamName: r.teamName,
            teamLogoUrl: r.logoUrl,
            averageRank: r.averageRank,
          })),
        }))
        .catch(() => null)
    )
  );

  const statsSeasonSlug =
    focusedSeason?.slug ?? liveSeasons[0]?.slug ?? allSeasons[0]?.slug;

  const [{ data: recentBallotsRaw }, consensusRaw, statsCtx, allSeries] =
    await Promise.all([
      ballotsQuery,
      Promise.all(consensusPromises),
      loadPublicStatsContext(statsSeasonSlug, {
        includeRiotStats: false,
      }).catch(() => null),
      fetchAllScdlSeries().catch(() => []),
    ]);

  let divisionStandings: BetaDivisionStandings[] = [];
  let divisionTopPerformers: BetaDivisionTopPerformers[] = [];
  let topPerformers: BetaTopPerformer[] = [];
  let recentMatches: BetaRecentMatch[] = [];

  if (statsCtx && statsCtx.teams.length > 0) {
    const sheetSummary = await fetchScdlSheetStats(
      statsCtx.players,
      statsCtx.teams,
      statsCtx.sheetConfig
    ).catch(() => null);

    const activeTeams = sheetSummary?.teams ?? statsCtx.teams;
    const rawPlayers = sheetSummary?.players ?? statsCtx.players;
    const ratedPlayers = computeRoleNormalizedRatings(rawPlayers);

    const teamLogoByName = new Map(
      activeTeams.map((t) => [t.teamName.toLowerCase(), t.logoUrl])
    );
    const teamDivByName = new Map(
      activeTeams.map((t) => [t.teamName.toLowerCase(), t.divisionId])
    );

    divisionStandings = statsCtx.divisions.map((d) => {
      const divTheme = resolveDivisionTheme(d.theme_key, divisionThemesRaw);
      const divTeams = activeTeams
        .filter((t) => t.divisionId === d.id)
        .sort((a, b) => {
          const sa = a.seed ?? 999;
          const sb = b.seed ?? 999;
          if (sa !== sb) return sa - sb;
          return (b.seriesWins ?? b.wins) - (a.seriesWins ?? a.wins);
        })
        .slice(0, 4)
        .map((t) => ({
          teamId: t.teamId,
          teamName: t.teamName,
          logoUrl: t.logoUrl,
          seed: t.seed ?? null,
          seriesWins: t.seriesWins ?? t.wins,
          seriesLosses: t.seriesLosses ?? Math.max(0, t.games - t.wins),
          gamesWins: t.wins,
          gamesLosses: Math.max(0, t.games - t.wins),
        }));

      return {
        divisionId: d.id,
        divisionName: d.name,
        divisionSlug: d.slug,
        logoUrl: d.logo_url,
        primaryColor: divTheme.primary_color,
        teams: divTeams,
      };
    });

    divisionTopPerformers = statsCtx.divisions.map((d) => {
      const divTheme = resolveDivisionTheme(d.theme_key, divisionThemesRaw);
      const divRated = computeRoleNormalizedRatings(
        rawPlayers.filter((p) => p.divisionId === d.id)
      );
      const topDivPlayers = divRated
        .filter((p) => p.games > 0)
        .sort((a, b) => (b.leagueRating ?? 0) - (a.leagueRating ?? 0))
        .slice(0, 4)
        .map((p) => ({
          playerKey: p.playerKey,
          displayName: p.displayName,
          role: p.role,
          teamName: p.teamName,
          teamLogoUrl: p.teamLogoUrl,
          rating: p.leagueRating ?? 0,
          games: p.games,
          kda: p.kda,
          dpm: p.dpm,
        }));

      return {
        divisionId: d.id,
        divisionName: d.name,
        divisionSlug: d.slug,
        logoUrl: d.logo_url,
        primaryColor: divTheme.primary_color,
        players: topDivPlayers,
      };
    });

    topPerformers = ratedPlayers
      .filter((p) => p.games > 0)
      .sort((a, b) => (b.leagueRating ?? 0) - (a.leagueRating ?? 0))
      .slice(0, 5)
      .map((p) => ({
        playerKey: p.playerKey,
        displayName: p.displayName,
        role: p.role,
        teamName: p.teamName,
        teamLogoUrl: p.teamLogoUrl,
        rating: p.leagueRating ?? 0,
        games: p.games,
        kda: p.kda,
        dpm: p.dpm,
      }));

    recentMatches = [...allSeries]
      .reverse()
      .slice(0, 4)
      .map((s) => {
        const divId =
          teamDivByName.get(s.teamA.toLowerCase()) ??
          teamDivByName.get(s.teamB.toLowerCase());
        const div = statsCtx.divisions.find((d) => d.id === divId);
        const theme = resolveDivisionTheme(div?.theme_key, divisionThemesRaw);
        return {
          seriesKey: s.seriesKey,
          roundLabel: s.roundLabel,
          teamA: s.teamA,
          teamALogoUrl: teamLogoByName.get(s.teamA.toLowerCase()) ?? null,
          teamAWins: s.teamAWins,
          teamB: s.teamB,
          teamBLogoUrl: teamLogoByName.get(s.teamB.toLowerCase()) ?? null,
          teamBWins: s.teamBWins,
          divisionName: div?.name ?? null,
          divisionColor: theme.primary_color,
        };
      });
  }

  return {
    allSeasons,
    liveSeasons,
    archivedSeasons,
    focusedSeason,
    recentBallots: (recentBallotsRaw ?? []) as unknown as BallotCardData[],
    divisionStandings,
    divisionTopPerformers,
    topPerformers,
    recentMatches,
    consensusSnapshots: consensusRaw.filter(
      (c): c is BetaConsensusSnapshot => c !== null && c.submissionCount > 0
    ),
  };
}

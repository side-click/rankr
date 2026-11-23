import { unstable_cache } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ContentCardData } from "@/components/ContentCard";
import {
  RECENT_BLOG_SELECT,
  RECENT_CONTENT_PAGE_SIZE,
  RECENT_CONTENT_SELECT,
} from "@/utils/recentContentQuery";
import type { BlogCardData } from "@/components/BlogCard";
import type { ContentItem } from "@/components/ContentListGrid";
import {
  computeAverageTeamRankings,
  type ConsensusRankingInput,
} from "@/utils/averageRankings";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { computeRoleNormalizedRatings } from "@/utils/riotStatsAggregation";
import {
  fetchAllScdlSeries,
  fetchScdlSheetStats,
} from "@/utils/scdlSheetStats";
import { resolveDivisionTheme } from "@/utils/themes";

export interface HomeSeasonSummary {
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

export interface HomeStandingRow {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  seed: number | null;
  seriesWins: number;
  seriesLosses: number;
  gamesWins: number;
  gamesLosses: number;
}

export interface HomeDivisionStandings {
  divisionId: string;
  divisionName: string;
  divisionSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  teams: HomeStandingRow[];
}

export interface HomeTopPerformer {
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

export interface HomeDivisionTopPerformers {
  divisionId: string;
  divisionName: string;
  divisionSlug: string;
  logoUrl: string | null;
  primaryColor: string;
  players: HomeTopPerformer[];
}

export interface HomeRecentMatch {
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

export interface HomeConsensusSnapshot {
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
    teamId: string | null;
    teamLogoUrl: string | null;
    averageRank: number;
  }[];
}

export interface HomeData {
  allSeasons: HomeSeasonSummary[];
  liveSeasons: HomeSeasonSummary[];
  archivedSeasons: HomeSeasonSummary[];
  focusedSeason: HomeSeasonSummary | null;
  recentBallots: ContentCardData[];
  recentContent: ContentItem[];
  recentSeasonIds: string[];
  divisionStandings: HomeDivisionStandings[];
  divisionTopPerformers: HomeDivisionTopPerformers[];
  topPerformers: HomeTopPerformer[];
  recentMatches: HomeRecentMatch[];
  consensusSnapshots: HomeConsensusSnapshot[];
}

function unwrap<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

const loadCachedHomeStatsBlock = unstable_cache(
  async (statsSeasonSlug: string | undefined) => {
    const statsCtx = await loadPublicStatsContext(statsSeasonSlug, {
      includeRiotStats: false,
    }).catch(() => null);

    let divisionStandings: HomeDivisionStandings[] = [];
    let divisionTopPerformers: HomeDivisionTopPerformers[] = [];
    let topPerformers: HomeTopPerformer[] = [];
    let recentMatches: HomeRecentMatch[] = [];

    if (statsCtx && statsCtx.teams.length > 0) {
      const [sheetSummary, allSeries] = await Promise.all([
        fetchScdlSheetStats(
          statsCtx.players,
          statsCtx.teams,
          statsCtx.sheetConfig
        ).catch(() => null),
        fetchAllScdlSeries(statsCtx.sheetConfig).catch(() => []),
      ]);

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
        const divTheme = resolveDivisionTheme(d.theme_key);
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
        const divTheme = resolveDivisionTheme(d.theme_key);
        const divRated = computeRoleNormalizedRatings(
          rawPlayers.filter((p) => p.divisionId === d.id)
        );
        const topDivPlayers = divRated
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
          const theme = resolveDivisionTheme(div?.theme_key);
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
      divisionStandings,
      divisionTopPerformers,
      topPerformers,
      recentMatches,
    };
  },
  ["home-stats-block"],
  { revalidate: 3600, tags: ["public-stats", "home-stats"] }
);

export async function loadHomeData(
  focusedSeasonSlug?: string
): Promise<HomeData> {
  const supabase = await createClient();

  const [
    { data: seasonsRaw },
    { data: divisionsRaw },
    { data: divisionThemesRaw },
    { data: activeTeamsRaw },
    { data: seasonPlayersRaw },
    { data: editionsRaw },
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
    supabase
      .from("editions")
      .select(
        "id, season_id, name, slug, is_open, is_archived, sort_order, created_at"
      )
      .order("sort_order", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const allSeasons: HomeSeasonSummary[] = (seasonsRaw ?? []).map((s) => {
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
    .from("rankings")
    .select(RECENT_CONTENT_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(RECENT_CONTENT_PAGE_SIZE);

  if (targetSeasonIds.length > 0) {
    ballotsQuery = ballotsQuery.in("season_id", targetSeasonIds);
  }

  let blogsQuery = supabase
    .from("blogs")
    .select(RECENT_BLOG_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(RECENT_CONTENT_PAGE_SIZE);

  if (targetSeasonIds.length > 0) {
    blogsQuery = blogsQuery.or(
      `season_id.in.(${targetSeasonIds.join(",")}),season_id.is.null`
    );
  }

  // Fetch all published team rankings for targetSeasons in ONE single live query
  // (instead of calling loadConsensusPageData per division, which re-queried seasons/divisions/themes/editions 2x)
  let consensusRankingsQuery = supabase
    .from("rankings")
    .select(
      `
      id,
      season_id,
      division_id,
      edition_id,
      profiles ( username, avatar_url ),
      ranking_entries (
        rank,
        team_id,
        team_name_snapshot,
        teams ( id, name, logo_url )
      )
    `
    )
    .eq("status", "published")
    .eq("ranking_type", "team")
    .order("published_at", { ascending: false });

  if (targetSeasonIds.length > 0) {
    consensusRankingsQuery = consensusRankingsQuery.in(
      "season_id",
      targetSeasonIds
    );
  }

  const statsSeasonSlug =
    focusedSeason?.slug ?? liveSeasons[0]?.slug ?? allSeasons[0]?.slug;

  const [
    { data: recentBallotsRaw },
    { data: recentBlogsRaw },
    { data: consensusRankingsRaw },
    {
      divisionStandings,
      divisionTopPerformers,
      topPerformers,
      recentMatches,
    },
  ] = await Promise.all([
    ballotsQuery,
    blogsQuery,
    consensusRankingsQuery,
    loadCachedHomeStatsBlock(statsSeasonSlug),
  ]);

  type ConsensusRowWithScope = ConsensusRankingInput & {
    season_id: string | null;
    division_id: string | null;
    edition_id: string | null;
  };
  const allConsensusRankings = (consensusRankingsRaw ??
    []) as unknown as ConsensusRowWithScope[];

  const consensusSnapshots: HomeConsensusSnapshot[] = [];
  for (const s of targetSeasons) {
    const seasonEditionsDesc = (editionsRaw ?? []).filter(
      (ed) => ed.season_id === s.id
    );
    const latestOpenEdition =
      seasonEditionsDesc.find((ed) => ed.is_open && !ed.is_archived) ?? null;

    for (const d of s.divisions) {
      const divRankings = allConsensusRankings.filter(
        (r) => r.season_id === s.id && r.division_id === d.id
      );
      const countByEdition = new Map<string, number>();
      for (const r of divRankings) {
        if (r.edition_id) {
          countByEdition.set(
            r.edition_id,
            (countByEdition.get(r.edition_id) ?? 0) + 1
          );
        }
      }
      const mostRecentWithMin2 =
        seasonEditionsDesc.find(
          (ed) => (countByEdition.get(ed.id) ?? 0) >= 2
        ) ?? null;
      const selectedEdition =
        mostRecentWithMin2 ??
        latestOpenEdition ??
        seasonEditionsDesc.find((ed) => !ed.is_archived) ??
        seasonEditionsDesc[0] ??
        null;

      if (!selectedEdition) continue;

      const editionRankings = divRankings.filter(
        (r) => r.edition_id === selectedEdition.id
      );
      if (editionRankings.length === 0) continue;

      const avgRows = computeAverageTeamRankings(editionRankings);
      if (avgRows.length === 0) continue;

      consensusSnapshots.push({
        seasonSlug: s.slug,
        seasonName: s.name,
        divisionName: d.name,
        divisionSlug: d.slug,
        divisionLogoUrl: d.logoUrl,
        primaryColor: d.primaryColor,
        editionName: selectedEdition.name,
        submissionCount: editionRankings.length,
        topTeams: avgRows.slice(0, 3).map((r) => ({
          rank: r.consensusRank,
          teamName: r.teamName,
          teamId: r.teamKey.startsWith("name:") ? null : r.teamKey,
          teamLogoUrl: r.logoUrl,
          averageRank: r.averageRank,
        })),
      });
    }
  }

  const recentBallots = (recentBallotsRaw ?? []) as unknown as ContentCardData[];
  const recentBlogs = (recentBlogsRaw ?? []) as unknown as BlogCardData[];
  const recentContent: ContentItem[] = [
    ...recentBallots.map((b) => ({
      kind: "ballot" as const,
      id: b.id,
      publishedAt: b.published_at,
      data: b,
    })),
    ...recentBlogs.map((b) => ({
      kind: "blog" as const,
      id: b.id,
      publishedAt: b.published_at,
      data: b,
    })),
  ]
    .sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, RECENT_CONTENT_PAGE_SIZE);

  return {
    allSeasons,
    liveSeasons,
    archivedSeasons,
    focusedSeason,
    recentBallots,
    recentContent,
    recentSeasonIds: targetSeasonIds,
    divisionStandings,
    divisionTopPerformers,
    topPerformers,
    recentMatches,
    consensusSnapshots,
  };
}

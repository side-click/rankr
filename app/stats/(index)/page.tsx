import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { StatsDashboard } from "@/components/StatsDashboard";
import {
  loadPublicSoloPrioMap,
  loadPublicStatsContext,
} from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/leagueStats";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";
import {
  computeRoleNormalizedRatings,
  filterPlayersByStage,
} from "@/utils/riotStatsAggregation";
import { compactSheetSummaryForDashboard } from "@/utils/statsOverview";
import { LEAGUE_ROLES } from "@/utils/roles";

export const dynamic = "force-dynamic";

const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
const statsTitle = "Stats Dashboard | Rankr";
const statsDescription =
  "Player leaderboards, team standings, champion stats, and scouting data.";
const statsOgUrl = `/stats/opengraph-image?v=${deploySha}`;

export const metadata: Metadata = {
  title: statsTitle,
  description: statsDescription,
  openGraph: {
    type: "website",
    siteName: "Rankr",
    title: statsTitle,
    description: statsDescription,
    images: [
      {
        url: statsOgUrl,
        width: 1200,
        height: 630,
        alt: statsTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: statsTitle,
    description: statsDescription,
    images: [statsOgUrl],
  },
};

const loadCachedPublicStatsDashboard = unstable_cache(
  async (effectiveSeasonKey: string) => {
    const ctx = await loadPublicStatsContext(effectiveSeasonKey || undefined, {
      includeRiotStats: false,
    });
    const sheetSummary = await fetchScdlSheetStats(
      ctx.players,
      ctx.teams,
      ctx.sheetConfig
    ).catch(() => null);

    const allProCandidatesMap = new Map<
      string,
      { playerKey: string; role: string }
    >();
    if (sheetSummary && sheetSummary.matchCount > 0) {
      const scopes = ["all", ...ctx.divisions.map((d) => d.id)];
      for (const scope of scopes) {
        const scoped = sheetSummary.players.filter((p) =>
          scope === "all" ? true : p.divisionId === scope
        );
        for (const stage of ["regular", "playoffs"] as const) {
          const rated = computeRoleNormalizedRatings(
            filterPlayersByStage(scoped, stage)
          ).filter((p) => p.games > 0);
          for (const roleDef of LEAGUE_ROLES) {
            const top = rated
              .filter((p) => p.role === roleDef.key)
              .sort((a, b) => b.leagueRating - a.leagueRating)[0];
            if (top) {
              allProCandidatesMap.set(top.playerKey, {
                playerKey: top.playerKey,
                role: top.role,
              });
            }
          }
        }
      }
    }

    const soloPrioMap =
      allProCandidatesMap.size > 0
        ? await loadPublicSoloPrioMap([...allProCandidatesMap.values()]).catch(
            () => undefined
          )
        : undefined;

    return {
      ddVersion: ctx.ddVersion,
      leagueName: ctx.leagueName,
      leagueLogoUrl: ctx.leagueLogoUrl,
      seasonName: ctx.seasonName,
      seasonId: ctx.seasonId,
      seasonSlug: ctx.seasonSlug,
      allSeasons: ctx.allSeasons,
      currentEditionName: ctx.currentEditionName,
      divisions: ctx.divisions,
      players: sheetSummary ? [] : ctx.players,
      teams: sheetSummary ? [] : ctx.teams,
      soloPrioMap,
      statsNotice: ctx.statsNotice,
      divisionThemes: ctx.divisionThemes,
      seasonStructure: ctx.seasonStructure,
      playoffBrackets: ctx.playoffBrackets,
      statsRoundLabel: ctx.statsRoundLabel,
      initialSheetData: sheetSummary
        ? compactSheetSummaryForDashboard(sheetSummary, ctx.divisions)
        : null,
    };
  },
  ["public-stats-dashboard-v1"],
  { revalidate: 3600, tags: ["public-stats"] }
);

export default async function PublicStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; division?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab =
    params.tab === "players" ||
    params.tab === "teams" ||
    params.tab === "division"
      ? params.tab
      : undefined;
  const effectiveSeason = await getFocusedSeasonSlug(params.season);
  const data = await loadCachedPublicStatsDashboard(effectiveSeason ?? "");

  return (
    <StatsDashboard
      key={data.seasonId}
      missingTable={false}
      hasRiotKey={false}
      ddVersion={data.ddVersion}
      leagueName={data.leagueName}
      leagueLogoUrl={data.leagueLogoUrl}
      seasonName={data.seasonName}
      seasonId={data.seasonId}
      seasonSlug={data.seasonSlug}
      allSeasons={data.allSeasons}
      currentEditionName={data.currentEditionName}
      divisions={data.divisions}
      players={data.players}
      teams={data.teams}
      soloPrioMap={data.soloPrioMap}
      isAdminView={false}
      initialStatsNotice={data.statsNotice}
      divisionThemes={data.divisionThemes}
      seasonStructure={data.seasonStructure}
      playoffBrackets={data.playoffBrackets}
      statsRoundLabel={data.statsRoundLabel}
      initialDivision={params.division}
      initialTab={initialTab}
      initialSheetData={data.initialSheetData}
    />
  );
}

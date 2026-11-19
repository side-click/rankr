import type { Metadata } from "next";
import { AdminStatsDashboard } from "@/components/AdminStatsDashboard";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/scdlSheetStats";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

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
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    includeRiotStats: false,
  });
  const sheetSummary = await fetchScdlSheetStats(
    ctx.players,
    ctx.teams,
    ctx.sheetConfig
  ).catch(() => null);

  return (
    <AdminStatsDashboard
      missingTable={false}
      hasRiotKey={false}
      ddVersion={ctx.ddVersion}
      leagueName={ctx.leagueName}
      leagueLogoUrl={ctx.leagueLogoUrl}
      seasonName={ctx.seasonName}
      seasonId={ctx.seasonId}
      currentEditionName={ctx.currentEditionName}
      divisions={ctx.divisions}
      players={sheetSummary ? [] : ctx.players}
      teams={sheetSummary ? [] : ctx.teams}
      isAdminView={false}
      initialDivision={params.division}
      initialTab={initialTab}
      initialSheetData={
        sheetSummary
          ? {
              players: sheetSummary.players,
              teams: sheetSummary.teams,
              fetchedAt: sheetSummary.fetchedAt,
              rowCount: sheetSummary.rowCount,
              matchCount: sheetSummary.matchCount,
            }
          : null
      }
    />
  );
}

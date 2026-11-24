import type { Metadata } from "next";
import { AdminAccessDenied } from "@/components/AdminAccessDenied";
import { StatsDashboard } from "@/components/StatsDashboard";
import { fetchScdlSheetStats } from "@/utils/leagueStats";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";

export const metadata: Metadata = {
  title: "Admin Stats | Rankr",
};

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({
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
  const ctx = await loadAdminStatsContext({
    seasonSlug: params.season?.trim() || undefined,
  });

  if (!ctx.authorized) {
    return (
      <AdminAccessDenied
        title="Stats Controls — Access Denied"
        heading="Operator or Admin Access Required"
        message="Stats administration is restricted to site admins and assigned league operators for that league."
      />
    );
  }

  const sheetSummary = await fetchScdlSheetStats(
    ctx.players,
    ctx.teams,
    ctx.sheetConfig
  ).catch(() => null);

  const strippedTeams = sheetSummary
    ? sheetSummary.teams.map((t) => ({ ...t, players: [] }))
    : [];

  return (
    <StatsDashboard
      missingTable={ctx.missingTable}
      hasRiotKey={ctx.hasRiotKey}
      ddVersion={ctx.ddVersion}
      leagueName={ctx.leagueName}
      leagueLogoUrl={ctx.leagueLogoUrl}
      seasonName={ctx.seasonName}
      seasonId={ctx.seasonId}
      seasonSlug={ctx.seasonSlug}
      allSeasons={ctx.allSeasons}
      currentEditionName={ctx.currentEditionName}
      divisions={ctx.divisions}
      players={sheetSummary ? [] : ctx.players}
      teams={sheetSummary ? [] : ctx.teams}
      initialStatsNotice={ctx.statsNotice}
      divisionThemes={ctx.divisionThemes}
      seasonStructure={ctx.seasonStructure}
      playoffBrackets={ctx.playoffBrackets}
      statsRoundLabel={ctx.statsRoundLabel}
      initialDivision={params.division}
      initialTab={initialTab}
      initialSheetData={
        sheetSummary
          ? {
              players: sheetSummary.players,
              subPlayers: sheetSummary.subPlayers,
              teams: strippedTeams,
              playoffSeries: sheetSummary.playoffSeries,
              fetchedAt: sheetSummary.fetchedAt,
              rowCount: sheetSummary.rowCount,
              matchCount: sheetSummary.matchCount,
            }
          : null
      }
    />
  );
}

import { AdminStatsDashboard } from "@/components/AdminStatsDashboard";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/scdlSheetStats";

export const dynamic = "force-dynamic";

export default async function PublicStatsPage() {
  const ctx = await loadPublicStatsContext();
  const sheetSummary = await fetchScdlSheetStats(ctx.players, ctx.teams).catch(
    () => null
  );

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
      players={ctx.players}
      teams={ctx.teams}
      isAdminView={false}
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

import { ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { AdminStatsDashboard } from "@/components/AdminStatsDashboard";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
import { fetchScdlSheetStats } from "@/utils/scdlSheetStats";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab =
    params.tab === "players" ||
    params.tab === "teams" ||
    params.tab === "division"
      ? params.tab
      : undefined;
  const ctx = await loadAdminStatsContext();

  if (!ctx.authorized) {
    return (
      <RetroWindow title="Stats Lab — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <h1 className="text-base font-bold text-[#f0ede0]">
            Admin Access Required
          </h1>
          <p className="text-xs text-[#a6a89e]">
            This Riot API Stats prototype is currently restricted to
            administrators.
          </p>
        </div>
      </RetroWindow>
    );
  }

  const sheetSummary = await fetchScdlSheetStats(
    ctx.players,
    ctx.teams,
    ctx.sheetConfig
  ).catch(() => null);

  return (
    <AdminStatsDashboard
      missingTable={ctx.missingTable}
      hasRiotKey={ctx.hasRiotKey}
      ddVersion={ctx.ddVersion}
      leagueName={ctx.leagueName}
      leagueLogoUrl={ctx.leagueLogoUrl}
      seasonName={ctx.seasonName}
      seasonId={ctx.seasonId}
      currentEditionName={ctx.currentEditionName}
      divisions={ctx.divisions}
      players={ctx.players}
      teams={ctx.teams}
      initialDivision={params.division}
      initialTab={initialTab}
      initialSheetData={sheetSummary}
    />
  );
}

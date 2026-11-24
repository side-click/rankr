import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { TeamScoutingView } from "@/components/TeamScoutingView";
import {
  loadAdminStatsContext,
  loadTeamScoutingData,
} from "@/utils/riotStatsServer";

export const dynamic = "force-dynamic";

export default async function AdminTeamStatsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const decodedId = decodeURIComponent(teamId);
  const ctx = await loadAdminStatsContext({ teamIdFilter: decodedId });

  if (!ctx.authorized) {
    return (
      <RetroWindow title="Team Stats — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <p className="text-xs text-[#a6a89e]">Admin Access Required.</p>
        </div>
      </RetroWindow>
    );
  }

  const scouting = await loadTeamScoutingData(ctx, decodedId);
  if (!scouting) {
    return (
      <RetroWindow title="Team Not Found" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            Team not found in active season.
          </p>
          <Link href="/admin/stats" className="xp-btn text-xs">
            ← Back to Stats Lab
          </Link>
        </div>
      </RetroWindow>
    );
  }

  return (
    <TeamScoutingView
      ddVersion={ctx.ddVersion}
      leagueName={ctx.leagueName}
      seasonName={ctx.seasonName}
      divisionThemeKey={scouting.divisionThemeKey}
      divisionThemes={ctx.divisionThemes}
      team={scouting.team}
      leagueTeam={scouting.leagueTeam}
      seriesHistory={scouting.seriesHistory}
      teamLogoMap={scouting.teamLogoMap}
      roleRankByPlayerKey={scouting.roleRankByPlayerKey}
      basePath="/admin/stats"
    />
  );
}

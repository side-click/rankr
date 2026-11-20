import Link from "next/link";
import { RetroWindow } from "@/components/RetroWindow";
import { TeamScoutingView } from "@/components/TeamScoutingView";
import {
  loadPublicStatsContext,
  loadTeamScoutingData,
} from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team Stats | Rankr",
};

export const dynamic = "force-dynamic";

export default async function PublicTeamStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ teamId }, { season }] = await Promise.all([params, searchParams]);
  const decodedId = decodeURIComponent(teamId);
  const effectiveSeason = await getFocusedSeasonSlug(season);
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    teamIdFilter: decodedId,
  });

  const scouting = await loadTeamScoutingData(ctx, decodedId);
  if (!scouting) {
    return (
      <RetroWindow title="Team Not Found" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            Team not found in active season.
          </p>
          <Link href="/stats" className="xp-btn text-xs">
            ← Back to Stats Dashboard
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
      team={scouting.team}
      leagueTeam={scouting.leagueTeam}
      seriesHistory={scouting.seriesHistory}
      teamLogoMap={scouting.teamLogoMap}
      roleRankByPlayerKey={scouting.roleRankByPlayerKey}
      basePath="/stats"
    />
  );
}

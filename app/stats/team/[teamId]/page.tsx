import Link from "next/link";
import { RetroWindow } from "@/components/RetroWindow";
import { AdminTeamScoutingView } from "@/components/AdminTeamScoutingView";
import { computeRoleNormalizedRatings } from "@/utils/riotStatsAggregation";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";
import {
  fetchAllScdlSeries,
  fetchScdlSheetStats,
} from "@/utils/scdlSheetStats";

export const dynamic = "force-dynamic";

export default async function PublicTeamStatsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const decodedId = decodeURIComponent(teamId);
  const effectiveSeason = await getFocusedSeasonSlug();
  const ctx = await loadPublicStatsContext(effectiveSeason);

  const team = ctx.teams.find((t) => t.teamId === decodedId);
  if (!team) {
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

  const [sheetSummary, allSeries] = await Promise.all([
    fetchScdlSheetStats(ctx.players, ctx.teams).catch(() => null),
    fetchAllScdlSeries().catch(() => []),
  ]);

  const leagueTeam =
    sheetSummary?.teams.find((t) => t.teamId === team.teamId) ?? null;

  const teamNameLower = team.teamName.toLowerCase();
  const seriesHistory = allSeries.filter(
    (s) =>
      s.teamA.toLowerCase() === teamNameLower ||
      s.teamB.toLowerCase() === teamNameLower
  );

  const teamLogoMap: Record<string, string | null> = {};
  for (const t of ctx.teams) {
    teamLogoMap[t.teamName.toLowerCase()] = t.logoUrl;
  }

  const divisionThemeKey =
    ctx.divisions.find((d) => d.id === team.divisionId)?.theme_key ?? "scdl";

  const roleRankByPlayerKey: Record<string, { rank: number; total: number }> = {};
  const rawDivPlayers = (sheetSummary?.players ?? []).filter(
    (p) => p.divisionId === team.divisionId && p.games > 0
  );
  const divPlayers = computeRoleNormalizedRatings(rawDivPlayers);
  const byRole = new Map<string, typeof divPlayers>();
  for (const p of divPlayers) {
    const list = byRole.get(p.role) ?? [];
    list.push(p);
    byRole.set(p.role, list);
  }
  for (const list of byRole.values()) {
    list.sort((a, b) => b.leagueRating - a.leagueRating);
    list.forEach((p, idx) => {
      roleRankByPlayerKey[p.playerKey] = { rank: idx + 1, total: list.length };
    });
  }

  return (
    <AdminTeamScoutingView
      ddVersion={ctx.ddVersion}
      leagueName={ctx.leagueName}
      seasonName={ctx.seasonName}
      divisionThemeKey={divisionThemeKey}
      team={team}
      leagueTeam={leagueTeam}
      seriesHistory={seriesHistory}
      teamLogoMap={teamLogoMap}
      roleRankByPlayerKey={roleRankByPlayerKey}
      basePath="/stats"
    />
  );
}

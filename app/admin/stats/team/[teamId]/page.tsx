import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import {
  formatMinutesSeconds,
  formatSoloRank,
} from "@/utils/riotStatsAggregation";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";

export const dynamic = "force-dynamic";

export default async function AdminTeamStatsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const decodedId = decodeURIComponent(teamId);
  const ctx = await loadAdminStatsContext();

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

  const team = ctx.teams.find((t) => t.teamId === decodedId);
  if (!team) {
    return (
      <RetroWindow title="Team Not Found" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">Team not found in active season.</p>
          <Link href="/admin/stats" className="xp-btn text-xs">
            ← Back to Stats Lab
          </Link>
        </div>
      </RetroWindow>
    );
  }

  const recentMatches = team.players
    .flatMap((p) =>
      p.matches.map((m) => ({ ...m, playerName: p.displayName, playerKey: p.playerKey }))
    )
    .sort((a, b) => b.gameCreation - a.gameCreation)
    .slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/stats" className="xp-btn text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Stats Lab</span>
        </Link>
      </div>

      <RetroWindow title={`${team.teamName} — Team Stats`} theme="scdl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {team.logoUrl && (
              <img
                src={team.logoUrl}
                alt={team.teamName}
                className="w-14 h-14 object-contain"
              />
            )}
            <div>
              <h1 className="wow-heading text-2xl font-extrabold text-white">
                {team.teamName}
              </h1>
              <div className="text-xs font-bold text-[#f0c020]">
                {team.divisionName} • {ctx.seasonName}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Games</div>
              <div className="text-base font-black text-white">{team.games}</div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Win Rate</div>
              <div
                className={`text-base font-black ${
                  team.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                }`}
              >
                {team.games > 0 ? `${team.winRate.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Avg KDA</div>
              <div className="text-base font-black text-[#f0c020]">
                {team.games > 0 ? team.avgKda.toFixed(2) : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Avg DPM</div>
              <div className="text-base font-black text-white">
                {team.games > 0 ? Math.round(team.avgDpm) : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Avg Time</div>
              <div className="text-base font-black text-white">
                {team.games > 0
                  ? formatMinutesSeconds(team.avgGameMinutes)
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Roster Cards */}
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#f0c020] mb-2.5">
          Roster Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 mb-6">
          {team.players.map((p) => {
            const roleMeta = getRoleMeta(p.role as LeagueRole);
            return (
              <Link
                key={p.playerKey}
                href={`/admin/stats/player/${encodeURIComponent(p.playerKey)}`}
                className="xp-panel p-3 hover:brightness-110 transition flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <img
                      src={roleMeta.icon}
                      alt={roleMeta.label}
                      className="w-4 h-4 object-contain"
                    />
                    <span className="font-bold text-sm text-[#f0ede0] truncate">
                      {p.displayName}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#f0c020] font-semibold">
                    {formatSoloRank(p.soloTier, p.soloRank, p.soloLp)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[11px] pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[#a6a89e]">KDA: </span>
                    <strong className="text-white">
                      {p.games > 0 ? p.kda.toFixed(2) : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#a6a89e]">WR: </span>
                    <strong
                      className={
                        p.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                      }
                    >
                      {p.games > 0 ? `${p.winRate.toFixed(0)}%` : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#a6a89e]">CS/m: </span>
                    <strong className="text-white">
                      {p.games > 0 ? p.csPerMin.toFixed(1) : "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#a6a89e]">DPM: </span>
                    <strong className="text-white">
                      {p.games > 0 ? Math.round(p.dpm) : "—"}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1">
                  {p.topChampions.slice(0, 3).map((c) => (
                    <img
                      key={c.name}
                      src={getChampionIconUrl(c.name, ctx.ddVersion)}
                      alt={c.name}
                      title={`${c.name} (${c.games}G)`}
                      className="w-6 h-6 rounded border border-white/20 object-cover"
                    />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Team Champion Pool + Recent Matches */}
        {team.topChampions.length > 0 && (
          <div className="mb-6 xp-panel p-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#f0c020] mb-2">
              Team Champion Pool
            </h2>
            <div className="flex flex-wrap gap-2">
              {team.topChampions.slice(0, 18).map((c) => (
                <div
                  key={c.name}
                  className="xp-inset px-2 py-1.5 flex items-center gap-2 text-xs"
                >
                  <img
                    src={getChampionIconUrl(c.name, ctx.ddVersion)}
                    alt={c.name}
                    className="w-6 h-6 rounded object-cover"
                  />
                  <div>
                    <div className="font-bold text-[#f0ede0] leading-none">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-[#a6a89e]">
                      {c.games}G • {((c.wins / c.games) * 100).toFixed(0)}% WR
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentMatches.length > 0 && (
          <div className="xp-panel overflow-hidden">
            <div className="bg-[#121615] border-b border-white/10 px-3 py-2 text-xs font-bold uppercase text-[#f0c020]">
              Recent Synced Games (Roster)
            </div>
            <div className="divide-y divide-white/10">
              {recentMatches.map((m, idx) => (
                <Link
                  key={`${m.matchId}-${m.playerKey}-${idx}`}
                  href={`/admin/stats/player/${encodeURIComponent(m.playerKey)}`}
                  className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-6 rounded-full ${
                        m.win ? "bg-[#7cd438]" : "bg-[#ff857a]"
                      }`}
                    />
                    <img
                      src={getChampionIconUrl(m.championName, ctx.ddVersion)}
                      alt={m.championName}
                      className="w-7 h-7 rounded border border-white/20"
                    />
                    <div>
                      <div className="font-bold text-[#f0ede0]">
                        {m.playerName} •{" "}
                        <span className="text-[#c7c5b8]">{m.championName}</span>
                      </div>
                      <div className="text-[10px] text-[#a6a89e]">
                        {m.win ? "Victory" : "Defeat"} •{" "}
                        {formatMinutesSeconds(m.gameDuration / 60)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span className="font-bold text-white">
                      {m.kills}/{m.deaths}/{m.assists}
                    </span>
                    <span className="text-[#c7c5b8]">{m.cs} CS</span>
                    <span className="text-[#f0c020]">
                      {Math.round(
                        m.totalDamageDealtToChampions / (m.gameDuration / 60)
                      )}{" "}
                      DPM
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </RetroWindow>
    </div>
  );
}

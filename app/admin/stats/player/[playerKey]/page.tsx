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

export default async function AdminPlayerStatsPage({
  params,
}: {
  params: Promise<{ playerKey: string }>;
}) {
  const { playerKey } = await params;
  const decodedKey = decodeURIComponent(playerKey).toLowerCase();
  const ctx = await loadAdminStatsContext();

  if (!ctx.authorized) {
    return (
      <RetroWindow title="Summoner Stats — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <p className="text-xs text-[#a6a89e]">Admin Access Required.</p>
        </div>
      </RetroWindow>
    );
  }

  const player = ctx.players.find((p) => p.playerKey === decodedKey);
  if (!player) {
    return (
      <RetroWindow title="Summoner Not Found" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            Summoner not found in active season.
          </p>
          <Link href="/admin/stats" className="xp-btn text-xs">
            ← Back to Stats Lab
          </Link>
        </div>
      </RetroWindow>
    );
  }

  const roleMeta = getRoleMeta(player.role as LeagueRole);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/admin/stats" className="xp-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Stats Lab</span>
          </Link>
          {player.teamId && (
            <Link
              href={`/admin/stats/team/${encodeURIComponent(player.teamId)}`}
              className="xp-btn text-xs"
            >
              {player.teamLogoUrl && (
                <img
                  src={player.teamLogoUrl}
                  alt={player.teamName}
                  className="w-3.5 h-3.5 object-contain"
                />
              )}
              <span>{player.teamName}</span>
            </Link>
          )}
        </div>
      </div>

      <RetroWindow title={`${player.displayName} — Summoner Stats`} theme="scdl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={roleMeta.icon}
              alt={roleMeta.label}
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="wow-heading text-2xl font-extrabold text-white">
                {player.riotId}
              </h1>
              <div className="text-xs font-bold text-[#f0c020]">
                {player.teamName} • {player.divisionName} •{" "}
                {formatSoloRank(
                  player.soloTier,
                  player.soloRank,
                  player.soloLp
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {[
              { label: "Games", val: `${player.games}` },
              {
                label: "Win Rate",
                val: player.games > 0 ? `${player.winRate.toFixed(1)}%` : "—",
              },
              {
                label: "KDA",
                val: player.games > 0 ? player.kda.toFixed(2) : "—",
              },
              {
                label: "CS / Min",
                val: player.games > 0 ? player.csPerMin.toFixed(2) : "—",
              },
              {
                label: "DPM",
                val: player.games > 0 ? `${Math.round(player.dpm)}` : "—",
              },
              {
                label: "KP%",
                val: player.games > 0 ? `${player.kpPct.toFixed(1)}%` : "—",
              },
            ].map((stat) => (
              <div key={stat.label} className="xp-inset px-2.5 py-2">
                <div className="text-[10px] uppercase text-[#a6a89e]">
                  {stat.label}
                </div>
                <div className="text-sm font-black text-white">{stat.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Champion Pool */}
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#f0c020] mb-2">
          Champion Pool ({player.topChampions.length})
        </h2>
        {player.topChampions.length === 0 ? (
          <div className="xp-inset p-6 text-center text-xs text-[#a6a89e] mb-6">
            No synced matches yet. Run a sync from the Stats Lab overview.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
            {player.topChampions.map((c) => {
              const wr = (c.wins / c.games) * 100;
              return (
                <div
                  key={c.name}
                  className="xp-panel p-2 flex items-center gap-2 text-xs"
                >
                  <img
                    src={getChampionIconUrl(c.name, ctx.ddVersion)}
                    alt={c.name}
                    className="w-8 h-8 rounded border border-white/20 object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[#f0ede0] truncate">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-[#a6a89e]">
                      {c.wins}W-{c.games - c.wins}L (
                      <span
                        className={
                          wr >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                        }
                      >
                        {wr.toFixed(0)}%
                      </span>
                      )
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Matches */}
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#f0c020] mb-2">
          Recent Matches ({player.matches.length})
        </h2>
        <div className="xp-panel overflow-hidden divide-y divide-white/10">
          {player.matches.map((m) => {
            const mins = m.gameDuration / 60;
            const kda =
              m.deaths > 0
                ? ((m.kills + m.assists) / m.deaths).toFixed(2)
                : (m.kills + m.assists).toFixed(2);
            return (
              <div
                key={m.matchId}
                className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-1.5 h-8 rounded-full ${
                      m.win ? "bg-[#7cd438]" : "bg-[#ff857a]"
                    }`}
                  />
                  <img
                    src={getChampionIconUrl(m.championName, ctx.ddVersion)}
                    alt={m.championName}
                    className="w-9 h-9 rounded border border-white/20 object-cover"
                  />
                  <div>
                    <div className="font-bold text-[#f0ede0]">
                      {m.championName}{" "}
                      <span
                        className={`ml-1 text-[10px] uppercase ${
                          m.win ? "text-[#7cd438]" : "text-[#ff857a]"
                        }`}
                      >
                        {m.win ? "Victory" : "Defeat"}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#a6a89e]">
                      {m.teamId === 100 ? "Blue Side" : "Red Side"} •{" "}
                      {formatMinutesSeconds(mins)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
                  <div>
                    <span className="font-bold text-white">
                      {m.kills}/{m.deaths}/{m.assists}
                    </span>{" "}
                    <span className="text-[#a6a89e]">({kda})</span>
                  </div>
                  <div className="text-[#c7c5b8]">
                    {m.cs} CS ({(m.cs / mins).toFixed(1)}/m)
                  </div>
                  <div className="text-[#f0c020]">
                    {Math.round(m.totalDamageDealtToChampions / mins)} DPM
                  </div>
                  <div className="text-[#7cd438]">
                    {Math.round(m.goldEarned / mins)} GPM
                  </div>
                  <div className="text-[#a6a89e]">
                    {(m.visionScore / mins).toFixed(1)} VS/m
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </RetroWindow>
    </div>
  );
}

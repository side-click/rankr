"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown, Award, Flame, ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { StatsDataCredits } from "@/components/stats/StatsDataCredits";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import { computeChampionStats } from "@/utils/championStats";
import type { LoadedStatsContext } from "@/utils/riotStatsServer";
import type { ScdlSeriesDetail } from "@/utils/scdlSheetStats";

interface ChampionStatsContentProps {
  ctx: LoadedStatsContext;
  series: ScdlSeriesDetail[];
  championName: string;
  basePath?: string;
}

type PlayerSortKey = "games" | "winRate" | "kda" | "dpm" | "damageShare" | "csPerMin";

export function ChampionStatsContent({
  ctx,
  series,
  championName,
  basePath = "/stats",
}: ChampionStatsContentProps) {
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<PlayerSortKey>("games");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const stats = useMemo(
    () => computeChampionStats(ctx, series, championName, divisionFilter),
    [ctx, series, championName, divisionFilter]
  );

  const sortedPlayers = useMemo(() => {
    const list = [...stats.playerLeaderboard];
    list.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [stats.playerLeaderboard, sortBy, sortDir]);

  const handleSort = (key: PlayerSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={basePath} className="xp-btn text-xs inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Stats Dashboard
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDivisionFilter("all")}
            className={`xp-btn text-xs ${divisionFilter === "all" ? "xp-btn-gold" : ""}`}
          >
            All Divisions
          </button>
          {ctx.divisions.map((div) => (
            <button
              key={div.id}
              type="button"
              onClick={() => setDivisionFilter(div.slug)}
              className={`xp-btn text-xs ${
                divisionFilter === div.slug ? "xp-btn-gold" : ""
              }`}
            >
              {div.name}
            </button>
          ))}
        </div>
      </div>

      <RetroWindow title={`${championName} — Champion Stats`} theme="scdl">
        <div className="p-4 space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-4">
              <img
                src={getChampionIconUrl(championName, ctx.ddVersion)}
                alt={championName}
                className="w-16 h-16 rounded-lg border border-[#f0c020]/50 object-cover shrink-0"
              />
              <div>
                <h1 className="text-2xl font-black text-[#f7f5eb] tracking-tight">
                  {championName}
                </h1>
                <p className="text-xs text-[#a6a89e]">
                  {ctx.leagueName} • {ctx.seasonName} •{" "}
                  {divisionFilter === "all"
                    ? "All Divisions"
                    : ctx.divisions.find((d) => d.slug === divisionFilter)?.name ??
                      divisionFilter}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-[#a6a89e] font-bold">
                Presence
              </div>
              <div className="text-2xl font-black text-[#f0c020] tabular-nums">
                {stats.presence.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Overview KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <div className="xp-panel p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#a6a89e] font-bold">
                Games
              </div>
              <div className="text-lg font-black text-[#f7f5eb] tabular-nums mt-0.5">
                {stats.games}
              </div>
            </div>
            <div className="xp-panel p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#a6a89e] font-bold">
                Record / WR
              </div>
              <div
                className={`text-lg font-black tabular-nums mt-0.5 ${
                  stats.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                }`}
              >
                {stats.wins}-{stats.losses}{" "}
                <span className="text-xs">({stats.winRate.toFixed(0)}%)</span>
              </div>
            </div>
            <div className="xp-panel p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#a6a89e] font-bold">
                Pick Rate
              </div>
              <div className="text-lg font-black text-[#f7f5eb] tabular-nums mt-0.5">
                {stats.pickRate.toFixed(1)}%
              </div>
            </div>
            <div className="xp-panel p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#a6a89e] font-bold">
                Bans / Rate
              </div>
              <div className="text-lg font-black text-[#ff857a] tabular-nums mt-0.5">
                {stats.bans}{" "}
                <span className="text-xs">({stats.banRate.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="xp-panel p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#a6a89e] font-bold">
                Presence
              </div>
              <div className="text-lg font-black text-[#f0c020] tabular-nums mt-0.5">
                {stats.presence.toFixed(1)}%
              </div>
            </div>
            <div className="xp-panel p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#a6a89e] font-bold">
                First Pick (B1)
              </div>
              <div className="text-lg font-black text-[#6bb8ff] tabular-nums mt-0.5">
                {stats.firstPickCount}{" "}
                <span className="text-xs">
                  ({stats.firstPickRate.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Roles & Draft Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Roles */}
            <div className="xp-panel p-3.5 space-y-2.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                Roles Played
              </h2>
              {stats.roles.length === 0 ? (
                <p className="text-xs text-[#a6a89e] italic">
                  No games recorded in this filter.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {stats.roles.map((r) => {
                    const meta = getRoleMeta(r.role as LeagueRole);
                    return (
                      <div
                        key={r.role}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-black/35 border border-white/10 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={meta.icon}
                            alt={meta.label}
                            className="w-4 h-4 object-contain"
                          />
                          <span className="font-bold text-[#f7f5eb]">
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="text-[#a6a89e]">
                            {r.games} {r.games === 1 ? "game" : "games"}
                          </span>
                          <span
                            className={`font-bold ${
                              r.winRate >= 50
                                ? "text-[#7cd438]"
                                : "text-[#ff857a]"
                            }`}
                          >
                            {r.wins}-{r.losses} ({r.winRate.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Draft Info */}
            <div className="xp-panel p-3.5 space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                Draft & Side Splits
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="px-3 py-2 rounded bg-[#152438]/60 border border-[#6bb8ff]/30 text-xs">
                  <div className="text-[10px] font-bold uppercase text-[#6bb8ff]">
                    Blue Side
                  </div>
                  <div className="font-black text-[#f7f5eb] tabular-nums mt-0.5">
                    {stats.blueWins}-{stats.blueGames - stats.blueWins}{" "}
                    <span className="text-[#a6a89e] font-semibold">
                      ({stats.blueWinRate.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="px-3 py-2 rounded bg-[#381518]/60 border border-[#ff857a]/30 text-xs">
                  <div className="text-[10px] font-bold uppercase text-[#ff857a]">
                    Red Side
                  </div>
                  <div className="font-black text-[#f7f5eb] tabular-nums mt-0.5">
                    {stats.redWins}-{stats.redGames - stats.redWins}{" "}
                    <span className="text-[#a6a89e] font-semibold">
                      ({stats.redWinRate.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>

              {stats.mostBannedBy.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#ff857a]">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Most Banned By
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.mostBannedBy.map((t) => (
                      <Link
                        key={t.teamId}
                        href={`/stats/team/${encodeURIComponent(t.teamId)}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-white/10 hover:border-[#f0c020]/60 text-xs transition"
                      >
                        {t.logoUrl && (
                          <img
                            src={t.logoUrl}
                            alt={t.teamName}
                            className="w-4 h-4 object-contain"
                          />
                        )}
                        <span className="font-semibold text-[#f7f5eb]">
                          {t.teamName}
                        </span>
                        <span className="text-[#ff857a] font-bold tabular-nums">
                          {t.bans}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Player Leaderboard */}
          <div className="xp-panel overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#121615] border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" />
                Player Leaderboard ({sortedPlayers.length})
              </h2>
              <span className="text-[11px] text-[#a6a89e]">
                Carrying badge requires 3+ games
              </span>
            </div>
            {sortedPlayers.length === 0 ? (
              <div className="p-4 text-xs text-[#a6a89e] italic">
                No players have picked {championName} in this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-[#a6a89e] border-b border-white/10">
                    <tr>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2">Team</th>
                      <th className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort("games")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          Games <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort("winRate")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          WR <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort("kda")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          KDA <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort("dpm")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          DPM <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort("damageShare")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          DMG% <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleSort("csPerMin")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          CS/m <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedPlayers.map((p) => (
                      <tr key={p.playerKey} className="hover:bg-white/5">
                        <td className="px-3 py-2 font-bold">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`${basePath}/player/${encodeURIComponent(
                                p.playerKey
                              )}`}
                              className="text-[#f7f5eb] hover:text-[#f0c020] hover:underline"
                            >
                              {p.playerName}
                            </Link>
                            {p.isCarrying && (
                              <span
                                title="Carrying the Champ: highest win rate with 3+ games"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#f0c020]/15 border border-[#f0c020]/50 text-[#f0c020] text-[10px] font-extrabold"
                              >
                                <Flame className="w-3 h-3" />
                                Carrying
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[#a6a89e]">
                          {p.teamId ? (
                            <Link
                              href={`${basePath}/team/${encodeURIComponent(
                                p.teamId
                              )}`}
                              className="inline-flex items-center gap-1.5 hover:text-[#f0c020]"
                            >
                              {p.logoUrl && (
                                <img
                                  src={p.logoUrl}
                                  alt={p.teamName}
                                  className="w-4 h-4 object-contain"
                                />
                              )}
                              <span>{p.teamName}</span>
                            </Link>
                          ) : (
                            p.teamName
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.games}
                        </td>
                        <td
                          className={`px-2.5 py-2 text-right tabular-nums font-bold ${
                            p.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                          }`}
                        >
                          {p.wins}-{p.losses} ({p.winRate.toFixed(0)}%)
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.kda.toFixed(2)}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.dpm.toFixed(0)}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.damageShare.toFixed(1)}%
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.csPerMin.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Games */}
          {stats.recentGames.length > 0 && (
            <div className="xp-panel overflow-hidden">
              <div className="px-3.5 py-2.5 bg-[#121615] border-b border-white/10">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                  Recent Games ({stats.recentGames.length})
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {stats.recentGames.map((g, idx) => (
                  <div
                    key={`${g.gameId}-${g.playerKey}-${idx}`}
                    className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          g.win
                            ? "bg-[#7cd438]/15 text-[#7cd438] border border-[#7cd438]/40"
                            : "bg-[#ff857a]/15 text-[#ff857a] border border-[#ff857a]/40"
                        }`}
                      >
                        {g.win ? "WIN" : "LOSS"}
                      </span>
                      <Link
                        href={`${basePath}/match/${encodeURIComponent(
                          g.seriesKey
                        )}`}
                        className="font-bold text-[#f7f5eb] hover:text-[#f0c020] hover:underline truncate"
                      >
                        {g.matchLabel}
                      </Link>
                      <span className="text-[#a6a89e] text-[11px]">
                        ({g.side})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <Link
                        href={`${basePath}/player/${encodeURIComponent(
                          g.playerKey
                        )}`}
                        className="text-[#f0ede0] hover:text-[#f0c020] font-semibold"
                      >
                        {g.playerName}
                      </Link>
                      <span className="text-[#a6a89e]">
                        {g.kills}/{g.deaths}/{g.assists}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <StatsDataCredits
            leagueName={ctx.leagueName}
            seasonName={ctx.seasonName}
            variant="compact"
          />
        </div>
      </RetroWindow>
    </div>
  );
}

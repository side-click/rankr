"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpDown,
  Award,
  ExternalLink,
  Flame,
  ShieldAlert,
} from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { StatsDataCredits } from "@/components/stats/StatsDataCredits";
import { getChampionIconUrl } from "@/utils/riotApi";
import { formatMinutesSeconds } from "@/utils/riotStatsAggregation";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import { resolveDivisionTheme } from "@/utils/themes";
import { formatSigned as formatSignedBase } from "@/utils/formatters";
import { computeChampionStats, type ChampionStatsPayload } from "@/utils/championStats";
import {
  championStatsHref,
  matchStatsHref,
  playerStatsHref,
  statsHref,
  teamStatsHref,
} from "@/utils/statsLinks";
import type { LoadedStatsContext } from "@/utils/riotStatsServer";
import type { ScdlSeriesDetail, SheetSourceConfig } from "@/utils/leagueStats";
import type { DivisionTheme } from "@/types/database";

export interface ChampionStatsViewMeta {
  ddVersion: string;
  leagueName: string;
  seasonName: string;
  seasonSlug: string | null;
  divisions: LoadedStatsContext["divisions"];
  divisionThemes: DivisionTheme[];
  sheetConfig?: SheetSourceConfig;
}

interface ChampionStatsContentProps {
  meta?: ChampionStatsViewMeta;
  statsByDivision?: Record<string, ChampionStatsPayload>;
  ctx?: LoadedStatsContext;
  series?: ScdlSeriesDetail[];
  championName: string;
  initialDivision?: string;
  basePath?: string;
}

type PlayerSortKey =
  | "games"
  | "winRate"
  | "kda"
  | "dpm"
  | "damageShare"
  | "csPerMin";

function formatSigned(val: number): string {
  return formatSignedBase(val, { round: true });
}

export function ChampionStatsContent({
  meta,
  statsByDivision,
  ctx: rawCtx,
  series,
  championName,
  initialDivision,
  basePath = "/stats",
}: ChampionStatsContentProps) {
  const ctx = meta ?? rawCtx!;
  const [divisionFilter, setDivisionFilter] = useState<string>(() => {
    if (ctx.divisions.length === 1) return ctx.divisions[0].slug;
    if (!initialDivision || initialDivision === "all") return "all";
    const lower = initialDivision.toLowerCase();
    const matched = ctx.divisions.find(
      (d) => d.slug.toLowerCase() === lower || d.id.toLowerCase() === lower
    );
    return matched ? matched.slug : "all";
  });
  const [sortBy, setSortBy] = useState<PlayerSortKey>("games");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const selectDivision = (nextSlug: string) => {
    setDivisionFilter(nextSlug);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextSlug === "all") {
        url.searchParams.delete("division");
      } else {
        url.searchParams.set("division", nextSlug);
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  const selectedDiv = useMemo(
    () =>
      divisionFilter !== "all"
        ? ctx.divisions.find((d) => d.slug === divisionFilter) ?? null
        : null,
    [ctx.divisions, divisionFilter]
  );

  const divTheme = useMemo(
    () =>
      resolveDivisionTheme(
        selectedDiv?.theme_key ?? "scdl",
        ctx.divisionThemes
      ),
    [selectedDiv, ctx.divisionThemes]
  );

  const stats = useMemo(
    () =>
      statsByDivision?.[divisionFilter] ??
      statsByDivision?.all ??
      computeChampionStats(rawCtx!, series ?? [], championName, divisionFilter),
    [statsByDivision, rawCtx, series, championName, divisionFilter]
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

  const leaguePrefix = ctx.leagueName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={statsHref(basePath, ctx.seasonSlug, {
            division: selectedDiv ? selectedDiv.id : "all",
            tab: "division",
          })}
          prefetch={false}
          className="xp-btn text-xs inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Stats Dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {ctx.divisions.length > 1 && (
            <button
              type="button"
              onClick={() => selectDivision("all")}
              className={`xp-btn text-xs ${
                divisionFilter === "all" ? "xp-btn-gold" : ""
              }`}
            >
              All Divisions
            </button>
          )}
          {ctx.divisions.map((div) => (
            <button
              key={div.id}
              type="button"
              onClick={() => selectDivision(div.slug)}
              className={`xp-btn text-xs inline-flex items-center gap-1.5 ${
                divisionFilter === div.slug ? "xp-btn-gold" : ""
              }`}
            >
              {div.logo_url && (
                <img
                  src={div.logo_url}
                  alt={div.name}
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain shrink-0"
                />
              )}
              <span>{div.name}</span>
            </button>
          ))}
        </div>
      </div>

      <RetroWindow
        title="Champion Stats"
        theme={
          selectedDiv?.theme_key === "dragon"
            ? "dragon"
            : selectedDiv?.theme_key === "baron"
            ? "baron"
            : "scdl"
        }
        customTheme={selectedDiv ? divTheme : undefined}
      >
        <div className="space-y-6">
          {/* Header (matches PlayerStatsContent & TeamScoutingView) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-4">
              <img
                src={getChampionIconUrl(championName, ctx.ddVersion)}
                alt={championName}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg border border-white/20 object-cover shrink-0"
              />
              <div>
                <h1 className="wow-heading text-3xl sm:text-4xl font-extrabold text-white">
                  {championName}
                </h1>
                <div className="mt-1 text-sm font-bold text-[#f0c020]">
                  <span
                    style={
                      selectedDiv
                        ? { color: divTheme.accent_text_color }
                        : undefined
                    }
                  >
                    {selectedDiv ? selectedDiv.name : "All Divisions"}
                  </span>{" "}
                  • {leaguePrefix} {ctx.seasonName}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-center w-full sm:w-auto shrink-0">
              <div className="xp-inset px-4 py-2.5 min-w-[110px]">
                <div className="text-[11px] uppercase text-[#a6a89e]">
                  Presence
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#f0c020] tabular-nums">
                  {stats.presence.toFixed(1)}%
                </div>
              </div>
              <div className="xp-inset px-4 py-2.5 min-w-[110px]">
                <div className="text-[11px] uppercase text-[#a6a89e]">
                  Win Rate
                </div>
                <div
                  className={`text-xl sm:text-2xl font-black tabular-nums ${
                    stats.games === 0
                      ? "text-[#a6a89e]"
                      : stats.winRate >= 50
                      ? "text-[#7cd438]"
                      : "text-[#ff857a]"
                  }`}
                >
                  {stats.games > 0 ? `${stats.winRate.toFixed(0)}%` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Overview KPI Strip (5 Distinct Cards, xp-inset matching PlayerStatsContent) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            <div className="xp-inset px-2.5 py-2.5">
              <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
                Games Played
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5 tabular-nums">
                {stats.games}
              </div>
            </div>
            <div className="xp-inset px-2.5 py-2.5">
              <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
                Record
              </div>
              <div
                className={`text-lg sm:text-xl font-black mt-0.5 tabular-nums ${
                  stats.games === 0
                    ? "text-white"
                    : stats.winRate >= 50
                    ? "text-[#7cd438]"
                    : "text-[#ff857a]"
                }`}
              >
                {stats.wins}-{stats.losses}
              </div>
            </div>
            <div className="xp-inset px-2.5 py-2.5">
              <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
                Pick Rate
              </div>
              <div className="text-lg sm:text-xl font-black text-white mt-0.5 tabular-nums">
                {stats.pickRate.toFixed(1)}%
              </div>
            </div>
            <div className="xp-inset px-2.5 py-2.5">
              <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
                Bans / Rate
              </div>
              <div className="text-lg sm:text-xl font-black text-[#ff857a] mt-0.5 tabular-nums">
                {stats.bans}{" "}
                <span className="text-xs font-bold">
                  ({stats.banRate.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="xp-inset px-2.5 py-2.5 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
                First Pick (B1)
              </div>
              <div className="text-lg sm:text-xl font-black text-[#6bb8ff] mt-0.5 tabular-nums">
                {stats.firstPickCount}{" "}
                <span className="text-xs font-bold">
                  ({stats.firstPickRate.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Roles & Draft Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Roles */}
            <div className="xp-panel p-3.5 space-y-2.5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
                Roles Played
              </h3>
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
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-black/35 border border-white/10 text-xs sm:text-[13px]"
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
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
                Draft &amp; Side Splits
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="px-3 py-2 rounded bg-[#152438]/60 border border-[#6bb8ff]/30 text-xs sm:text-[13px]">
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
                <div className="px-3 py-2 rounded bg-[#381518]/60 border border-[#ff857a]/30 text-xs sm:text-[13px]">
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
                        key={t.teamId || t.teamName}
                        href={
                          t.teamId
                            ? teamStatsHref(t.teamId, basePath, ctx.seasonSlug)
                            : statsHref(basePath, ctx.seasonSlug)
                        }
                        prefetch={false}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-white/10 hover:border-[#f0c020]/60 text-xs transition"
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
          <div className="xp-panel p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                Player Leaderboard ({sortedPlayers.length})
              </h2>
              <span className="text-xs text-[#a6a89e]">
                Carrying badge requires 3+ games
              </span>
            </div>
            {sortedPlayers.length === 0 ? (
              <div className="py-3 text-xs text-[#a6a89e] italic">
                No players have picked {championName} in this filter.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-xs sm:text-[13px] text-left">
                  <thead className="bg-black/40 text-[10px] sm:text-[11px] uppercase tracking-wider text-[#a6a89e] border-b border-white/10">
                    <tr>
                      <th className="px-2 sm:px-3 py-2">Player</th>
                      <th className="px-2 sm:px-3 py-2">Team</th>
                      <th
                        className="px-1.5 sm:px-2.5 py-2 text-right"
                        title="Games Played"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("games")}
                          className="inline-flex items-center gap-0.5 hover:text-[#f0c020]"
                        >
                          G <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th
                        className="px-1.5 sm:px-2.5 py-2 text-right"
                        title="Win Rate"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("winRate")}
                          className="inline-flex items-center gap-0.5 hover:text-[#f0c020]"
                        >
                          WR <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th
                        className="px-1.5 sm:px-2.5 py-2 text-right"
                        title="Kill / Death / Assist Ratio"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("kda")}
                          className="inline-flex items-center gap-0.5 hover:text-[#f0c020]"
                        >
                          KDA <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th
                        className="hidden sm:table-cell px-2.5 py-2 text-right"
                        title="Damage to Champions / Min"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("dpm")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          DPM <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th
                        className="hidden sm:table-cell px-2.5 py-2 text-right"
                        title="Team Damage Share %"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("damageShare")}
                          className="inline-flex items-center gap-1 hover:text-[#f0c020]"
                        >
                          DMG% <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th
                        className="hidden md:table-cell px-2.5 py-2 text-right"
                        title="Creep Score / Min"
                      >
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
                  <tbody className="divide-y divide-white/10">
                    {sortedPlayers.map((p) => (
                      <tr key={p.playerKey} className="hover:bg-white/5">
                        <td className="px-2 sm:px-3 py-2 font-bold">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={playerStatsHref(
                                p.playerKey,
                                basePath,
                                ctx.seasonSlug
                              )}
                              prefetch={false}
                              className="text-[#f7f5eb] hover:text-[#f0c020] transition-colors truncate max-w-[115px] sm:max-w-none"
                            >
                              {p.playerName}
                            </Link>
                            {p.isCarrying && (
                              <span
                                title="Carrying the Champ: highest win rate with 3+ games"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#f0c020]/15 border border-[#f0c020]/50 text-[#f0c020] text-[10px] font-extrabold shrink-0"
                              >
                                <Flame className="w-3 h-3" />
                                Carrying
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-[#a6a89e]">
                          {p.teamId ? (
                            <Link
                              href={teamStatsHref(
                                p.teamId,
                                basePath,
                                ctx.seasonSlug
                              )}
                              prefetch={false}
                              className="inline-flex items-center gap-1.5 hover:text-[#f0c020]"
                            >
                              {p.logoUrl && (
                                <img
                                  src={p.logoUrl}
                                  alt={p.teamName}
                                  className="w-4 h-4 object-contain shrink-0"
                                />
                              )}
                              <span className="truncate max-w-[80px] sm:max-w-none">
                                {p.teamName}
                              </span>
                            </Link>
                          ) : (
                            p.teamName
                          )}
                        </td>
                        <td className="px-1.5 sm:px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.games}
                        </td>
                        <td
                          className={`px-1.5 sm:px-2.5 py-2 text-right tabular-nums font-bold whitespace-nowrap ${
                            p.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                          }`}
                        >
                          {p.wins}-{p.losses}{" "}
                          <span className="hidden sm:inline">
                            ({p.winRate.toFixed(0)}%)
                          </span>
                        </td>
                        <td className="px-1.5 sm:px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.kda.toFixed(2)}
                        </td>
                        <td className="hidden sm:table-cell px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.dpm.toFixed(0)}
                        </td>
                        <td className="hidden sm:table-cell px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.damageShare.toFixed(1)}%
                        </td>
                        <td className="hidden md:table-cell px-2.5 py-2 text-right tabular-nums text-[#f7f5eb]">
                          {p.csPerMin.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Games (styled identically to PlayerStatsContent Match History) */}
          <div className="xp-panel p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#f0c020]">
                Recent Games ({stats.recentGames.length})
              </h2>
              <span className="text-xs text-[#a6a89e]">
                Click any game for full series draft &amp; box score
              </span>
            </div>

            {stats.recentGames.length > 0 ? (
              <div className="divide-y divide-white/10">
                {[...stats.recentGames].reverse().map((g, idx) => {
                  const mins = Math.max(g.gameDuration / 60, 1);
                  const kda =
                    g.deaths > 0
                      ? ((g.kills + g.assists) / g.deaths).toFixed(2)
                      : (g.kills + g.assists).toFixed(2);
                  const roleMeta = getRoleMeta(g.role as LeagueRole);
                  return (
                    <Link
                      key={`${g.gameId}-${g.playerKey}-${idx}`}
                      href={matchStatsHref(g.seriesKey, basePath, ctx.seasonSlug)}
                      prefetch={false}
                      className="py-3 px-2.5 flex flex-wrap items-center justify-between gap-3 hover:bg-white/5 transition rounded text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <span
                          className={`w-1.5 h-11 rounded-full shrink-0 ${
                            g.win ? "bg-[#7cd438]" : "bg-[#ff857a]"
                          }`}
                        />
                        {g.opponentChampion ? (
                          <img
                            src={getChampionIconUrl(
                              g.opponentChampion,
                              ctx.ddVersion
                            )}
                            alt={g.opponentChampion}
                            title={`vs ${g.opponentChampion}`}
                            className="w-11 h-11 rounded border border-white/20 object-cover shrink-0"
                          />
                        ) : (
                          <img
                            src={roleMeta.icon}
                            alt={roleMeta.label}
                            className="w-8 h-8 object-contain shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2 font-bold text-[#f0ede0] text-sm sm:text-[15px]">
                            <img
                              src={roleMeta.icon}
                              alt={roleMeta.label}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            <span>{g.playerName}</span>
                            {g.teamLogoUrl && (
                              <img
                                src={g.teamLogoUrl}
                                alt={g.teamName}
                                className="w-4 h-4 object-contain shrink-0"
                              />
                            )}
                            {g.pickSlot && (
                              <span
                                className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
                                  g.pickSlot.startsWith("B")
                                    ? "bg-[#5ea3ff]/20 text-[#5ea3ff]"
                                    : "bg-[#ff7b72]/20 text-[#ff7b72]"
                                }`}
                              >
                                {g.pickSlot}
                              </span>
                            )}
                            {g.opponentChampion && (
                              <span className="text-xs sm:text-[13px] font-normal text-[#a6a89e]">
                                vs{" "}
                                <strong className="text-[#ff857a]">
                                  {g.opponentChampion}
                                </strong>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#a6a89e] mt-0.5">
                            <span
                              className={
                                g.win
                                  ? "text-[#7cd438] font-bold"
                                  : "text-[#ff857a] font-bold"
                              }
                            >
                              {g.win ? "Win" : "Loss"}
                            </span>{" "}
                            • {g.roundLabel} ({g.teamName} vs {g.opponentName}) •{" "}
                            {formatMinutesSeconds(mins)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 sm:gap-5 tabular-nums text-xs sm:text-[13px]">
                        <div>
                          <strong className="text-white">
                            {g.kills}/{g.deaths}/{g.assists}
                          </strong>{" "}
                          <span className="text-[#a6a89e]">({kda})</span>
                        </div>
                        <div className="text-[#c7c5b8]">
                          {g.cs} CS ({(g.cs / mins).toFixed(1)}/m)
                        </div>
                        <div className="text-[#ff857a] font-bold">
                          {g.dpm} DPM
                        </div>
                        <div className="text-[#f0c020] font-bold">
                          GD@15 {formatSigned(g.goldDiff15)}
                        </div>
                        <ExternalLink className="w-4 h-4 text-[#a6a89e]" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#a6a89e] italic py-3">
                No {leaguePrefix} games recorded for {championName} in this
                filter.
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <StatsDataCredits
            leagueName={ctx.leagueName}
            seasonName={ctx.seasonName}
            sheetConfig={ctx.sheetConfig}
            variant="compact"
          />
        </div>
      </RetroWindow>
    </div>
  );
}

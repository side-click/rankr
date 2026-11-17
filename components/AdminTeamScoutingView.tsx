"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Shield, Swords } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import {
  formatMinutesSeconds,
  formatSoloRank,
  getRoleFilteredSoloChampions,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
} from "@/utils/riotStatsAggregation";
import type { ScdlSeriesDetail } from "@/utils/scdlSheetStats";
import { resolveDivisionTheme } from "@/utils/themes";

interface AdminTeamScoutingViewProps {
  ddVersion: string;
  leagueName?: string;
  seasonName: string;
  divisionThemeKey: string;
  team: AggregatedTeamStats;
  leagueTeam: AggregatedTeamStats | null;
  seriesHistory: ScdlSeriesDetail[];
  teamLogoMap: Record<string, string | null>;
}

function deriveLeaguePrefix(leagueName?: string): string {
  const raw = (leagueName ?? "").trim();
  if (!raw) return "League";
  if (raw.length <= 6 && !raw.includes(" ")) return raw.toUpperCase();
  const initials = raw
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials || raw;
}

function isOutlierChamp(
  games: number,
  allCounts: number[],
  totalGames: number
): boolean {
  if (games < 2 || totalGames <= 0 || allCounts.length < 2) return false;
  const share = games / totalGames;
  const mean = allCounts.reduce((a, b) => a + b, 0) / allCounts.length;
  const variance =
    allCounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / allCounts.length;
  const stdDev = Math.sqrt(variance);
  const z = stdDev > 0 ? (games - mean) / stdDev : 0;
  return share >= 0.25 && (z >= 1.5 || games >= mean * 2);
}

function formatMasteryPoints(pts: number): string {
  if (pts >= 1_000_000) return `${(pts / 1_000_000).toFixed(1)}M`;
  if (pts >= 1_000) return `${Math.round(pts / 1_000)}k`;
  return String(pts);
}

export function AdminTeamScoutingView({
  ddVersion,
  leagueName,
  seasonName,
  divisionThemeKey,
  team,
  leagueTeam,
  seriesHistory,
  teamLogoMap,
}: AdminTeamScoutingViewProps) {
  const leaguePrefix = deriveLeaguePrefix(leagueName);
  const divTheme = resolveDivisionTheme(divisionThemeKey);
  const windowTheme =
    divisionThemeKey === "dragon"
      ? "dragon"
      : divisionThemeKey === "baron"
      ? "baron"
      : "scdl";

  const displayTeam = leagueTeam ?? team;
  const leaguePlayerByKey = new Map(
    (leagueTeam?.players ?? []).map((p) => [p.playerKey, p])
  );

  // Determine Flex champions (played by 2+ players on this team across League Split or role-filtered SoloQ)
  const champPlayersMap = new Map<string, Set<string>>();
  for (const soloPlayer of team.players) {
    const lp = leaguePlayerByKey.get(soloPlayer.playerKey);
    const soloChamps = getRoleFilteredSoloChampions(
      soloPlayer.matches,
      soloPlayer.role,
      7
    );
    for (const c of lp?.topChampions ?? []) {
      const set = champPlayersMap.get(c.name) ?? new Set<string>();
      set.add(soloPlayer.playerKey);
      champPlayersMap.set(c.name, set);
    }
    for (const c of soloChamps) {
      const set = champPlayersMap.get(c.name) ?? new Set<string>();
      set.add(soloPlayer.playerKey);
      champPlayersMap.set(c.name, set);
    }
  }
  const flexChamps = new Set(
    [...champPlayersMap.entries()]
      .filter(([, playersSet]) => playersSet.size >= 2)
      .map(([name]) => name)
  );

  // Latest SoloQ sync timestamp across the 5 players
  const syncTimestamps = team.players
    .map((p) => p.deepSyncedAt ?? p.syncedAt)
    .filter((d): d is string => Boolean(d))
    .sort();
  const latestSyncIso =
    syncTimestamps.length > 0
      ? syncTimestamps[syncTimestamps.length - 1]
      : null;

  // Compute Banned Against & Draft Tendencies from seriesHistory
  const bannedAgainstMap = new Map<
    string,
    { total: number; vsBlue: number; vsRed: number }
  >();
  const b1Picks: { champ: string; vs: string; round: string }[] = [];
  const r12Picks: { champs: string[]; vs: string; round: string }[] = [];
  const r5Picks: {
    champ: string;
    player: string;
    role: string;
    vsChamp: string;
    vs: string;
    round: string;
  }[] = [];

  for (const s of seriesHistory) {
    for (const g of s.games) {
      const isBlue = g.blueTeam.toLowerCase() === team.teamName.toLowerCase();
      const oppName = isBlue ? g.redTeam : g.blueTeam;
      if (g.draft) {
        const oppBans = isBlue ? g.draft.redBans : g.draft.blueBans;
        for (const b of oppBans) {
          const cur = bannedAgainstMap.get(b) ?? {
            total: 0,
            vsBlue: 0,
            vsRed: 0,
          };
          cur.total += 1;
          if (isBlue) cur.vsBlue += 1;
          else cur.vsRed += 1;
          bannedAgainstMap.set(b, cur);
        }

        const myPicks = isBlue ? g.draft.bluePicks : g.draft.redPicks;
        if (myPicks.length > 0) {
          if (isBlue && myPicks[0]) {
            b1Picks.push({
              champ: myPicks[0],
              vs: oppName,
              round: g.roundLabel,
            });
          } else if (!isBlue && myPicks.length >= 2) {
            r12Picks.push({
              champs: [myPicks[0], myPicks[1]],
              vs: oppName,
              round: g.roundLabel,
            });
          }
          if (!isBlue && myPicks[4]) {
            const r5Champ = myPicks[4];
            const matchedPlayer = g.players.find(
              (gp) =>
                gp.teamName.toLowerCase() === team.teamName.toLowerCase() &&
                gp.champion.toLowerCase() === r5Champ.toLowerCase()
            );
            const blueSameRole = matchedPlayer?.role
              ? g.players.find(
                  (gp) =>
                    gp.teamName.toLowerCase() === g.blueTeam.toLowerCase() &&
                    gp.role === matchedPlayer.role
                )
              : undefined;
            r5Picks.push({
              champ: r5Champ,
              player: matchedPlayer?.displayName ?? "—",
              role: matchedPlayer?.role ?? "",
              vsChamp: blueSameRole?.champion ?? "",
              vs: oppName,
              round: g.roundLabel,
            });
          }
        }
      }
    }
  }

  const bannedAgainstList = [...bannedAgainstMap.entries()]
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const gWins = displayTeam.wins;
  const gLosses = Math.max(0, displayTeam.games - displayTeam.wins);
  const sWins = displayTeam.seriesWins ?? gWins;
  const sLosses = displayTeam.seriesLosses ?? gLosses;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/stats" className="xp-btn text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Stats Dashboard</span>
        </Link>
        <div className="text-[11px] text-[#a6a89e] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#f0c020]" />
          <span>
            Last SoloQ Sync:{" "}
            <strong className="text-[#f0ede0]">
              {latestSyncIso
                ? new Date(latestSyncIso).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Not synced yet"}
            </strong>
          </span>
        </div>
      </div>

      <RetroWindow
        title="Team Stats"
        theme={windowTheme}
        customTheme={divTheme}
        iconSrc={team.logoUrl ?? undefined}
      >
        {/* Team Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            {team.logoUrl && (
              <img
                src={team.logoUrl}
                alt={team.teamName}
                className="w-16 h-16 object-contain drop-shadow"
              />
            )}
            <div>
              <h1 className="wow-heading text-2xl sm:text-3xl font-extrabold text-white">
                {team.teamName}
              </h1>
              <div className="text-xs font-bold text-[#f0c020]">
                {team.divisionName} • {seasonName}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center w-full lg:w-auto shrink-0">
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Series</div>
              <div
                className={`text-base font-black ${
                  displayTeam.games <= 0
                    ? "text-white"
                    : sWins >= sLosses
                    ? "text-[#7cd438]"
                    : "text-[#ff857a]"
                }`}
              >
                {displayTeam.games > 0 ? `${sWins}-${sLosses}` : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">Games</div>
              <div
                className={`text-base font-black ${
                  displayTeam.games <= 0
                    ? "text-white"
                    : gWins >= gLosses
                    ? "text-[#7cd438]"
                    : "text-[#ff857a]"
                }`}
              >
                {displayTeam.games > 0 ? `${gWins}-${gLosses}` : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">
                Avg KDA
              </div>
              <div className="text-base font-black text-[#f0c020]">
                {displayTeam.games > 0 ? displayTeam.avgKda.toFixed(2) : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">
                Avg DPM
              </div>
              <div className="text-base font-black text-white">
                {displayTeam.games > 0 ? Math.round(displayTeam.avgDpm) : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2">
              <div className="text-[10px] uppercase text-[#a6a89e]">
                Avg Time
              </div>
              <div className="text-base font-black text-white">
                {displayTeam.games > 0
                  ? formatMinutesSeconds(displayTeam.avgGameMinutes)
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Roster Scouting Cards (5 Players) */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
              Roster Scouting Breakdown
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-[#a6a89e]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs border border-[#00b8c9] bg-[#00b8c9]/25 inline-block" />
                Flex (2+ players)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs border border-[#f0c020] bg-[#f0c020]/25 inline-block" />
                High-Frequency Outlier
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {team.players.map((soloPlayer: AggregatedPlayerStats) => {
              const lp = leaguePlayerByKey.get(soloPlayer.playerKey);
              const statsSrc = lp && lp.games > 0 ? lp : soloPlayer;
              const roleMeta = getRoleMeta(soloPlayer.role as LeagueRole);
              const topMastery = soloPlayer.masteryTop4[0] ?? null;

              const leagueChamps = lp?.topChampions ?? [];
              const leagueTotal = leagueChamps.reduce(
                (s, c) => s + c.games,
                0
              );
              const leagueCounts = leagueChamps.map((c) => c.games);

              const soloChamps = getRoleFilteredSoloChampions(
                soloPlayer.matches,
                soloPlayer.role,
                7
              );
              const soloTotal = soloChamps.reduce((s, c) => s + c.games, 0);
              const soloCounts = soloChamps.map((c) => c.games);

              return (
                <div
                  key={soloPlayer.playerKey}
                  className="xp-panel p-3 flex flex-col gap-3 w-full max-w-[380px] mx-auto sm:max-w-none"
                >
                  {/* Top Row: Large Role Icon + Name + Top Mastery Icon */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/stats/player/${encodeURIComponent(
                          soloPlayer.playerKey
                        )}`}
                        className="flex items-center gap-2 hover:text-[#f0c020] transition"
                      >
                        <img
                          src={roleMeta.icon}
                          alt={roleMeta.label}
                          title={roleMeta.label}
                          className="w-6 h-6 object-contain shrink-0"
                        />
                        <span className="font-extrabold text-sm text-[#f0ede0] truncate">
                          {soloPlayer.displayName}
                        </span>
                      </Link>
                      <div className="text-[11px] font-bold text-[#f0c020] mt-0.5">
                        {formatSoloRank(
                          soloPlayer.soloTier,
                          soloPlayer.soloRank,
                          soloPlayer.soloLp
                        )}
                      </div>
                    </div>

                    {topMastery && (
                      <div
                        className="shrink-0 flex flex-col items-center"
                        title={`Highest Mastery: ${
                          topMastery.championName
                        } (${formatMasteryPoints(topMastery.championPoints)} pts)`}
                      >
                        <img
                          src={getChampionIconUrl(
                            topMastery.championName,
                            ddVersion
                          )}
                          alt={topMastery.championName}
                          className="w-11 h-11 rounded border-2 border-[#f0c020]/75 object-cover shadow"
                        />
                        <span className="text-[9px] font-bold text-[#f0c020] mt-0.5">
                          {formatMasteryPoints(topMastery.championPoints)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Season Stats */}
                  <div className="bg-black/35 border border-white/10 rounded px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#a6a89e] mb-1">
                      {lp && lp.games > 0
                        ? `This Season (${lp.games}G)`
                        : `SoloQ (${soloPlayer.games}G)`}
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                      <div>
                        KDA:{" "}
                        <strong className="text-[#f0c020]">
                          {statsSrc.games > 0 ? statsSrc.kda.toFixed(2) : "—"}
                        </strong>
                      </div>
                      <div>
                        WR:{" "}
                        <strong
                          className={
                            statsSrc.winRate >= 50
                              ? "text-[#7cd438]"
                              : "text-[#ff857a]"
                          }
                        >
                          {statsSrc.games > 0
                            ? `${statsSrc.winRate.toFixed(0)}%`
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        CS/m:{" "}
                        <strong className="text-white">
                          {statsSrc.games > 0
                            ? statsSrc.csPerMin.toFixed(1)
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        DPM:{" "}
                        <strong className="text-white">
                          {statsSrc.games > 0
                            ? Math.round(statsSrc.dpm)
                            : "—"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 1. This Season (League Prefix) */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#f0c020] mb-1.5">
                      This Season ({leaguePrefix})
                    </div>
                    {leagueChamps.length > 0 ? (
                      <div className="space-y-1">
                        {leagueChamps.map((c) => {
                          const isFlex = flexChamps.has(c.name);
                          const isOutlier = isOutlierChamp(
                            c.games,
                            leagueCounts,
                            leagueTotal
                          );
                          const losses = c.games - c.wins;
                          return (
                            <div
                              key={c.name}
                              className={`flex items-center justify-between gap-1.5 px-1.5 py-1 rounded border text-[11px] ${
                                isOutlier
                                  ? "border-[#f0c020] bg-[#f0c020]/10"
                                  : isFlex
                                  ? "border-[#00b8c9]/80 bg-[#00b8c9]/10"
                                  : "border-white/10 bg-black/30"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img
                                  src={getChampionIconUrl(c.name, ddVersion)}
                                  alt={c.name}
                                  className="w-5 h-5 rounded object-cover shrink-0"
                                />
                                <span className="font-bold text-[#f0ede0] truncate">
                                  {c.name}
                                </span>
                                {isFlex && (
                                  <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-[#00b8c9]/25 text-[#5eead4] shrink-0">
                                    Flex
                                  </span>
                                )}
                              </div>
                              <span
                                className={`font-mono font-bold shrink-0 ${
                                  c.wins >= losses
                                    ? "text-[#7cd438]"
                                    : "text-[#ff857a]"
                                }`}
                              >
                                {c.wins}-{losses}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#a6a89e] italic">
                        No league games yet
                      </div>
                    )}
                  </div>

                  {/* 2. SoloQ Ranked Top 7 (Role-Filtered) */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e] mb-1.5">
                      SoloQ Top 7 ({roleMeta.label})
                    </div>
                    {soloChamps.length > 0 ? (
                      <div className="space-y-1">
                        {soloChamps.map((c) => {
                          const isFlex = flexChamps.has(c.name);
                          const isOutlier = isOutlierChamp(
                            c.games,
                            soloCounts,
                            soloTotal
                          );
                          return (
                            <div
                              key={c.name}
                              className={`flex items-center justify-between gap-1.5 px-1.5 py-1 rounded border text-[11px] ${
                                isOutlier
                                  ? "border-[#f0c020] bg-[#f0c020]/10"
                                  : isFlex
                                  ? "border-[#00b8c9]/70 bg-[#00b8c9]/10"
                                  : "border-white/10 bg-black/25"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img
                                  src={getChampionIconUrl(c.name, ddVersion)}
                                  alt={c.name}
                                  className="w-5 h-5 rounded object-cover shrink-0"
                                />
                                <span className="font-semibold text-[#e8e5d8] truncate">
                                  {c.name}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-[#c7c5b8] shrink-0">
                                {c.games}G{" "}
                                <strong
                                  className={
                                    c.winRate >= 50
                                      ? "text-[#7cd438]"
                                      : "text-[#ff857a]"
                                  }
                                >
                                  {c.winRate.toFixed(0)}%
                                </strong>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#a6a89e] italic">
                        No SoloQ games synced
                      </div>
                    )}
                  </div>

                  {/* 3. Account Mastery Top 4 */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e] mb-1.5">
                      Account Mastery Top 4
                    </div>
                    {soloPlayer.masteryTop4.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {soloPlayer.masteryTop4.map((m) => (
                          <div
                            key={m.championName}
                            title={`${m.championName} — M${
                              m.championLevel
                            } (${m.championPoints.toLocaleString()} pts)`}
                            className="bg-black/40 border border-white/10 rounded overflow-hidden text-center"
                          >
                            <img
                              src={getChampionIconUrl(
                                m.championName,
                                ddVersion
                              )}
                              alt={m.championName}
                              className="w-full aspect-square object-cover block"
                            />
                            <div className="text-[9px] font-bold text-[#f0c020] py-0.5">
                              {formatMasteryPoints(m.championPoints)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#a6a89e] italic">
                        Pending deep sync
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Draft Scouting: Banned Against & Draft Tendencies */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          <div className="xp-panel p-3 lg:col-span-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#ff857a] mb-2.5 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>Banned Against ({bannedAgainstList.length} Champs)</span>
            </h2>
            {bannedAgainstList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bannedAgainstList.slice(0, 12).map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between gap-2 bg-black/35 border border-white/10 rounded px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={getChampionIconUrl(b.name, ddVersion)}
                        alt={b.name}
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                      <span className="font-bold text-[#f0ede0] truncate">
                        {b.name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#ff857a] shrink-0">
                      {b.total}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#a6a89e]">
                No ban data recorded against this team yet.
              </p>
            )}
          </div>

          <div className="xp-panel p-3 space-y-3 lg:col-span-7">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
              <Swords className="w-4 h-4" />
              <span>Draft Tendencies (B1 / R1-2 / R5)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-black/35 border border-white/10 rounded p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#5ea3ff] mb-1.5">
                  Blue 1st Picks (B1)
                </div>
                {b1Picks.length > 0 ? (
                  <div className="space-y-2">
                    {b1Picks.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <img
                          src={getChampionIconUrl(p.champ, ddVersion)}
                          alt={p.champ}
                          className="w-5 h-5 rounded object-cover shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[#f0ede0] leading-tight">
                            {p.champ}
                          </div>
                          <div className="text-[9px] text-[#a6a89e] leading-snug">
                            {p.round} vs {p.vs}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#a6a89e] italic">—</div>
                )}
              </div>

              <div className="bg-black/35 border border-white/10 rounded p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#ff7b72] mb-1.5">
                  Red Openings (R1-2)
                </div>
                {r12Picks.length > 0 ? (
                  <div className="space-y-2">
                    {r12Picks.map((p, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {p.champs.map((ch) => (
                            <img
                              key={ch}
                              src={getChampionIconUrl(ch, ddVersion)}
                              alt={ch}
                              title={ch}
                              className="w-5 h-5 rounded object-cover shrink-0"
                            />
                          ))}
                          <span className="font-bold text-[#f0ede0] text-[11px] leading-tight">
                            {p.champs.join(" + ")}
                          </span>
                        </div>
                        <div className="text-[9px] text-[#a6a89e] leading-snug">
                          {p.round} vs {p.vs}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#a6a89e] italic">—</div>
                )}
              </div>

              <div className="bg-black/35 border border-white/10 rounded p-2.5">
                <div className="text-[10px] font-bold uppercase text-[#f0c020] mb-1">
                  R5 Counterpicks
                </div>
                {r5Picks.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const byPlayer = new Map<string, number>();
                      for (const p of r5Picks) {
                        byPlayer.set(
                          p.player,
                          (byPlayer.get(p.player) ?? 0) + 1
                        );
                      }
                      const topSummary = [...byPlayer.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, cnt]) => `${name} (${cnt}/${r5Picks.length})`)
                        .join(", ");
                      return (
                        <div className="text-[9px] text-[#a6a89e] pb-1 border-b border-white/10 leading-snug">
                          Usually R5:{" "}
                          <span className="text-[#f0ede0] font-semibold">
                            {topSummary}
                          </span>
                        </div>
                      );
                    })()}
                    {r5Picks.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <img
                          src={getChampionIconUrl(p.champ, ddVersion)}
                          alt={p.champ}
                          className="w-5 h-5 rounded object-cover shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#f0ede0] flex flex-wrap items-center gap-1 leading-tight">
                            <span>{p.champ}</span>
                            {p.role && (
                              <span className="text-[10px] text-[#f0c020]">
                                ({p.role})
                              </span>
                            )}
                            {p.vsChamp && (
                              <>
                                <span className="text-[10px] text-[#a6a89e] font-normal">
                                  vs
                                </span>
                                <img
                                  src={getChampionIconUrl(p.vsChamp, ddVersion)}
                                  alt={p.vsChamp}
                                  title={`Counterpicked into ${p.vsChamp}`}
                                  className="w-4 h-4 rounded object-cover shrink-0"
                                />
                                <span className="text-[10px] text-[#ff857a] font-semibold">
                                  {p.vsChamp}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[9px] text-[#a6a89e] leading-snug mt-0.5">
                            {p.player} • {p.round} vs {p.vs}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#a6a89e] italic">—</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Team Game History (Clickable Series Cards) */}
        <div className="xp-panel p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
              Team Match History ({seriesHistory.length})
            </h2>
            <span className="text-[10px] text-[#a6a89e]">
              Click any series for full draft &amp; box score
            </span>
          </div>

          {seriesHistory.length > 0 ? (
            <div className="space-y-2.5">
              {seriesHistory.map((s) => {
                const isTeamA =
                  s.teamA.toLowerCase() === team.teamName.toLowerCase();
                const oppName = isTeamA ? s.teamB : s.teamA;
                const myWins = isTeamA ? s.teamAWins : s.teamBWins;
                const oppWins = isTeamA ? s.teamBWins : s.teamAWins;
                const seriesWon = myWins > oppWins;
                const oppLogo = teamLogoMap[oppName.toLowerCase()] ?? null;

                return (
                  <Link
                    key={s.seriesKey}
                    href={`/admin/stats/match/${encodeURIComponent(
                      s.seriesKey
                    )}`}
                    className="block rounded border border-white/15 bg-black/35 hover:bg-white/5 transition p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            seriesWon
                              ? "bg-[#7cd438]/20 text-[#7cd438] border border-[#7cd438]/40"
                              : "bg-[#ff857a]/20 text-[#ff857a] border border-[#ff857a]/40"
                          }`}
                        >
                          {seriesWon ? "Win" : "Loss"} {myWins}-{oppWins}
                        </span>
                        <span className="text-xs font-bold text-[#a6a89e]">
                          vs
                        </span>
                        {oppLogo && (
                          <img
                            src={oppLogo}
                            alt={oppName}
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        <span className="text-sm font-extrabold text-[#f0ede0]">
                          {oppName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#a6a89e]">
                        <span className="font-bold text-[#f0c020]">
                          {s.roundLabel}
                        </span>
                        {s.games[0] && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {formatMinutesSeconds(s.games[0].gameDuration / 60)}
                          </span>
                        )}
                      </div>
                    </div>

                    {s.games.map((g, gIdx) => {
                      const blueRows = g.players.filter(
                        (p) => p.side === "Blue"
                      );
                      const redRows = g.players.filter(
                        (p) => p.side === "Red"
                      );
                      const blueChamps =
                        g.draft?.bluePicks.length
                          ? g.draft.bluePicks
                          : blueRows.map((p) => p.champion);
                      const redChamps =
                        g.draft?.redPicks.length
                          ? g.draft.redPicks
                          : redRows.map((p) => p.champion);

                      return (
                        <div
                          key={g.gameId}
                          className="mt-2 pt-2 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-[#5ea3ff]">
                                {s.games.length > 1 ? `G${gIdx + 1} ` : ""}Blue:{" "}
                                {g.blueTeam}
                              </span>
                              {g.draft && g.draft.blueBans.length > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[9px] text-[#a6a89e] mr-1">
                                    Bans:
                                  </span>
                                  {g.draft.blueBans.map((b, i) => (
                                    <img
                                      key={`${b}-${i}`}
                                      src={getChampionIconUrl(b, ddVersion)}
                                      alt={b}
                                      title={`Blue Ban: ${b}`}
                                      className="w-4 h-4 rounded-xs grayscale opacity-75 object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {blueChamps.map((ch, i) => (
                                <img
                                  key={`${ch}-${i}`}
                                  src={getChampionIconUrl(ch, ddVersion)}
                                  alt={ch}
                                  title={ch}
                                  className="w-6 h-6 rounded border border-[#5ea3ff]/40 object-cover"
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-[#ff7b72]">
                                {s.games.length > 1 ? `G${gIdx + 1} ` : ""}Red:{" "}
                                {g.redTeam}
                              </span>
                              {g.draft && g.draft.redBans.length > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[9px] text-[#a6a89e] mr-1">
                                    Bans:
                                  </span>
                                  {g.draft.redBans.map((b, i) => (
                                    <img
                                      key={`${b}-${i}`}
                                      src={getChampionIconUrl(b, ddVersion)}
                                      alt={b}
                                      title={`Red Ban: ${b}`}
                                      className="w-4 h-4 rounded-xs grayscale opacity-75 object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {redChamps.map((ch, i) => (
                                <img
                                  key={`${ch}-${i}`}
                                  src={getChampionIconUrl(ch, ddVersion)}
                                  alt={ch}
                                  title={ch}
                                  className="w-6 h-6 rounded border border-[#ff7b72]/40 object-cover"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[#a6a89e]">
              No league matches recorded for this team yet.
            </p>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}

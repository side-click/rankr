"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Calendar, Clock } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import {
  formatMinutesSeconds,
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
  roleRankByPlayerKey: Record<string, { rank: number; total: number }>;
  basePath?: string;
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

const RANK_COLOR_MAP: Record<string, string> = {
  CHALLENGER: "text-[#38bdf8]",
  GRANDMASTER: "text-[#f87171]",
  MASTER: "text-[#c084fc]",
  DIAMOND: "text-[#60a5fa]",
  EMERALD: "text-[#34d399]",
  PLATINUM: "text-[#9ca3af]",
  GOLD: "text-[#f0c020]",
  SILVER: "text-[#d1d5db]",
  BRONZE: "text-[#cd7f32]",
  IRON: "text-[#78716c]",
};

function formatStyledSoloRank(
  tier: string | null,
  rank: string | null,
  lp: number | null
): { label: string; className: string } {
  if (!tier) return { label: "Unranked", className: "text-[#8e9286]" };
  const t = tier.toUpperCase();
  const titleTier = t.charAt(0) + t.slice(1).toLowerCase();
  const color = RANK_COLOR_MAP[t] ?? "text-[#f0c020]";
  const isApex = t === "MASTER" || t === "GRANDMASTER" || t === "CHALLENGER";
  if (isApex) {
    const label = lp != null ? `${titleTier} ${lp} LP` : titleTier;
    return { label, className: color };
  }
  const label = rank ? `${titleTier} ${rank}` : titleTier;
  return { label, className: color };
}

function isHighPriorityPick(
  games: number,
  wins: number,
  allCounts: number[],
  totalGames: number
): boolean {
  const minGames = 4;
  if (games < minGames || totalGames < 12 || allCounts.length < 2) return false;
  const wr = wins / games;
  if (wr < 0.45) return false;

  const wrBoost = (wr - 0.5) * 2.0;
  const reqZ = Math.min(2.0, Math.max(0.65, 1.15 - wrBoost));
  const reqShare = Math.max(0.16, 0.23 - (wr - 0.5) * 0.25);
  const reqMeanMult = Math.max(1.4, 1.75 - wrBoost * 0.4);

  const share = games / totalGames;
  const mean = allCounts.reduce((a, b) => a + b, 0) / allCounts.length;
  const variance =
    allCounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / allCounts.length;
  const stdDev = Math.sqrt(variance);
  const z = stdDev > 0 ? (games - mean) / stdDev : 0;
  return share >= reqShare && (z >= reqZ || games >= mean * reqMeanMult);
}

function getRoleRankBadgeStyle(
  rank: number,
  total: number
): React.CSSProperties {
  const t = total <= 1 ? 0 : Math.min(1, Math.max(0, (rank - 1) / (total - 1)));
  // Green (74,222,128) -> Gray (166,168,158) -> Red (248,113,113)
  let r: number;
  let g: number;
  let b: number;
  if (t <= 0.5) {
    const u = t / 0.5;
    r = Math.round(74 + (166 - 74) * u);
    g = Math.round(222 + (168 - 222) * u);
    b = Math.round(128 + (158 - 128) * u);
  } else {
    const u = (t - 0.5) / 0.5;
    r = Math.round(166 + (248 - 166) * u);
    g = Math.round(168 + (113 - 168) * u);
    b = Math.round(158 + (113 - 158) * u);
  }
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.45)`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
  };
}

const DUAL_PRIORITY_FLEX_STYLE: React.CSSProperties = {
  border: "1px solid transparent",
  backgroundImage:
    "linear-gradient(90deg, rgba(255, 90, 82, 0.22), rgba(0, 184, 201, 0.22)), linear-gradient(90deg, #141816, #141816), linear-gradient(90deg, #ff5a52, #00b8c9)",
  backgroundOrigin: "padding-box, padding-box, border-box",
  backgroundClip: "padding-box, padding-box, border-box",
};

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
  roleRankByPlayerKey,
  basePath = "/admin/stats",
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
    <div className="space-y-4 w-[min(1560px,94vw)] relative left-1/2 -translate-x-1/2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={basePath} className="xp-btn text-xs">
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
                <span style={{ color: divTheme.accent_text_color }}>
                  {team.divisionName}
                </span>{" "}
                • {leaguePrefix} {seasonName}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center w-full sm:w-auto shrink-0">
            <div className="xp-inset px-3 py-2 min-w-[76px]">
              <div className="text-[10px] uppercase text-[#a6a89e]">Seed</div>
              <div className="text-base font-black text-[#f0c020]">
                {leagueTeam?.seed != null ? `#${leagueTeam.seed}` : "—"}
              </div>
            </div>
            <div className="xp-inset px-3 py-2 min-w-[76px]">
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
            <div className="xp-inset px-3 py-2 min-w-[76px]">
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
          </div>
        </div>

        {/* Roster Scouting Cards (5 Players) */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
            <div className="flex items-center gap-3 text-[10px] text-[#a6a89e]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs border border-[#00b8c9] bg-[#00b8c9]/25 inline-block" />
                Flex (2+ players)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs border border-[#ff5a52] bg-[#ff5a52]/25 inline-block" />
                High Priority Picks
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {team.players.map((soloPlayer: AggregatedPlayerStats) => {
              const lp = leaguePlayerByKey.get(soloPlayer.playerKey);
              const roleRank = roleRankByPlayerKey[soloPlayer.playerKey] ?? null;
              const roleMeta = getRoleMeta(soloPlayer.role as LeagueRole);
              const styledRank = formatStyledSoloRank(
                soloPlayer.soloTier,
                soloPlayer.soloRank,
                soloPlayer.soloLp
              );

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
                  {/* Top Row: Role Icon + Larger Player Name + Rank & Division Role Rank */}
                  <div className="min-w-0">
                    <Link
                      href={`${basePath}/player/${encodeURIComponent(
                        soloPlayer.playerKey
                      )}`}
                      className="flex items-center gap-2 hover:text-[#f0c020] transition"
                    >
                      <img
                        src={roleMeta.icon}
                        alt={roleMeta.label}
                        title={roleMeta.label}
                        className="w-7 h-7 object-contain shrink-0"
                      />
                      <span className="font-extrabold text-lg text-[#f0ede0] truncate">
                        {soloPlayer.displayName}
                      </span>
                    </Link>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1.5">
                      <span className={`text-xs font-bold whitespace-nowrap ${styledRank.className}`}>
                        {styledRank.label}
                      </span>
                      {roleRank !== null && (
                        <span
                          style={getRoleRankBadgeStyle(
                            roleRank.rank,
                            roleRank.total
                          )}
                          className="text-xs font-extrabold border rounded px-1.5 py-0.5 whitespace-nowrap shrink-0"
                        >
                          #{roleRank.rank}{" "}
                          {soloPlayer.role === "jungle"
                            ? "Jgl"
                            : soloPlayer.role === "support"
                            ? "Sup"
                            : roleMeta.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1. This Season (League Prefix) */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#f0c020] mb-1.5">
                      This Season
                    </div>
                    {leagueChamps.length > 0 ? (
                      <div className="space-y-1.5">
                        {leagueChamps.map((c) => {
                          const isFlex = flexChamps.has(c.name);
                          const isPriority = isHighPriorityPick(
                            c.games,
                            c.wins,
                            leagueCounts,
                            leagueTotal
                          );
                          const losses = c.games - c.wins;
                          return (
                            <div
                              key={c.name}
                              style={
                                isPriority && isFlex
                                  ? DUAL_PRIORITY_FLEX_STYLE
                                  : undefined
                              }
                              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border text-xs sm:text-[13px] ${
                                isPriority && isFlex
                                  ? ""
                                  : isPriority
                                  ? "border-[#ff5a52] bg-[#ff5a52]/12"
                                  : isFlex
                                  ? "border-[#00b8c9]/80 bg-[#00b8c9]/10"
                                  : "border-white/10 bg-black/30"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={getChampionIconUrl(c.name, ddVersion)}
                                  alt={c.name}
                                  className="w-6 h-6 rounded object-cover shrink-0"
                                />
                                <span className="font-bold text-[#f0ede0] truncate">
                                  {c.name}
                                </span>
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
                    <div
                      title="Analyzes up to the 200 most recent SoloQ games (within the last year)"
                      className="text-[11px] font-bold uppercase tracking-wider text-[#a6a89e] mb-1.5 cursor-help inline-block"
                    >
                      SoloQ Top 7 ({roleMeta.label})
                    </div>
                    {soloChamps.length > 0 ? (
                      <div className="space-y-1.5">
                        {soloChamps.map((c) => {
                          const isFlex = flexChamps.has(c.name);
                          const isPriority = isHighPriorityPick(
                            c.games,
                            c.wins,
                            soloCounts,
                            soloTotal
                          );
                          return (
                            <div
                              key={c.name}
                              style={
                                isPriority && isFlex
                                  ? DUAL_PRIORITY_FLEX_STYLE
                                  : undefined
                              }
                              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border text-xs sm:text-[13px] ${
                                isPriority && isFlex
                                  ? ""
                                  : isPriority
                                  ? "border-[#ff5a52] bg-[#ff5a52]/12"
                                  : isFlex
                                  ? "border-[#00b8c9]/70 bg-[#00b8c9]/10"
                                  : "border-white/10 bg-black/25"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={getChampionIconUrl(c.name, ddVersion)}
                                  alt={c.name}
                                  className="w-6 h-6 rounded object-cover shrink-0"
                                />
                                <span className="font-semibold text-[#e8e5d8] truncate">
                                  {c.name}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-[#c7c5b8] shrink-0">
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
                      <div className="text-xs text-[#a6a89e] italic">
                        No SoloQ games synced
                      </div>
                    )}
                  </div>

                  {/* 3. Account Mastery Top 4 */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#a6a89e] mb-1.5">
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
                            <div className="text-[11px] font-bold text-[#f0c020] py-0.5">
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
              <Ban className="w-4 h-4" />
              <span>Banned Against ({bannedAgainstList.length} Champs)</span>
            </h2>
            {bannedAgainstList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bannedAgainstList.slice(0, 12).map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between gap-2 bg-black/35 border border-white/10 rounded px-2.5 py-2 text-xs sm:text-[13px]"
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
                    <span className="text-base sm:text-lg font-mono font-black text-[#ff857a] leading-none shrink-0">
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
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
              Draft Tendencies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs sm:text-[13px]">
              <div className="bg-black/35 border border-white/10 rounded p-2.5">
                <div className="text-[11px] font-bold uppercase text-[#5ea3ff] mb-2">
                  Blue 1st Picks (B1)
                </div>
                {b1Picks.length > 0 ? (
                  <div className="space-y-2">
                    {b1Picks.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <img
                          src={getChampionIconUrl(p.champ, ddVersion)}
                          alt={p.champ}
                          className="w-6 h-6 rounded object-cover shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[#f0ede0] leading-tight">
                            {p.champ}
                          </div>
                          <div className="text-[11px] text-[#a6a89e] leading-snug">
                            {p.round} vs {p.vs}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#a6a89e] italic">—</div>
                )}
              </div>

              <div className="bg-black/35 border border-white/10 rounded p-2.5">
                <div className="text-[11px] font-bold uppercase text-[#ff7b72] mb-2">
                  Red Openings (R1-2)
                </div>
                {r12Picks.length > 0 ? (
                  <div className="space-y-2">
                    {r12Picks.map((p, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.champs.map((ch) => (
                            <img
                              key={ch}
                              src={getChampionIconUrl(ch, ddVersion)}
                              alt={ch}
                              title={ch}
                              className="w-6 h-6 rounded object-cover shrink-0"
                            />
                          ))}
                          <span className="font-bold text-[#f0ede0] leading-tight">
                            {p.champs.join(" + ")}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#a6a89e] leading-snug">
                          {p.round} vs {p.vs}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#a6a89e] italic">—</div>
                )}
              </div>

              <div className="bg-black/35 border border-white/10 rounded p-2.5">
                <div className="text-[11px] font-bold uppercase text-[#f0c020] mb-1.5">
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
                        <div className="text-[11px] text-[#a6a89e] pb-1.5 border-b border-white/10 leading-snug">
                          Usually R5:{" "}
                          <span className="text-[#f0ede0] font-semibold">
                            {topSummary}
                          </span>
                        </div>
                      );
                    })()}
                    {r5Picks.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <img
                          src={getChampionIconUrl(p.champ, ddVersion)}
                          alt={p.champ}
                          className="w-6 h-6 rounded object-cover shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#f0ede0] flex flex-wrap items-center gap-1 leading-tight">
                            <span>{p.champ}</span>
                            {p.role && (
                              <span className="text-xs text-[#f0c020]">
                                ({p.role})
                              </span>
                            )}
                            {p.vsChamp && (
                              <>
                                <span className="text-xs text-[#a6a89e] font-normal">
                                  vs
                                </span>
                                <img
                                  src={getChampionIconUrl(p.vsChamp, ddVersion)}
                                  alt={p.vsChamp}
                                  title={`Counterpicked into ${p.vsChamp}`}
                                  className="w-5 h-5 rounded object-cover shrink-0"
                                />
                                <span className="text-xs text-[#ff857a] font-semibold">
                                  {p.vsChamp}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[11px] text-[#a6a89e] leading-snug mt-0.5">
                            {p.player} • {p.round} vs {p.vs}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#a6a89e] italic">—</div>
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
                    href={`${basePath}/match/${encodeURIComponent(
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
                          className="mt-2 pt-2.5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 text-xs"
                        >
                          {/* Blue Side */}
                          <div className="space-y-1.5 md:pr-5 md:border-r md:border-white/15">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-[#5ea3ff]">
                                {s.games.length > 1 ? `G${gIdx + 1} ` : ""}Blue:{" "}
                                {g.blueTeam}
                              </span>
                              <div className="flex items-center gap-2.5 font-mono text-xs">
                                <span className="font-bold text-[#f0ede0]">
                                  {g.blueKills}/{g.blueDeaths}/{g.blueAssists}
                                </span>
                                <span className="text-[#f0c020]" title="Dragons">
                                  Drg {g.blueDragons}
                                </span>
                                <span className="text-[#c084fc]" title="Barons">
                                  Brn {g.blueBarons}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              {blueChamps.map((ch, i) => (
                                <img
                                  key={`${ch}-${i}`}
                                  src={getChampionIconUrl(ch, ddVersion)}
                                  alt={ch}
                                  title={ch}
                                  className="w-6 h-6 rounded border border-[#5ea3ff]/40 object-cover"
                                />
                              ))}
                              {g.draft && g.draft.blueBans.length > 0 && (
                                <>
                                  <span className="h-5 w-px bg-white/15 mx-1" />
                                  {g.draft.blueBans.map((b, i) => (
                                    <img
                                      key={`bb-${b}-${i}`}
                                      src={getChampionIconUrl(b, ddVersion)}
                                      alt={b}
                                      title={`Blue Ban: ${b}`}
                                      className="w-6 h-6 rounded border border-white/15 grayscale opacity-60 object-cover"
                                    />
                                  ))}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Red Side */}
                          <div className="space-y-1.5 md:pl-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-[#ff7b72]">
                                {s.games.length > 1 ? `G${gIdx + 1} ` : ""}Red:{" "}
                                {g.redTeam}
                              </span>
                              <div className="flex items-center gap-2.5 font-mono text-xs">
                                <span className="font-bold text-[#f0ede0]">
                                  {g.redKills}/{g.redDeaths}/{g.redAssists}
                                </span>
                                <span className="text-[#f0c020]" title="Dragons">
                                  Drg {g.redDragons}
                                </span>
                                <span className="text-[#c084fc]" title="Barons">
                                  Brn {g.redBarons}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              {redChamps.map((ch, i) => (
                                <img
                                  key={`${ch}-${i}`}
                                  src={getChampionIconUrl(ch, ddVersion)}
                                  alt={ch}
                                  title={ch}
                                  className="w-6 h-6 rounded border border-[#ff7b72]/40 object-cover"
                                />
                              ))}
                              {g.draft && g.draft.redBans.length > 0 && (
                                <>
                                  <span className="h-5 w-px bg-white/15 mx-1" />
                                  {g.draft.redBans.map((b, i) => (
                                    <img
                                      key={`rb-${b}-${i}`}
                                      src={getChampionIconUrl(b, ddVersion)}
                                      alt={b}
                                      title={`Red Ban: ${b}`}
                                      className="w-6 h-6 rounded border border-white/15 grayscale opacity-60 object-cover"
                                    />
                                  ))}
                                </>
                              )}
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

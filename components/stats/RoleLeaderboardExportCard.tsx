"use client";

import React from "react";
import { RankrLogoIcon } from "@/components/RankrLogoIcon";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import type { AggregatedPlayerStats } from "@/utils/riotStatsAggregation";

export interface RoleStatColumn {
  key: string;
  label: string;
  title: string;
  getValue: (p: AggregatedPlayerStats) => number | null;
  format: (value: number) => string;
}

export const ROLE_EXPORT_COLUMNS: Record<LeagueRole, RoleStatColumn[]> = {
  top: [
    {
      key: "kda",
      label: "KDA",
      title: "Kill / Death / Assist Ratio",
      getValue: (p) => p.kda,
      format: (v) => v.toFixed(2),
    },
    {
      key: "dpm",
      label: "DPM",
      title: "Damage to Champions / Min",
      getValue: (p) => p.dpm,
      format: (v) => Math.round(v).toString(),
    },
    {
      key: "csPerMin",
      label: "CS/m",
      title: "Creep Score / Min",
      getValue: (p) => p.csPerMin,
      format: (v) => v.toFixed(1),
    },
    {
      key: "avgGoldDiff15",
      label: "GD@15",
      title: "Average Gold Diff at 15 Minutes vs Lane Opponent",
      getValue: (p) => p.avgGoldDiff15,
      format: (v) => `${v >= 0 ? "+" : ""}${Math.round(v)}`,
    },
  ],
  jungle: [
    {
      key: "kda",
      label: "KDA",
      title: "Kill / Death / Assist Ratio",
      getValue: (p) => p.kda,
      format: (v) => v.toFixed(2),
    },
    {
      key: "kpPct",
      label: "KP%",
      title: "Kill Participation %",
      getValue: (p) => p.kpPct,
      format: (v) => `${Math.round(v)}%`,
    },
    {
      key: "csPerMin",
      label: "CS/m",
      title: "Creep Score / Min",
      getValue: (p) => p.csPerMin,
      format: (v) => v.toFixed(1),
    },
    {
      key: "visionPerMin",
      label: "VS/m",
      title: "Vision Score / Min",
      getValue: (p) => p.visionPerMin,
      format: (v) => v.toFixed(2),
    },
  ],
  mid: [
    {
      key: "kda",
      label: "KDA",
      title: "Kill / Death / Assist Ratio",
      getValue: (p) => p.kda,
      format: (v) => v.toFixed(2),
    },
    {
      key: "dpm",
      label: "DPM",
      title: "Damage to Champions / Min",
      getValue: (p) => p.dpm,
      format: (v) => Math.round(v).toString(),
    },
    {
      key: "csPerMin",
      label: "CS/m",
      title: "Creep Score / Min",
      getValue: (p) => p.csPerMin,
      format: (v) => v.toFixed(1),
    },
    {
      key: "damageSharePct",
      label: "DMG%",
      title: "Team Damage Share %",
      getValue: (p) => p.damageSharePct,
      format: (v) => `${Math.round(v)}%`,
    },
  ],
  bot: [
    {
      key: "kda",
      label: "KDA",
      title: "Kill / Death / Assist Ratio",
      getValue: (p) => p.kda,
      format: (v) => v.toFixed(2),
    },
    {
      key: "dpm",
      label: "DPM",
      title: "Damage to Champions / Min",
      getValue: (p) => p.dpm,
      format: (v) => Math.round(v).toString(),
    },
    {
      key: "csPerMin",
      label: "CS/m",
      title: "Creep Score / Min",
      getValue: (p) => p.csPerMin,
      format: (v) => v.toFixed(1),
    },
    {
      key: "gpm",
      label: "GPM",
      title: "Gold Earned / Min",
      getValue: (p) => p.gpm,
      format: (v) => Math.round(v).toString(),
    },
  ],
  support: [
    {
      key: "kda",
      label: "KDA",
      title: "Kill / Death / Assist Ratio",
      getValue: (p) => p.kda,
      format: (v) => v.toFixed(2),
    },
    {
      key: "kpPct",
      label: "KP%",
      title: "Kill Participation %",
      getValue: (p) => p.kpPct,
      format: (v) => `${Math.round(v)}%`,
    },
    {
      key: "visionPerMin",
      label: "VS/m",
      title: "Vision Score / Min",
      getValue: (p) => p.visionPerMin,
      format: (v) => v.toFixed(2),
    },
    {
      key: "assistsPerGame",
      label: "AST/G",
      title: "Assists per Game",
      getValue: (p) => p.assistsPerGame,
      format: (v) => v.toFixed(1),
    },
  ],
};

export function computeRankColorMap(
  players: AggregatedPlayerStats[],
  getter: (p: AggregatedPlayerStats) => number | null
): Map<string, string> {
  const map = new Map<string, string>();
  const valid = players
    .filter((p) => p.games > 0)
    .map((p) => ({
      key: p.playerKey,
      val: getter(p),
    }))
    .filter(
      (x): x is { key: string; val: number } =>
        typeof x.val === "number" && Number.isFinite(x.val)
    );

  if (valid.length === 0) return map;
  valid.sort((a, b) => b.val - a.val);
  const total = valid.length;

  for (let i = 0; i < total; i++) {
    let rank = i + 1;
    while (rank > 1 && valid[rank - 2].val === valid[i].val) {
      rank--;
    }
    const t =
      total <= 1 ? 0 : Math.min(1, Math.max(0, (rank - 1) / (total - 1)));
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
    map.set(valid[i].key, `rgb(${r}, ${g}, ${b})`);
  }
  return map;
}

interface RoleLeaderboardExportCardProps {
  role: LeagueRole;
  players: AggregatedPlayerStats[];
  leagueName: string;
  leagueLogoUrl: string | null;
  seasonName: string;
  divisionName: string;
  divisionLogoUrl: string | null;
  currentEditionName: string;
  bannerGradient: string;
}

export function RoleLeaderboardExportCard({
  role,
  players,
  leagueName,
  leagueLogoUrl,
  seasonName,
  divisionName,
  divisionLogoUrl,
  currentEditionName,
  bannerGradient,
}: RoleLeaderboardExportCardProps) {
  const roleMeta = getRoleMeta(role);
  const columns = ROLE_EXPORT_COLUMNS[role];

  const sortedPlayers = [...players].sort(
    (a, b) =>
      b.leagueRating - a.leagueRating ||
      b.games - a.games ||
      b.kda - a.kda ||
      a.displayName.localeCompare(b.displayName)
  );

  const ratingColorMap = computeRankColorMap(
    sortedPlayers,
    (p) => p.leagueRating
  );
  const colColorMaps = columns.map((col) =>
    computeRankColorMap(sortedPlayers, col.getValue)
  );

  return (
    <div
      style={{ borderRadius: "44px" }}
      className="w-full border-[6px] border-[#c89b3c]/85 rounded-[44px] overflow-hidden bg-[#171b19]"
    >
      {/* Header Banner (matches Shareable Stat Leaderboards export card) */}
      <div
        style={{ background: bannerGradient }}
        className="border-b-2 border-[#4d5652] text-white flex flex-row items-center justify-between gap-4 px-7 py-5"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {leagueLogoUrl && (
            <img
              src={leagueLogoUrl}
              alt={leagueName}
              crossOrigin="anonymous"
              className="w-16 h-12 object-contain drop-shadow shrink-0"
            />
          )}
          {divisionLogoUrl && (
            <img
              src={divisionLogoUrl}
              alt={divisionName}
              crossOrigin="anonymous"
              className="w-12 h-12 object-contain drop-shadow shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider font-bold text-[#f0c020]">
              {leagueName} ({seasonName})
            </div>
            <h2 className="wow-heading text-2xl font-extrabold text-white leading-tight truncate">
              {divisionName} {roleMeta.label} Leaderboard
            </h2>
            <div className="text-xs font-bold text-[#c7c5b8] mt-0.5">
              As of {currentEditionName}
            </div>
          </div>
        </div>

        <img
          src={roleMeta.icon}
          alt={roleMeta.label}
          crossOrigin="anonymous"
          className="w-11 h-11 object-contain opacity-90 drop-shadow shrink-0"
        />
      </div>

      {/* Leaderboard Table Body (edge-to-edge below title bar) */}
      <div className="bg-[#121614]">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_96px_68px_68px_68px_68px] items-center gap-2 px-6 py-2.5 bg-black/45 border-b border-[#c89b3c]/40 text-[11px] font-extrabold uppercase tracking-wider text-[#a6a89e]">
          <div className="text-center">#</div>
          <div>Player</div>
          <div className="text-right text-[#f0c020] flex items-center justify-end gap-1">
            <RankrLogoIcon className="w-4 h-3.5 text-[#f0c020] shrink-0" />
            <span>Rating</span>
          </div>
          {columns.map((col) => (
            <div key={col.key} className="text-right">
              {col.label}
            </div>
          ))}
        </div>

        <div className="divide-y divide-white/10">
          {sortedPlayers.map((p, idx) => {
            const rankColorClass =
              idx === 0
                ? "text-[#f0c020]"
                : idx === 1
                ? "text-[#f1f5f9]"
                : idx === 2
                ? "text-[#d97745]"
                : "text-[#717670]";
            const hasGames = p.games > 0;
            const ratingColor = hasGames
              ? ratingColorMap.get(p.playerKey) ?? "#e8e5d8"
              : "#6e7268";

            return (
              <div
                key={p.playerKey}
                className={`grid grid-cols-[40px_minmax(0,1fr)_96px_68px_68px_68px_68px] items-center gap-2 px-6 py-2.5 ${
                  idx === 0 && hasGames
                    ? "bg-[#f0c020]/[0.08]"
                    : idx % 2 === 1
                    ? "bg-white/[0.02]"
                    : ""
                }`}
              >
                  <div
                    className={`text-center text-base font-black tabular-nums ${rankColorClass}`}
                  >
                    #{idx + 1}
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.teamLogoUrl && (
                      <img
                        src={p.teamLogoUrl}
                        alt={p.teamName}
                        crossOrigin="anonymous"
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-base font-extrabold text-[#f0ede0] truncate leading-tight">
                        {p.displayName}
                      </div>
                      <div className="text-[11px] font-semibold text-[#a6a89e] truncate leading-tight">
                        {p.teamName}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{ color: ratingColor }}
                    className="text-right text-2xl font-black tabular-nums leading-none"
                  >
                    {hasGames ? p.leagueRating.toFixed(1) : "—"}
                  </div>

                  {columns.map((col, colIdx) => {
                    const val = hasGames ? col.getValue(p) : null;
                    const hasVal =
                      typeof val === "number" && Number.isFinite(val);
                    const color = hasVal
                      ? colColorMaps[colIdx].get(p.playerKey) ?? "#e8e5d8"
                      : "#6e7268";
                    return (
                      <div
                        key={col.key}
                        style={{ color }}
                        className="text-right text-sm font-bold tabular-nums"
                      >
                        {hasVal ? col.format(val) : "—"}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}

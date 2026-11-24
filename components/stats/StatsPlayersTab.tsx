"use client";

import React from "react";
import { Download, User } from "lucide-react";
import { formatSigned } from "@/utils/formatters";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import type { PlayerSortKey } from "@/utils/statsOverview";
import type { AggregatedPlayerStats } from "@/utils/riotStatsAggregation";
import type { DivisionTheme } from "@/types/database";

interface StatsPlayersTabProps {
  ddVersion: string;
  selectedDivisionTheme: DivisionTheme | null;
  roleFilter: LeagueRole | "all";
  onSelectRoleFilter: (next: LeagueRole | "all") => void;
  sortKey: PlayerSortKey;
  onSort: (nextKey: PlayerSortKey) => void;
  tablePlayers: AggregatedPlayerStats[];
  sortColorByPlayerKey: Map<string, string>;
  roleLeaderboardPlayers: AggregatedPlayerStats[];
  exportingRoleLeaderboard: boolean;
  onExportRoleLeaderboardPng: () => void;
  showAllPlayers: boolean;
  onToggleShowAllPlayers: () => void;
  onNavigatePlayer: (playerKey: string) => void;
}

export function StatsPlayersTab({
  ddVersion,
  selectedDivisionTheme,
  roleFilter,
  onSelectRoleFilter,
  sortKey,
  onSort,
  tablePlayers,
  sortColorByPlayerKey,
  roleLeaderboardPlayers,
  exportingRoleLeaderboard,
  onExportRoleLeaderboardPng,
  showAllPlayers,
  onToggleShowAllPlayers,
  onNavigatePlayer,
}: StatsPlayersTabProps) {
  return (
    <div
      style={
        selectedDivisionTheme
          ? {
              borderColor: `${selectedDivisionTheme.primary_color}66`,
              borderTopWidth: "3px",
              borderTopColor: selectedDivisionTheme.primary_color,
            }
          : undefined
      }
      className="mb-6 xp-panel overflow-hidden"
    >
      <div
        style={
          selectedDivisionTheme
            ? {
                background: `linear-gradient(90deg, ${selectedDivisionTheme.primary_color}38 0%, #121615 70%)`,
              }
            : undefined
        }
        className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2"
      >
        <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
          <User className="w-4 h-4" />
          <span>Top Players ({tablePlayers.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectRoleFilter("all")}
            className={`xp-btn text-[10px] px-2 py-1 ${
              roleFilter === "all" ? "xp-btn-primary" : ""
            }`}
          >
            All Roles
          </button>
          {LEAGUE_ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelectRoleFilter(r.key)}
              className={`xp-btn text-[10px] px-2 py-1 ${
                roleFilter === r.key ? "xp-btn-primary" : ""
              }`}
            >
              <img
                src={r.icon}
                alt={r.label}
                className="w-3.5 h-3.5 object-contain"
              />
              <span>{r.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onExportRoleLeaderboardPng}
            disabled={
              roleFilter === "all" ||
              roleLeaderboardPlayers.length === 0 ||
              exportingRoleLeaderboard
            }
            title={
              roleFilter === "all"
                ? "Select a role to export its Role Leaderboard PNG"
                : `Export ${getRoleMeta(roleFilter).label} Leaderboard PNG`
            }
            className="xp-btn xp-btn-gold text-[10px] px-2.5 py-1 flex items-center gap-1.5 ml-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {exportingRoleLeaderboard ? "Exporting..." : "Export PNG"}
            </span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-black/35 text-[10px] uppercase text-[#a6a89e] border-b border-white/10">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-2 py-2">Team</th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "games" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("games")}
                title="Games Played"
              >
                Games
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "leagueRating" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("leagueRating")}
                title="Role-normalized 0–100 Rankr Rating"
              >
                Rating
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "kda" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("kda")}
                title="Kill / Death / Assist Ratio"
              >
                KDA
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "dpm" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("dpm")}
                title="Damage to Champions / Min"
              >
                DPM
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "gpm" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("gpm")}
                title="Gold Earned / Min"
              >
                GPM
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "csPerMin" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("csPerMin")}
                title="Creep Score / Min"
              >
                CS/m
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "kpPct" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("kpPct")}
                title="Kill Participation %"
              >
                KP%
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "damageSharePct" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("damageSharePct")}
                title="Team Damage Share %"
              >
                DMG%
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "visionPerMin" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("visionPerMin")}
                title="Vision Score / Min"
              >
                VS/m
              </th>
              <th
                className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                  sortKey === "avgGoldDiff15" ? "text-[#f0c020]" : ""
                }`}
                onClick={() => onSort("avgGoldDiff15")}
                title="Average Gold Diff at 15 Minutes vs Lane Opponent"
              >
                GD@15
              </th>
              <th className="px-3 py-2" title="Most Played Champions">
                Top Champs
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(showAllPlayers ? tablePlayers : tablePlayers.slice(0, 15)).map(
              (p) => {
                const roleMeta = getRoleMeta(p.role as LeagueRole);
                const sortColor = sortColorByPlayerKey.get(p.playerKey);
                const sortCellStyle = (col: PlayerSortKey) =>
                  sortKey === col && sortColor
                    ? { color: sortColor }
                    : undefined;
                return (
                  <tr
                    key={p.playerKey}
                    onClick={
                      p.isSub ? undefined : () => onNavigatePlayer(p.playerKey)
                    }
                    className={
                      p.isSub
                        ? "bg-black/20"
                        : "hover:bg-white/5 transition cursor-pointer"
                    }
                  >
                    <td className="px-3 py-2 font-bold text-[#f0ede0] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <img
                          src={roleMeta.icon}
                          alt={roleMeta.label}
                          className="w-4 h-4 object-contain shrink-0"
                        />
                        <span>{p.displayName}</span>
                        {p.isSub && (
                          <span className="px-1 py-0.5 rounded bg-black/60 border border-white/20 text-[9px] font-bold uppercase text-[#a6a89e] shrink-0">
                            SUB
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[#c7c5b8] whitespace-nowrap">
                      {p.isSub || !p.teamName ? (
                        <span className="text-[#a6a89e]">{"\u2014"}</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {p.teamLogoUrl && (
                            <img
                              src={p.teamLogoUrl}
                              alt={p.teamName}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                          )}
                          <span>{p.teamName}</span>
                        </div>
                      )}
                    </td>
                    <td
                      style={sortCellStyle("games")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "games" ? "font-bold" : "text-[#e8e5d8]"
                      }`}
                    >
                      {p.games}
                    </td>
                    <td
                      style={sortCellStyle("leagueRating")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "leagueRating"
                          ? "font-bold"
                          : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? p.leagueRating.toFixed(1) : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("kda")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "kda" ? "font-bold" : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? p.kda.toFixed(2) : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("dpm")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "dpm" ? "font-bold" : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? Math.round(p.dpm) : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("gpm")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "gpm" ? "font-bold" : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? Math.round(p.gpm) : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("csPerMin")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "csPerMin" ? "font-bold" : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? p.csPerMin.toFixed(1) : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("kpPct")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "kpPct" ? "font-bold" : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? `${p.kpPct.toFixed(0)}%` : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("damageSharePct")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "damageSharePct"
                          ? "font-bold"
                          : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0
                        ? `${p.damageSharePct.toFixed(0)}%`
                        : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("visionPerMin")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "visionPerMin"
                          ? "font-bold"
                          : "text-[#e8e5d8]"
                      } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                    >
                      {p.games > 0 ? p.visionPerMin.toFixed(2) : "\u2014"}
                    </td>
                    <td
                      style={sortCellStyle("avgGoldDiff15")}
                      className={`px-2 py-2 text-right tabular-nums ${
                        sortKey === "avgGoldDiff15"
                          ? "font-bold"
                          : "text-[#e8e5d8]"
                      } ${
                        p.avgGoldDiff15 === null ||
                        p.avgGoldDiff15 === undefined ||
                        p.games <= 0
                          ? "text-[#a6a89e]"
                          : ""
                      }`}
                    >
                      {p.games > 0 &&
                      p.avgGoldDiff15 !== null &&
                      p.avgGoldDiff15 !== undefined
                        ? formatSigned(p.avgGoldDiff15, { round: true })
                        : "\u2014"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {p.topChampions.slice(0, 3).map((c) => (
                          <img
                            key={c.name}
                            src={getChampionIconUrl(c.name, ddVersion)}
                            alt={c.name}
                            title={`${c.name} (${c.games}G)`}
                            className="w-5 h-5 rounded border border-white/20 object-cover"
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
      {tablePlayers.length > 15 && (
        <div className="bg-[#121615] border-t border-white/10 px-3 py-2 flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#a6a89e]">
            Showing{" "}
            {showAllPlayers
              ? tablePlayers.length
              : Math.min(15, tablePlayers.length)}{" "}
            of {tablePlayers.length} players
          </span>
          <button
            type="button"
            onClick={onToggleShowAllPlayers}
            className="xp-btn text-xs"
          >
            {showAllPlayers
              ? "Show Top 15 \u25b2"
              : `Show All ${tablePlayers.length} Players \u25bc`}
          </button>
        </div>
      )}
    </div>
  );
}

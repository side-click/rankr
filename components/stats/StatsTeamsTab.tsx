"use client";

import React from "react";
import { ChevronRight, Flame } from "lucide-react";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { resolveDivisionTheme } from "@/utils/themes";
import type { AggregatedTeamStats } from "@/utils/riotStatsAggregation";

export interface StatsDivisionItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_key: string;
}

interface StatsTeamsTabProps {
  selectedDivision: StatsDivisionItem | null;
  divisions: StatsDivisionItem[];
  filteredTeams: AggregatedTeamStats[];
  activeTeams: AggregatedTeamStats[];
  basePath: string;
  onNavigateTeam: (href: string) => void;
}

export function StatsTeamsTab({
  selectedDivision,
  divisions,
  filteredTeams,
  activeTeams,
  basePath,
  onNavigateTeam,
}: StatsTeamsTabProps) {
  const divisionGroups = selectedDivision
    ? [{ division: selectedDivision, list: filteredTeams, isSingle: true }]
    : divisions.map((d) => ({
        division: d,
        isSingle: false,
        list: activeTeams
          .filter((t) => t.divisionId === d.id)
          .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999)),
      }));

  return (
    <div className="space-y-5">
      {divisionGroups.map(({ division, list, isSingle }) => {
        const divTheme = resolveDivisionTheme(division.theme_key);
        return (
          <div
            key={division.id}
            style={{
              borderColor: `${divTheme.primary_color}66`,
              borderTopWidth: "3px",
              borderTopColor: divTheme.primary_color,
            }}
            className="xp-panel overflow-hidden"
          >
            <div
              style={{
                background: `linear-gradient(90deg, ${divTheme.primary_color}38 0%, #121615 70%)`,
              }}
              className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2"
            >
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                <TeamGroupIcon className="w-4 h-4" />
                <span>
                  {isSingle ? "Team Standings" : `${division.name} Standings`}
                </span>
              </h2>
              <span className="text-[11px] text-[#a6a89e]">
                Click any team for full scouting sheet
              </span>
            </div>

            <div className="p-3.5 space-y-2.5">
              {list.map((t) => {
                const gWins = t.wins;
                const gLosses = Math.max(0, t.games - t.wins);
                const sWins = t.seriesWins ?? gWins;
                const sLosses = t.seriesLosses ?? gLosses;
                return (
                  <button
                    key={t.teamId}
                    type="button"
                    onClick={() =>
                      onNavigateTeam(
                        `${basePath}/team/${encodeURIComponent(t.teamId)}`
                      )
                    }
                    className="group w-full text-left rounded-lg border border-white/15 bg-black/40 hover:!bg-[#f0c020]/10 hover:!border-[#f0c020]/80 hover:shadow-[0_0_18px_rgba(240,192,32,0.18)] transition-all duration-150 px-3 py-3 sm:px-8 sm:py-6 flex items-center justify-between gap-2.5 sm:gap-6 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 sm:gap-7 min-w-0 flex-1">
                      <span className="text-base sm:text-3xl tabular-nums font-black text-[#f0c020] w-7 sm:w-14 text-center shrink-0">
                        {t.seed != null ? `#${t.seed}` : "—"}
                      </span>
                      {t.logoUrl && (
                        <img
                          src={t.logoUrl}
                          alt={t.teamName}
                          className="w-9 h-9 sm:w-16 sm:h-16 object-contain shrink-0 group-hover:scale-105 transition-transform"
                        />
                      )}
                      <span className="text-sm sm:text-2xl md:text-3xl font-extrabold text-[#f0ede0] group-hover:text-[#f0c020] transition-colors truncate">
                        {t.teamName}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-10 shrink-0">
                      <div
                        className={`text-center shrink-0 ${
                          (t.seriesStreak ?? 0) >= 2
                            ? "w-10 sm:w-14"
                            : "hidden sm:block sm:w-14"
                        }`}
                      >
                        {(t.seriesStreak ?? 0) >= 2 && (
                          <>
                            <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
                              Streak
                            </div>
                            <div className="inline-flex items-center justify-center gap-0.5 sm:gap-1 text-base sm:text-2xl tabular-nums font-black text-[#fb923c] mt-0.5">
                              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-[#fb923c] fill-[#fb923c]/25 shrink-0" />
                              <span>{t.seriesStreak}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
                          Series
                        </div>
                        <div
                          className={`text-base sm:text-3xl tabular-nums font-black ${
                            t.games <= 0
                              ? "text-[#a6a89e]"
                              : sWins >= sLosses
                              ? "text-[#7cd438]"
                              : "text-[#ff857a]"
                          }`}
                        >
                          {t.games > 0 ? `${sWins}-${sLosses}` : "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
                          Games
                        </div>
                        <div
                          className={`text-sm sm:text-xl tabular-nums font-bold mt-0.5 sm:mt-1 ${
                            t.games <= 0
                              ? "text-[#a6a89e]"
                              : "text-[#f0ede0]"
                          }`}
                        >
                          {t.games > 0 ? `${gWins}-${gLosses}` : "—"}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7 self-center text-[#a6a89e] group-hover:text-[#f0c020] group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Flame, Trophy } from "lucide-react";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { resolveDivisionTheme } from "@/utils/themes";
import type {
  AggregatedTeamStats,
  StatsStageBucket,
} from "@/utils/riotStatsAggregation";
import type { PlayoffSeriesMatchup } from "@/utils/scdlSheetStats";
import type {
  DivisionPlayoffBracket,
  PlayoffBracketMatchSlot,
} from "@/types/database";

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
  seasonSlug?: string | null;
  stageBucket?: StatsStageBucket;
  playoffSeries?: PlayoffSeriesMatchup[];
  playoffBracket?: DivisionPlayoffBracket | null;
  onNavigateTeam: (href: string) => void;
}

export function StatsTeamsTab({
  selectedDivision,
  filteredTeams,
  activeTeams,
  basePath,
  seasonSlug,
  stageBucket = "regular",
  playoffSeries = [],
  playoffBracket = null,
  onNavigateTeam,
}: StatsTeamsTabProps) {
  if (!selectedDivision) {
    return (
      <div className="xp-panel p-6 text-center text-xs text-[#a6a89e] mb-6">
        Select a specific division above to view division team standings and scouting sheets.
      </div>
    );
  }

  const divTheme = resolveDivisionTheme(selectedDivision.theme_key);
  const divPlayoffSeries = playoffSeries.filter(
    (s) => s.divisionId === selectedDivision.id
  );

  if (stageBucket === "playoffs") {
    const seriesHref = (seriesKey: string) => {
      const qp = new URLSearchParams();
      if (seasonSlug) qp.set("season", seasonSlug);
      const qs = qp.toString();
      return `${basePath}/match/${encodeURIComponent(seriesKey)}${
        qs ? `?${qs}` : ""
      }`;
    };

    const teamHref = (teamId: string) =>
      `${basePath}/team/${encodeURIComponent(teamId)}${
        seasonSlug ? `?season=${encodeURIComponent(seasonSlug)}` : ""
      }`;

    interface ResolvedBracketSide {
      teamId: string | null;
      name: string;
      logo: string | null;
      seed: number | null;
      wins: number | null;
      won: boolean;
      isPlaceholder?: boolean;
    }

    interface ResolvedBracketCard {
      key: string;
      label?: string;
      seriesKey: string | null;
      sideA: ResolvedBracketSide;
      sideB: ResolvedBracketSide;
    }

    let rounds: {
      roundLabel: string;
      roundOrder: number;
      cards: ResolvedBracketCard[];
    }[] = [];

    if (playoffBracket && playoffBracket.matches.length > 0) {
      const teamLookup = new Map<
        string,
        { teamId: string; teamName: string; logoUrl: string | null; seed: number | null }
      >();
      for (const sd of playoffBracket.seeds) {
        teamLookup.set(sd.teamId, {
          teamId: sd.teamId,
          teamName: sd.teamName,
          logoUrl: sd.logoUrl ?? null,
          seed: sd.seed,
        });
      }
      for (const t of [...activeTeams, ...filteredTeams]) {
        if (t.divisionId !== selectedDivision.id) continue;
        const existing = teamLookup.get(t.teamId);
        teamLookup.set(t.teamId, {
          teamId: t.teamId,
          teamName: t.teamName,
          logoUrl: t.logoUrl ?? existing?.logoUrl ?? null,
          seed: existing?.seed ?? t.seed ?? null,
        });
      }

      const matchById = new Map<string, PlayoffBracketMatchSlot>();
      for (const m of playoffBracket.matches) {
        matchById.set(m.id, m);
      }

      const sortedSlots = [...playoffBracket.matches].sort(
        (a, b) => a.roundOrder - b.roundOrder
      );
      const winnerByMatchId = new Map<
        string,
        { teamId: string | null; teamName: string; logoUrl: string | null; seed: number | null }
      >();

      const roundsMap = new Map<
        string,
        { roundLabel: string; roundOrder: number; cards: ResolvedBracketCard[] }
      >();

      const resolveSlotSide = (
        directTeamId: string | null | undefined,
        directSeed: number | null | undefined,
        sourceMatchId: string | null | undefined
      ) => {
        if (directTeamId) {
          const info = teamLookup.get(directTeamId);
          return {
            teamId: directTeamId,
            name: info?.teamName ?? directTeamId,
            logo: info?.logoUrl ?? null,
            seed: directSeed ?? info?.seed ?? null,
            isPlaceholder: false,
          };
        }
        if (sourceMatchId) {
          const prevWinner = winnerByMatchId.get(sourceMatchId);
          if (prevWinner) {
            return {
              teamId: prevWinner.teamId,
              name: prevWinner.teamName,
              logo: prevWinner.logoUrl,
              seed: prevWinner.seed,
              isPlaceholder: false,
            };
          }
          const srcLabel = matchById.get(sourceMatchId)?.label ?? "Previous Match";
          return {
            teamId: null,
            name: `Winner of ${srcLabel}`,
            logo: null,
            seed: null,
            isPlaceholder: true,
          };
        }
        return {
          teamId: null,
          name: "TBD",
          logo: null,
          seed: directSeed ?? null,
          isPlaceholder: true,
        };
      };

      const matchesSide = (
        side: { teamId: string | null; name: string },
        seriesTeamId: string | null,
        seriesTeamName: string
      ) => {
        if (side.teamId && seriesTeamId && side.teamId === seriesTeamId) {
          return true;
        }
        return (
          side.name.trim().toLowerCase() === seriesTeamName.trim().toLowerCase()
        );
      };

      for (const slot of sortedSlots) {
        const resA = resolveSlotSide(slot.teamAId, slot.teamASeed, slot.sourceMatchA);
        const resB = resolveSlotSide(slot.teamBId, slot.teamBSeed, slot.sourceMatchB);

        let matchedSeries: PlayoffSeriesMatchup | null = null;
        if (!resA.isPlaceholder && !resB.isPlaceholder) {
          matchedSeries =
            divPlayoffSeries.find(
              (s) =>
                (matchesSide(resA, s.teamAId, s.teamAName) &&
                  matchesSide(resB, s.teamBId, s.teamBName)) ||
                (matchesSide(resA, s.teamBId, s.teamBName) &&
                  matchesSide(resB, s.teamAId, s.teamAName))
            ) ?? null;
        }

        let winsA: number | null = null;
        let winsB: number | null = null;
        let wonA = false;
        let wonB = false;

        if (matchedSeries) {
          const aIsSeriesA = matchesSide(
            resA,
            matchedSeries.teamAId,
            matchedSeries.teamAName
          );
          winsA = aIsSeriesA ? matchedSeries.teamAWins : matchedSeries.teamBWins;
          winsB = aIsSeriesA ? matchedSeries.teamBWins : matchedSeries.teamAWins;
          if (matchedSeries.winnerTeamName) {
            const winLower = matchedSeries.winnerTeamName.trim().toLowerCase();
            wonA = winLower === resA.name.trim().toLowerCase();
            wonB = winLower === resB.name.trim().toLowerCase();
            if (wonA) {
              winnerByMatchId.set(slot.id, {
                teamId: resA.teamId,
                teamName: resA.name,
                logoUrl: resA.logo,
                seed: resA.seed,
              });
            } else if (wonB) {
              winnerByMatchId.set(slot.id, {
                teamId: resB.teamId,
                teamName: resB.name,
                logoUrl: resB.logo,
                seed: resB.seed,
              });
            }
          }
        }

        const bucket = roundsMap.get(slot.roundLabel) ?? {
          roundLabel: slot.roundLabel,
          roundOrder: slot.roundOrder,
          cards: [],
        };
        bucket.cards.push({
          key: slot.id,
          label: slot.label,
          seriesKey: matchedSeries?.seriesKey ?? null,
          sideA: {
            ...resA,
            wins: winsA,
            won: wonA,
          },
          sideB: {
            ...resB,
            wins: winsB,
            won: wonB,
          },
        });
        roundsMap.set(slot.roundLabel, bucket);
      }

      rounds = [...roundsMap.values()].sort(
        (a, b) => a.roundOrder - b.roundOrder
      );
    } else if (divPlayoffSeries.length > 0) {
      const roundsMap = new Map<
        string,
        {
          roundLabel: string;
          roundOrder: number;
          cards: ResolvedBracketCard[];
        }
      >();
      for (const m of divPlayoffSeries) {
        const existing = roundsMap.get(m.roundLabel) ?? {
          roundLabel: m.roundLabel,
          roundOrder: m.roundOrder,
          cards: [],
        };
        const aWon =
          m.winnerTeamName?.toLowerCase() === m.teamAName.toLowerCase();
        const bWon =
          m.winnerTeamName?.toLowerCase() === m.teamBName.toLowerCase();
        existing.cards.push({
          key: m.seriesKey,
          label: m.roundLabel,
          seriesKey: m.seriesKey,
          sideA: {
            teamId: m.teamAId,
            name: m.teamAName,
            logo: m.teamALogoUrl,
            seed: m.teamASeed,
            wins: m.teamAWins,
            won: aWon,
          },
          sideB: {
            teamId: m.teamBId,
            name: m.teamBName,
            logo: m.teamBLogoUrl,
            seed: m.teamBSeed,
            wins: m.teamBWins,
            won: bWon,
          },
        });
        roundsMap.set(m.roundLabel, existing);
      }
      rounds = [...roundsMap.values()].sort(
        (a, b) => a.roundOrder - b.roundOrder
      );
    }

    return (
      <div className="space-y-5">
        <div
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
              <Trophy className="w-4 h-4" />
              <span>{selectedDivision.name} Playoff Bracket</span>
            </h2>
            <span className="text-[11px] text-[#a6a89e]">
              Click any team for full scouting sheet &middot; Click any series for draft &amp; box score
            </span>
          </div>

          <div className="p-3 sm:p-6">
            {rounds.length > 0 ? (
              <div className="overflow-x-auto pb-1">
                <div className="mx-auto w-max flex flex-row items-stretch">
                  {rounds.map((r, rIdx) => {
                    const nextRound = rounds[rIdx + 1];
                    const colWidthClass =
                      rounds.length <= 2
                        ? "w-[225px] sm:w-[310px] lg:w-[370px]"
                        : "w-[215px] sm:w-[270px] lg:w-[310px]";
                    return (
                      <React.Fragment key={r.roundLabel}>
                        <div
                          className={`flex flex-col justify-around gap-3 sm:gap-5 lg:gap-6 shrink-0 ${colWidthClass}`}
                        >
                        {r.cards.map((card) => {
                          const clickableSeries = Boolean(card.seriesKey);
                          return (
                            <div
                              key={card.key}
                              className="rounded-lg border border-white/15 bg-black/45 overflow-hidden"
                            >
                              {card.label && (
                                <div className="px-2.5 sm:px-3.5 py-1.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#a6a89e]">
                                  <span className="truncate">{card.label}</span>
                                  {clickableSeries && card.seriesKey ? (
                                    <Link
                                      href={seriesHref(card.seriesKey)}
                                      className="text-[#c89b3c] hover:text-[#f0c020] hover:underline transition shrink-0"
                                    >
                                      Draft &amp; Box Score &rarr;
                                    </Link>
                                  ) : (
                                    <span className="shrink-0">Upcoming</span>
                                  )}
                                </div>
                              )}
                              {[card.sideA, card.sideB].map((side, idx) => (
                                <div
                                  key={`${card.key}-${idx}`}
                                  className={`flex items-center justify-between gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 lg:py-3.5 ${
                                    idx === 0 ? "border-b border-white/10" : ""
                                  } ${side.won ? "bg-[#f0c020]/10" : ""}`}
                                >
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <span className="text-[11px] sm:text-sm lg:text-base font-black text-[#c89b3c] w-5 sm:w-7 text-center shrink-0 tabular-nums">
                                      {side.seed != null ? `#${side.seed}` : "—"}
                                    </span>
                                    {side.logo && (
                                      <img
                                        src={side.logo}
                                        alt={side.name}
                                        className="w-5 h-5 sm:w-8 sm:h-8 lg:w-10 lg:h-10 object-contain shrink-0"
                                      />
                                    )}
                                    {side.teamId ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onNavigateTeam(teamHref(side.teamId!))
                                        }
                                        className={`text-xs sm:text-base lg:text-lg font-extrabold truncate text-left hover:text-[#f0c020] hover:underline transition cursor-pointer ${
                                          side.won
                                            ? "text-[#f0c020]"
                                            : "text-[#f0ede0]"
                                        }`}
                                      >
                                        {side.name}
                                      </button>
                                    ) : (
                                      <span
                                        className={`text-xs sm:text-sm lg:text-base truncate ${
                                          side.isPlaceholder
                                            ? "italic text-[#a6a89e]"
                                            : side.won
                                            ? "font-extrabold text-[#f0c020]"
                                            : "font-extrabold text-[#f0ede0]"
                                        }`}
                                      >
                                        {side.name}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`text-sm sm:text-lg lg:text-2xl font-black tabular-nums shrink-0 ${
                                      side.won
                                        ? "text-[#7cd438]"
                                        : "text-[#a6a89e]"
                                    }`}
                                  >
                                    {side.wins != null ? side.wins : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {nextRound && (
                        <div
                          aria-hidden="true"
                          className="flex flex-col justify-around shrink-0 w-6 sm:w-10 lg:w-14"
                        >
                          {nextRound.cards.map((nc) =>
                            nextRound.cards.length === r.cards.length ? (
                              <div
                                key={`conn-${nc.key}`}
                                className="flex items-center flex-1"
                              >
                                <div className="w-full border-t-2 border-white/20" />
                              </div>
                            ) : (
                              <div
                                key={`conn-${nc.key}`}
                                className="flex items-center flex-1"
                              >
                                <div className="w-1/2 h-1/2 border-t-2 border-b-2 border-r-2 border-white/20 rounded-r-sm" />
                                <div className="w-1/2 border-t-2 border-white/20" />
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-[#a6a89e] py-3">
                No playoff bracket configured for {selectedDivision.name} yet — confirm seeds in Admin or add playoff games to the stats sheet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const divisionGroups = [
    { division: selectedDivision, list: filteredTeams, isSingle: true },
  ];

  return (
    <div className="space-y-5">
      {divisionGroups.map(({ division, list }) => {
        const theme = resolveDivisionTheme(division.theme_key);
        return (
          <div
            key={division.id}
            style={{
              borderColor: `${theme.primary_color}66`,
              borderTopWidth: "3px",
              borderTopColor: theme.primary_color,
            }}
            className="xp-panel overflow-hidden"
          >
            <div
              style={{
                background: `linear-gradient(90deg, ${theme.primary_color}38 0%, #121615 70%)`,
              }}
              className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2"
            >
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                <TeamGroupIcon className="w-4 h-4" />
                <span>
                  {divPlayoffSeries.length > 0
                    ? "Regular Season Standings"
                    : "Team Standings"}
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
                    className="group w-full text-left rounded-lg border border-white/15 bg-black/40 hover:!bg-[#f0c020]/10 hover:!border-[#f0c020]/80 hover:shadow-[0_0_18px_rgba(240,192,32,0.18)] transition-all duration-150 px-2.5 py-2.5 sm:px-8 sm:py-6 flex items-center justify-between gap-2 sm:gap-6 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-7 min-w-0 flex-1">
                      <span className="text-sm sm:text-3xl tabular-nums font-black text-[#f0c020] w-6 sm:w-14 text-center shrink-0">
                        {t.seed != null ? `#${t.seed}` : "—"}
                      </span>
                      {t.logoUrl && (
                        <img
                          src={t.logoUrl}
                          alt={t.teamName}
                          className="w-8 h-8 sm:w-16 sm:h-16 object-contain shrink-0 group-hover:scale-105 transition-transform"
                        />
                      )}
                      <span className="text-[13px] sm:text-2xl md:text-3xl font-extrabold text-[#f0ede0] group-hover:text-[#f0c020] transition-colors truncate">
                        {t.teamName}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 sm:gap-10 shrink-0">
                      <div
                        className={`flex flex-col items-center shrink-0 ${
                          (t.seriesStreak ?? 0) >= 2
                            ? "w-8 sm:w-14"
                            : "hidden sm:flex sm:w-14"
                        }`}
                      >
                        {(t.seriesStreak ?? 0) >= 2 && (
                          <>
                            <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wider leading-none text-[#a6a89e]">
                              <span className="sm:hidden">Strk</span>
                              <span className="hidden sm:inline">Streak</span>
                            </div>
                            <div className="h-5 sm:h-8 flex items-center justify-center gap-0.5 sm:gap-1 text-sm sm:text-2xl tabular-nums font-black leading-none text-[#fb923c] mt-1">
                              <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#fb923c] fill-[#fb923c]/25 shrink-0" />
                              <span>{t.seriesStreak}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wider leading-none text-[#a6a89e]">
                          <span className="sm:hidden">Rec</span>
                          <span className="hidden sm:inline">Series</span>
                        </div>
                        <div
                          className={`h-5 sm:h-8 flex items-center text-sm sm:text-3xl tabular-nums font-black leading-none mt-1 ${
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
                      <div className="flex flex-col items-center">
                        <div className="text-[9px] sm:text-xs font-bold uppercase tracking-wider leading-none text-[#a6a89e]">
                          <span className="sm:hidden">Gms</span>
                          <span className="hidden sm:inline">Games</span>
                        </div>
                        <div
                          className={`h-5 sm:h-8 flex items-center text-xs sm:text-lg tabular-nums font-bold leading-none mt-1 ${
                            t.games <= 0
                              ? "text-[#a6a89e]"
                              : "text-[#f0ede0]"
                          }`}
                        >
                          {t.games > 0 ? `${gWins}-${gLosses}` : "—"}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 sm:w-7 sm:h-7 self-center text-[#a6a89e] group-hover:text-[#f0c020] group-hover:translate-x-1 transition-all" />
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

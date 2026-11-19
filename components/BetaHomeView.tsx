"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Crown,
  Eye,
  ListOrdered,
  Swords,
  Trophy,
} from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { RecentBallotsPanel } from "@/components/RecentBallotsPanel";
import { getRankColor } from "@/utils/rankColors";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import type { BetaHomeData } from "@/utils/betaHomeData";

const FOCUS_STORAGE_KEY = "rankr_focused_season";
const FOCUS_COOKIE_NAME = "rankr_focused_season";

export function BetaHomeView({ data }: { data: BetaHomeData }) {
  const router = useRouter();
  const focusedSlug = data.focusedSeason?.slug ?? "";

  useEffect(() => {
    try {
      if (focusedSlug) {
        localStorage.setItem(FOCUS_STORAGE_KEY, focusedSlug);
      }
    } catch {}
  }, [focusedSlug]);

  function setFocus(slug: string) {
    try {
      if (slug) {
        localStorage.setItem(FOCUS_STORAGE_KEY, slug);
        document.cookie = `${FOCUS_COOKIE_NAME}=${encodeURIComponent(
          slug
        )}; path=/; max-age=2592000; SameSite=Lax`;
      } else {
        localStorage.removeItem(FOCUS_STORAGE_KEY);
        document.cookie = `${FOCUS_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      }
    } catch {}
    router.push(slug ? `/?season=${encodeURIComponent(slug)}` : "/");
  }

  const qSeason = focusedSlug ? `?season=${encodeURIComponent(focusedSlug)}` : "";
  const statsHref = `/stats${qSeason}`;
  const consensusHref = `/consensus${qSeason}`;
  const rankHref = `/rank${qSeason}`;
  const browseHref = `/browse${qSeason}`;

  const shouldGlowFocus = !focusedSlug && data.liveSeasons.length > 1;

  return (
    <div className="space-y-5">
      {/* 1. Top Row: Start Menu (left, stacked in navbar order) + Seasons Directory (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <RetroWindow title="Start Menu" theme="scdl" className="h-full">
            <div className="space-y-2.5">
              <Link
                href={rankHref}
                className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
              >
                <ListOrdered className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                    Create New
                  </div>
                  <div className="text-xs text-[#a6a89e] mt-0.5">
                    Build and share power rankings and tier lists
                  </div>
                </div>
              </Link>

              <Link
                href={browseHref}
                className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
              >
                <Eye className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                    Browse Rankings
                  </div>
                  <div className="text-xs text-[#a6a89e] mt-0.5">
                    Explore everything published on Rankr
                  </div>
                </div>
              </Link>

              <Link
                href={consensusHref}
                className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
              >
                <Trophy className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                    Consensus
                  </div>
                  <div className="text-xs text-[#a6a89e] mt-0.5">
                    Find common ground through aggregated opinion
                  </div>
                </div>
              </Link>

              <Link
                href={statsHref}
                className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
              >
                <BarChart3 className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                    Stats
                  </div>
                  <div className="text-xs text-[#a6a89e] mt-0.5">
                    Leaderboards, standings, scouting sheets and more
                  </div>
                </div>
              </Link>
            </div>
          </RetroWindow>
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <RetroWindow title="Seasons Directory" theme="scdl" className="h-full">
            <div className="space-y-4">
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#7cd438]">
                  Live Seasons
                </div>
                {data.liveSeasons.length === 0 ? (
                  <div className="xp-inset p-4 text-xs text-[#a6a89e]">
                    No live seasons.
                  </div>
                ) : (
                  data.liveSeasons.map((season) => (
                    <div key={season.id} className="xp-panel p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {season.leagueLogoUrl && (
                            <img
                              src={season.leagueLogoUrl}
                              alt={season.leagueName}
                              className="w-9 h-9 object-contain shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase font-bold text-[#a6a89e] truncate">
                              {season.leagueName}
                            </div>
                            <div className="text-sm font-bold text-[#f0ede0]">
                              {season.name}{" "}
                              <span className="text-xs font-normal text-[#a6a89e]">
                                ({season.playerCount} players)
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFocus(
                              focusedSlug === season.slug ? "" : season.slug
                            )
                          }
                          className={`xp-btn text-xs shrink-0 ${
                            focusedSlug === season.slug
                              ? "xp-btn-primary"
                              : shouldGlowFocus
                              ? "xp-btn-gold shadow-[0_0_14px_rgba(240,192,32,0.5)] animate-pulse"
                              : ""
                          }`}
                        >
                          {focusedSlug === season.slug ? "Focused ✓" : "Focus"}
                        </button>
                      </div>

                      {season.divisions.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {season.divisions.map((div) => (
                            <Link
                              key={div.id}
                              href={`/browse?season=${encodeURIComponent(
                                season.slug
                              )}&division=${encodeURIComponent(div.slug)}`}
                              style={{ borderLeftColor: div.primaryColor }}
                              className="xp-inset p-2.5 border-l-4 flex items-center gap-2.5 hover:!border-[#f0c020]/70 hover:!bg-[#f0c020]/10 hover:shadow-[0_0_12px_rgba(240,192,32,0.2)] transition-all"
                            >
                              {div.logoUrl && (
                                <img
                                  src={div.logoUrl}
                                  alt={div.name}
                                  className="w-8 h-8 object-contain shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <div
                                  style={{ color: div.primaryColor }}
                                  className="text-xs font-extrabold truncate"
                                >
                                  {div.name}
                                </div>
                                <div className="text-[11px] text-[#a6a89e]">
                                  {div.teamCount} teams
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
                  Past Seasons
                </div>
                {data.archivedSeasons.length === 0 ? (
                  <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                    No past seasons yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.archivedSeasons.map((season) => (
                      <div
                        key={season.id}
                        className="xp-panel p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase font-bold text-[#a6a89e] truncate">
                            {season.leagueName}
                          </div>
                          <div className="text-xs font-bold text-[#f0ede0] truncate">
                            {season.name}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFocus(
                              focusedSlug === season.slug ? "" : season.slug
                            )
                          }
                          className={`xp-btn text-xs shrink-0 ${
                            focusedSlug === season.slug
                              ? "xp-btn-primary"
                              : shouldGlowFocus
                              ? "xp-btn-gold shadow-[0_0_14px_rgba(240,192,32,0.5)] animate-pulse"
                              : ""
                          }`}
                        >
                          {focusedSlug === season.slug ? "Focused ✓" : "Focus"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </RetroWindow>
        </div>
      </div>

      {/* 2. League Stats */}
      {(data.recentMatches.length > 0 ||
        data.divisionStandings.length > 0 ||
        data.divisionTopPerformers.length > 0) && (
        <RetroWindow title="League Stats" theme="scdl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Col: Division Standings (top) + Division Top Performers (bottom) */}
            <div className="lg:col-span-7 space-y-4">
              {data.divisionStandings.length > 0 && (
                <div className="space-y-2.5">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                    Division Standings (Top 4)
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.divisionStandings.map((div) => (
                      <div
                        key={div.divisionId}
                        style={{
                          borderColor: `${div.primaryColor}55`,
                          borderTopColor: div.primaryColor,
                          background: `linear-gradient(135deg, ${div.primaryColor}26 0%, #121615 65%)`,
                        }}
                        className="xp-panel p-3 border-t-2 space-y-2"
                      >
                        <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
                          {div.logoUrl && (
                            <img
                              src={div.logoUrl}
                              alt={div.divisionName}
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          )}
                          <span
                            style={{ color: div.primaryColor }}
                            className="text-xs font-extrabold uppercase tracking-wider truncate"
                          >
                            {div.divisionName}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {div.teams.map((t, idx) => {
                            const leader = div.teams[0];
                            const isLeader =
                              idx === 0 ||
                              (Boolean(leader) &&
                                t.seriesWins === leader.seriesWins &&
                                t.seriesLosses === leader.seriesLosses);
                            return (
                              <Link
                                key={t.teamId}
                                href={`/stats/team/${encodeURIComponent(t.teamId)}`}
                                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border transition text-xs ${
                                  isLeader
                                    ? "bg-[#f0c020]/10 border-[#f0c020]/70 shadow-[0_0_12px_rgba(240,192,32,0.28)] hover:bg-[#f0c020]/15"
                                    : "bg-black/30 border-white/10 hover:bg-[#f0c020]/10 hover:border-[#f0c020]/50"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 text-center font-bold text-[#f0c020] tabular-nums shrink-0">
                                    #{t.seed ?? idx + 1}
                                  </span>
                                  {t.logoUrl && (
                                    <img
                                      src={t.logoUrl}
                                      alt={t.teamName}
                                      className="w-5 h-5 object-contain shrink-0"
                                    />
                                  )}
                                  <span className="font-bold text-[#f0ede0] truncate">
                                    {t.teamName}
                                  </span>
                                </div>
                                <span
                                  className={`font-bold tabular-nums shrink-0 ${
                                    t.seriesWins >= t.seriesLosses
                                      ? "text-[#7cd438]"
                                      : "text-[#ff857a]"
                                  }`}
                                >
                                  {t.seriesWins}-{t.seriesLosses}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.divisionTopPerformers.length > 0 && (
                <div className="space-y-2.5">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Top Performers (Rankr Rating)</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.divisionTopPerformers.map((div) => (
                      <div
                        key={div.divisionId}
                        style={{
                          borderColor: `${div.primaryColor}55`,
                          borderTopColor: div.primaryColor,
                          background: `linear-gradient(135deg, ${div.primaryColor}26 0%, #121615 65%)`,
                        }}
                        className="xp-panel p-3 border-t-2 space-y-2"
                      >
                        <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
                          {div.logoUrl && (
                            <img
                              src={div.logoUrl}
                              alt={div.divisionName}
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          )}
                          <span
                            style={{ color: div.primaryColor }}
                            className="text-xs font-extrabold uppercase tracking-wider truncate"
                          >
                            {div.divisionName}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {div.players.map((p, idx) => {
                            const roleMeta = getRoleMeta(p.role as LeagueRole);
                            const topRating = div.players[0]?.rating;
                            const isLeader =
                              idx === 0 ||
                              (topRating !== undefined &&
                                p.rating.toFixed(1) === topRating.toFixed(1));
                            return (
                              <Link
                                key={p.playerKey}
                                href={`/stats/player/${encodeURIComponent(
                                  p.playerKey
                                )}`}
                                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border transition text-xs ${
                                  isLeader
                                    ? "bg-[#f0c020]/10 border-[#f0c020]/70 shadow-[0_0_12px_rgba(240,192,32,0.28)] hover:bg-[#f0c020]/15"
                                    : "bg-black/30 border-white/10 hover:bg-[#f0c020]/10 hover:border-[#f0c020]/50"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-4 font-extrabold text-[#f0c020] tabular-nums shrink-0">
                                    {idx + 1}
                                  </span>
                                  <img
                                    src={roleMeta.icon}
                                    alt={roleMeta.label}
                                    className="w-3.5 h-3.5 object-contain shrink-0"
                                  />
                                  {p.teamLogoUrl && (
                                    <img
                                      src={p.teamLogoUrl}
                                      alt={p.teamName}
                                      className="w-4 h-4 object-contain shrink-0"
                                    />
                                  )}
                                  <span className="font-bold text-[#f0ede0] truncate">
                                    {p.displayName}
                                  </span>
                                </div>
                                <span className="font-black text-[#7cd438] tabular-nums shrink-0">
                                  {p.rating.toFixed(1)}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: Vertically Stacked Recent Match Results */}
            {data.recentMatches.length > 0 && (
              <div className="lg:col-span-5 space-y-2.5">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" />
                  <span>Recent Match Results</span>
                </h2>
                <div className="space-y-2.5">
                  {data.recentMatches.map((m) => (
                    <Link
                      key={m.seriesKey}
                      href={`/stats/match/${encodeURIComponent(m.seriesKey)}`}
                      style={{
                        borderLeftColor: m.divisionColor,
                        background: `linear-gradient(90deg, ${m.divisionColor}24 0%, #121615 55%)`,
                      }}
                      className="xp-panel p-3 border-l-4 hover:brightness-125 hover:!border-[#f0c020]/80 hover:shadow-[0_0_14px_rgba(240,192,32,0.22)] transition-all grid grid-cols-3 items-center gap-2"
                    >
                      <div className="flex flex-col items-center text-center gap-1 min-w-0">
                        {m.teamALogoUrl && (
                          <img
                            src={m.teamALogoUrl}
                            alt={m.teamA}
                            className="w-9 h-9 object-contain"
                          />
                        )}
                        <span
                          className={`text-xs font-bold truncate w-full ${
                            m.teamAWins > m.teamBWins
                              ? "text-[#7cd438]"
                              : "text-[#e8e5d8]"
                          }`}
                        >
                          {m.teamA}
                        </span>
                      </div>

                      <div className="flex flex-col items-center text-center space-y-0.5">
                        {m.divisionName && (
                          <span
                            style={{ color: m.divisionColor }}
                            className="text-[10px] font-extrabold uppercase tracking-wider leading-tight"
                          >
                            {m.divisionName}
                          </span>
                        )}
                        <span className="text-xl font-black text-[#f0c020] tabular-nums leading-none">
                          {m.teamAWins} - {m.teamBWins}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-[#8e9286]">
                          {m.roundLabel}
                        </span>
                      </div>

                      <div className="flex flex-col items-center text-center gap-1 min-w-0">
                        {m.teamBLogoUrl && (
                          <img
                            src={m.teamBLogoUrl}
                            alt={m.teamB}
                            className="w-9 h-9 object-contain"
                          />
                        )}
                        <span
                          className={`text-xs font-bold truncate w-full ${
                            m.teamBWins > m.teamAWins
                              ? "text-[#7cd438]"
                              : "text-[#e8e5d8]"
                          }`}
                        >
                          {m.teamB}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-3">
            <Link href={statsHref} className="xp-btn text-xs">
              <BarChart3 className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
              <span>Full Stats Dashboard</span>
            </Link>
          </div>
        </RetroWindow>
      )}

      {/* 3. Consensus Power Rankings Snapshot */}
      {data.consensusSnapshots.length > 0 && (
        <RetroWindow title="Consensus Power Rankings" theme="scdl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.consensusSnapshots.map((snap) => (
              <div
                key={`${snap.seasonSlug}-${snap.divisionSlug}`}
                className="rounded-2xl border-2 border-[#c89b3c]/80 overflow-hidden bg-[#181e1c] shadow-lg"
              >
                <div
                  style={{
                    background: `linear-gradient(135deg, ${snap.primaryColor}66 0%, #121615 72%)`,
                  }}
                  className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#c89b3c]/45"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {snap.divisionLogoUrl && (
                      <img
                        src={snap.divisionLogoUrl}
                        alt={snap.divisionName}
                        className="w-7 h-7 object-contain shrink-0 drop-shadow"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="wow-heading text-sm font-extrabold text-white tracking-wide truncate">
                        {snap.divisionName}
                      </div>
                      <div className="text-[11px] font-semibold text-[#d6d3c4]">
                        {snap.seasonName} • {snap.editionName} •{" "}
                        {snap.submissionCount}{" "}
                        {snap.submissionCount === 1 ? "ranking" : "rankings"}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/consensus?season=${encodeURIComponent(
                      snap.seasonSlug
                    )}&division=${encodeURIComponent(snap.divisionSlug)}`}
                    className="xp-btn text-xs shrink-0"
                  >
                    <Trophy className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
                    <span>View All</span>
                  </Link>
                </div>

                <div className="divide-y divide-white/10">
                  {snap.topTeams.map((t, idx) => {
                    const rankColor = getRankColor(idx, 8);
                    return (
                      <div
                        key={`${snap.divisionSlug}-${t.rank}-${t.teamName}`}
                        style={{ backgroundColor: rankColor.rowBg }}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex flex-col items-center shrink-0">
                            {idx === 0 && (
                              <Crown className="w-3 h-3 text-[#f0c020] -mb-0.5 drop-shadow" />
                            )}
                            <span
                              style={{ backgroundColor: rankColor.badgeBg }}
                              className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center text-sm font-black text-white tabular-nums shadow-sm"
                            >
                              {t.rank}
                            </span>
                          </div>
                          {t.teamLogoUrl && (
                            <img
                              src={t.teamLogoUrl}
                              alt={t.teamName}
                              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0 drop-shadow"
                            />
                          )}
                          <span className="text-sm sm:text-base font-extrabold text-white truncate">
                            {t.teamName}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-black/45 border border-white/15 text-sm font-bold text-[#f0ede0] tabular-nums shrink-0">
                          {t.averageRank.toFixed(2)}{" "}
                          <span className="text-[11px] font-semibold text-[#a6a89e]">
                            avg
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </RetroWindow>
      )}

      {/* 4. Recently Published Rankings & Tier Lists */}
      <RetroWindow title="Recently Published Rankings" theme="scdl">
        {data.recentBallots.length === 0 ? (
          <div className="xp-inset p-4 text-xs text-[#a6a89e]">
            No published rankings yet for this scope.
          </div>
        ) : (
          <RecentBallotsPanel
            ballots={data.recentBallots}
            browseHref={browseHref}
          />
        )}
      </RetroWindow>
    </div>
  );
}

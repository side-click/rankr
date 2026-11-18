"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Crown,
  Eye,
  Filter,
  Globe,
  ListOrdered,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { RecentBallotsPanel } from "@/components/RecentBallotsPanel";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import type { BetaHomeData } from "@/utils/betaHomeData";

const FOCUS_STORAGE_KEY = "rankr_focused_season";

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
      } else {
        localStorage.removeItem(FOCUS_STORAGE_KEY);
      }
    } catch {}
    router.push(slug ? `/beta?season=${encodeURIComponent(slug)}` : "/beta");
  }

  const qSeason = focusedSlug ? `?season=${encodeURIComponent(focusedSlug)}` : "";
  const statsHref = `/stats${qSeason}`;
  const consensusHref = `/consensus${qSeason}`;
  const rankHref = `/rank${qSeason}`;
  const browseHref = `/browse${qSeason}`;

  return (
    <div className="space-y-5">
      {/* 1. Season Focus Bar & 4-Pillar Quick Actions */}
      <RetroWindow title="Rankr Hub (Beta)" theme="scdl">
        <div className="space-y-4">
          {/* Season Focus Control */}
          <div className="xp-panel p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {data.focusedSeason?.leagueLogoUrl ? (
                <img
                  src={data.focusedSeason.leagueLogoUrl}
                  alt={data.focusedSeason.leagueName}
                  className="w-8 h-8 object-contain shrink-0"
                />
              ) : (
                <Globe className="w-6 h-6 text-[#f0c020] shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#a6a89e] flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-[#f0c020]" />
                  <span>
                    {data.focusedSeason
                      ? "Focused Season"
                      : `All Live Seasons (${data.liveSeasons.length})`}
                  </span>
                  {data.focusedSeason && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        data.focusedSeason.isActive
                          ? "bg-[#4ade80]/15 text-[#7cd438] border border-[#4ade80]/30"
                          : "bg-white/10 text-[#a6a89e] border border-white/15"
                      }`}
                    >
                      {data.focusedSeason.isActive ? "Live" : "Archived"}
                    </span>
                  )}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-[#f0ede0]">
                  {data.focusedSeason
                    ? `${data.focusedSeason.leagueName} — ${data.focusedSeason.name}`
                    : "Showing stats, rankings & matches across all active leagues"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                aria-label="Focus season"
                value={focusedSlug}
                onChange={(e) => setFocus(e.target.value)}
                className="bg-[#121614] border border-white/20 rounded px-2.5 py-1.5 text-xs font-bold text-[#f0ede0] focus:outline-none focus:border-[#f0c020]"
              >
                <option value="">All Live Seasons (Default)</option>
                {data.liveSeasons.length > 0 && (
                  <optgroup label="Live Seasons (Open)">
                    {data.liveSeasons.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.leagueShortName} — {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {data.archivedSeasons.length > 0 && (
                  <optgroup label="Archived / Past">
                    {data.archivedSeasons.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.leagueShortName} — {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {data.focusedSeason && (
                <button
                  type="button"
                  onClick={() => setFocus("")}
                  title="Clear season focus (return to All Live Seasons)"
                  className="xp-btn text-xs px-2 py-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* 4-Pillar Action Hub */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href={statsHref}
              className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
            >
              <BarChart3 className="w-6 h-6 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                  Stats Dashboard
                </div>
                <div className="text-xs text-[#a6a89e] mt-0.5">
                  Standings, player leaderboards, SoloQ scouting & box scores
                </div>
              </div>
            </Link>

            <Link
              href={consensusHref}
              className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
            >
              <Trophy className="w-6 h-6 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                  Consensus Rankings
                </div>
                <div className="text-xs text-[#a6a89e] mt-0.5">
                  Community-averaged team power rankings & movement
                </div>
              </div>
            </Link>

            <Link
              href={rankHref}
              className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
            >
              <ListOrdered className="w-6 h-6 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                  Create New
                </div>
                <div className="text-xs text-[#a6a89e] mt-0.5">
                  Build & share Team Power Rankings or Player Tier Lists
                </div>
              </div>
            </Link>

            <Link
              href={browseHref}
              className="xp-panel p-3.5 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group flex items-start gap-3"
            >
              <Eye className="w-6 h-6 text-[#f0c020] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020]">
                  Browse Published
                </div>
                <div className="text-xs text-[#a6a89e] mt-0.5">
                  Explore all community ballots and export shareable cards
                </div>
              </div>
            </Link>
          </div>
        </div>
      </RetroWindow>

      {/* 2. Live Stats & Match Results Spotlight */}
      {(data.recentMatches.length > 0 ||
        data.divisionStandings.length > 0 ||
        data.topPerformers.length > 0) && (
        <RetroWindow title="League Stats & Match Spotlight" theme="scdl">
          <div className="space-y-4">
            {/* Recent Match Results */}
            {data.recentMatches.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5" />
                    <span>Recent Match Results</span>
                  </h2>
                  <Link
                    href={statsHref}
                    className="text-xs text-[#c7c5b8] hover:text-[#f0c020] underline"
                  >
                    Full Stats Hub →
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {data.recentMatches.map((m) => (
                    <Link
                      key={m.seriesKey}
                      href={`/stats/match/${encodeURIComponent(m.seriesKey)}`}
                      style={{ borderTopColor: m.divisionColor }}
                      className="xp-panel p-2.5 border-t-2 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition block space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#a6a89e]">
                        <span>{m.roundLabel}</span>
                        {m.divisionName && (
                          <span style={{ color: m.divisionColor }}>
                            {m.divisionName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {m.teamALogoUrl && (
                            <img
                              src={m.teamALogoUrl}
                              alt={m.teamA}
                              className="w-6 h-6 object-contain shrink-0"
                            />
                          )}
                          <span
                            className={`text-xs font-bold truncate ${
                              m.teamAWins > m.teamBWins
                                ? "text-[#7cd438]"
                                : "text-[#e8e5d8]"
                            }`}
                          >
                            {m.teamA}
                          </span>
                        </div>
                        <span className="text-sm font-black text-[#f0c020] tabular-nums shrink-0 px-1.5">
                          {m.teamAWins}-{m.teamBWins}
                        </span>
                        <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
                          <span
                            className={`text-xs font-bold truncate text-right ${
                              m.teamBWins > m.teamAWins
                                ? "text-[#7cd438]"
                                : "text-[#e8e5d8]"
                            }`}
                          >
                            {m.teamB}
                          </span>
                          {m.teamBLogoUrl && (
                            <img
                              src={m.teamBLogoUrl}
                              alt={m.teamB}
                              className="w-6 h-6 object-contain shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 2-Col: Standings Snapshot + Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Division Standings */}
              {data.divisionStandings.length > 0 && (
                <div className="lg:col-span-7 space-y-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                    Division Standings (Top 4)
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.divisionStandings.map((div) => (
                      <div
                        key={div.divisionId}
                        style={{ borderTopColor: div.primaryColor }}
                        className="xp-panel p-3 border-t-2 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                          <div className="flex items-center gap-2 min-w-0">
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
                        </div>
                        <div className="space-y-1.5">
                          {div.teams.map((t, idx) => (
                            <Link
                              key={t.teamId}
                              href={`/stats/team/${encodeURIComponent(t.teamId)}`}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-black/30 hover:bg-[#f0c020]/10 border border-white/10 hover:border-[#f0c020]/50 transition text-xs"
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
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Rankr Rating Performers */}
              {data.topPerformers.length > 0 && (
                <div className="lg:col-span-5 space-y-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Top Performers (Rankr Rating)</span>
                  </h2>
                  <div className="xp-panel p-3 space-y-1.5">
                    {data.topPerformers.map((p, idx) => {
                      const roleMeta = getRoleMeta(p.role as LeagueRole);
                      return (
                        <Link
                          key={p.playerKey}
                          href={`/stats/player/${encodeURIComponent(p.playerKey)}`}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-black/30 hover:bg-[#f0c020]/10 border border-white/10 hover:border-[#f0c020]/50 transition text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 font-extrabold text-[#f0c020] tabular-nums shrink-0">
                              {idx + 1}
                            </span>
                            <img
                              src={roleMeta.icon}
                              alt={roleMeta.label}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            {p.teamLogoUrl && (
                              <img
                                src={p.teamLogoUrl}
                                alt={p.teamName}
                                className="w-5 h-5 object-contain shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-[#f0ede0] truncate">
                                {p.displayName}
                              </div>
                              <div className="text-[11px] text-[#a6a89e] truncate">
                                {p.teamName} • {p.kda.toFixed(2)} KDA •{" "}
                                {Math.round(p.dpm)} DPM
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-black text-[#7cd438] tabular-nums shrink-0">
                            {p.rating.toFixed(1)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
                style={{ borderTopColor: snap.primaryColor }}
                className="xp-panel p-3.5 border-t-2 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    {snap.divisionLogoUrl && (
                      <img
                        src={snap.divisionLogoUrl}
                        alt={snap.divisionName}
                        className="w-6 h-6 object-contain shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div
                        style={{ color: snap.primaryColor }}
                        className="text-xs font-extrabold uppercase tracking-wider"
                      >
                        {snap.divisionName}
                      </div>
                      <div className="text-[11px] text-[#a6a89e]">
                        {snap.editionName} • {snap.seasonName} •{" "}
                        {snap.submissionCount}{" "}
                        {snap.submissionCount === 1 ? "ballot" : "ballots"}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/consensus?season=${encodeURIComponent(
                      snap.seasonSlug
                    )}&division=${encodeURIComponent(snap.divisionSlug)}`}
                    className="xp-btn text-xs shrink-0"
                  >
                    Full Consensus
                  </Link>
                </div>

                <div className="space-y-1.5">
                  {snap.topTeams.map((t) => (
                    <div
                      key={`${snap.divisionSlug}-${t.rank}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-black/30 border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 font-black text-[#f0c020] tabular-nums shrink-0">
                          #{t.rank}
                        </span>
                        {t.teamLogoUrl && (
                          <img
                            src={t.teamLogoUrl}
                            alt={t.teamName}
                            className="w-5 h-5 object-contain shrink-0"
                          />
                        )}
                        <span className="font-bold text-[#f0ede0] truncate">
                          {t.teamName}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#c7c5b8] tabular-nums shrink-0">
                        {t.averageRank.toFixed(2)} avg
                      </span>
                    </div>
                  ))}
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

      {/* 5. Seasons Directory (Live vs. Archived) */}
      <RetroWindow title="Seasons Directory" theme="scdl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#7cd438]">
              Live Seasons (Open for Rankings & Stats)
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
                        setFocus(focusedSlug === season.slug ? "" : season.slug)
                      }
                      className={`xp-btn text-xs shrink-0 ${
                        focusedSlug === season.slug ? "xp-btn-primary" : ""
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
                          className="xp-inset p-2.5 border-l-4 flex items-center gap-2.5 hover:bg-white/5 transition"
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

          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
              Archived / Past Seasons
            </div>
            {data.archivedSeasons.length === 0 ? (
              <div className="xp-inset p-4 text-xs text-[#a6a89e]">
                No archived seasons yet.
              </div>
            ) : (
              <div className="space-y-2">
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
                        setFocus(focusedSlug === season.slug ? "" : season.slug)
                      }
                      className={`xp-btn text-xs shrink-0 ${
                        focusedSlug === season.slug ? "xp-btn-primary" : ""
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
  );
}

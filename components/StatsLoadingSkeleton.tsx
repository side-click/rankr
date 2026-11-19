"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Crown, Loader2, Trophy, Users } from "lucide-react";

function StatsLoadingSkeletonInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: "players" | "teams" | "division" =
    tabParam === "teams" || tabParam === "division" ? tabParam : "players";

  return (
    <div className="space-y-4">
      {/* Selector Bar Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="w-full rounded-xl border border-white/15 bg-[#151d1a]/95 px-3.5 py-2.5 flex items-center justify-between gap-3 animate-pulse"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 rounded bg-white/10" />
                <div className="h-4 w-40 rounded bg-white/15" />
              </div>
            </div>
            <div className="w-4 h-4 rounded bg-white/10 shrink-0" />
          </div>
        ))}
      </div>

      {/* Players / Teams / Division Section Switcher (exact xp-btn styling) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div
          className={`xp-btn !py-3 sm:!py-4 !px-2 sm:!px-4 !min-h-[54px] sm:!min-h-[66px] !text-xs sm:!text-lg !gap-1.5 sm:!gap-2.5 font-extrabold uppercase tracking-wider justify-center rounded-xl pointer-events-none ${
            activeTab === "players" ? "xp-btn-primary" : "opacity-80"
          }`}
        >
          <Users className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
          <span>Players</span>
        </div>
        <div
          className={`xp-btn !py-3 sm:!py-4 !px-2 sm:!px-4 !min-h-[54px] sm:!min-h-[66px] !text-xs sm:!text-lg !gap-1.5 sm:!gap-2.5 font-extrabold uppercase tracking-wider justify-center rounded-xl pointer-events-none ${
            activeTab === "teams" ? "xp-btn-primary" : "opacity-80"
          }`}
        >
          <Trophy className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
          <span>Teams</span>
        </div>
        <div
          className={`xp-btn !py-3 sm:!py-4 !px-2 sm:!px-4 !min-h-[54px] sm:!min-h-[66px] !text-xs sm:!text-lg !gap-1.5 sm:!gap-2.5 font-extrabold uppercase tracking-wider justify-center rounded-xl pointer-events-none ${
            activeTab === "division" ? "xp-btn-primary" : "opacity-80"
          }`}
        >
          <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
          <span>Division</span>
        </div>
      </div>

      {activeTab === "teams" ? (
        <div className="xp-panel overflow-hidden">
          <div className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Team Standings</span>
            </h2>
            <span className="text-[11px] text-[#a6a89e]">
              Click any team for full scouting sheet
            </span>
          </div>
          <div className="p-3.5 space-y-2.5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-3 sm:px-8 sm:py-6 flex items-center justify-between gap-4 animate-pulse"
              >
                <div className="flex items-center gap-3 sm:gap-7">
                  <div className="h-7 w-8 sm:w-12 rounded bg-white/15" />
                  <div className="w-9 h-9 sm:w-16 sm:h-16 rounded-lg bg-white/10 shrink-0" />
                  <div className="h-5 sm:h-7 w-32 sm:w-48 rounded bg-white/15" />
                </div>
                <div className="flex items-center gap-4 sm:gap-10">
                  <div className="h-7 w-12 rounded bg-white/15" />
                  <div className="h-6 w-10 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === "division" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="xp-panel p-3 h-[96px] flex flex-col justify-between animate-pulse"
              >
                <div className="h-3 w-24 rounded bg-white/15" />
                <div className="h-6 w-16 rounded bg-white/15" />
                <div className="h-2.5 w-20 rounded bg-white/10" />
              </div>
            ))}
          </div>
          <div className="xp-panel overflow-hidden">
            <div className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Champions Played</span>
              </h2>
              <span className="text-[11px] text-[#a6a89e]">
                Top 36 by pick count
              </span>
            </div>
            <div className="p-3 grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1.5">
              {Array.from({ length: 24 }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-square rounded border border-white/10 bg-black/35 animate-pulse"
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* First Team All-Pro Skeleton */}
          <div className="mb-6 xp-panel overflow-hidden">
            <div className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[54px] flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                <Crown className="w-4 h-4" />
                <span>First Team All-Pro</span>
              </h2>
              <span className="text-[11px] text-[#a6a89e]">
                Top-rated player per role
              </span>
            </div>
            <div className="p-3">
              <div className="flex overflow-x-hidden gap-2.5 md:grid md:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-w-[155px] h-[160px] shrink-0 md:min-w-0 md:h-[180px] rounded-lg border border-white/15 bg-[#101513] p-2.5 flex flex-col justify-between animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-14 rounded bg-white/10" />
                      <div className="h-4 w-9 rounded bg-white/15" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-4 w-24 rounded bg-white/15" />
                      <div className="h-3 w-20 rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat Leaderboards Skeleton */}
          <div className="xp-panel overflow-hidden">
            <div className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Stat Leaderboards</span>
              </h2>
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded border border-white/15">
                <span className="xp-btn xp-btn-primary text-xs px-3 py-1 pointer-events-none">
                  Standard
                </span>
                <span className="xp-btn text-xs px-3 py-1 pointer-events-none opacity-80">
                  Shareable
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-center py-2">
                <div className="lg:col-span-3 flex justify-center">
                  <div className="w-full max-w-[560px] h-[220px] rounded-lg border-2 border-[#f0c020]/50 bg-[#171b19] animate-pulse" />
                </div>
                <div className="h-[170px] rounded border border-white/15 bg-black/30 animate-pulse" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-white/15 bg-black/30 p-3 space-y-2.5 animate-pulse"
                  >
                    <div className="h-3.5 w-28 rounded bg-white/15" />
                    {Array.from({ length: 5 }).map((__, r) => (
                      <div
                        key={r}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="h-3 w-24 rounded bg-white/10" />
                        <div className="h-3 w-10 rounded bg-white/10" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function StatsLoadingSkeleton() {
  return (
    <Suspense fallback={null}>
      <StatsLoadingSkeletonInner />
    </Suspense>
  );
}

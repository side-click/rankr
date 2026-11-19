import { BarChart3, Crown, Eye, ListOrdered, Swords, Trophy } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";

export default function HomeLoading() {
  return (
    <div className="space-y-5">
      {/* Top Row: Start Menu + Seasons Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <RetroWindow title="Start Menu" theme="scdl" className="h-full">
            <div className="space-y-2.5">
              {[
                {
                  title: "Create New",
                  desc: "Build and share power rankings and tier lists",
                  icon: (
                    <ListOrdered className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />
                  ),
                },
                {
                  title: "Browse Rankings",
                  desc: "Explore everything published on Rankr",
                  icon: (
                    <Eye className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />
                  ),
                },
                {
                  title: "Consensus",
                  desc: "Find common ground through aggregated opinion",
                  icon: (
                    <Trophy className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />
                  ),
                },
                {
                  title: "Stats",
                  desc: "Leaderboards, standings, scouting sheets and more",
                  icon: (
                    <BarChart3 className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />
                  ),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="xp-panel p-3.5 flex items-start gap-3"
                >
                  {item.icon}
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[#f0ede0]">
                      {item.title}
                    </div>
                    <div className="text-xs text-[#a6a89e] mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
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
                <div className="xp-panel p-3 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded bg-white/10 shrink-0" />
                      <div className="space-y-1.5">
                        <div className="h-2.5 w-36 rounded bg-white/10" />
                        <div className="h-4 w-44 rounded bg-white/15" />
                      </div>
                    </div>
                    <div className="h-7 w-20 rounded bg-white/10 shrink-0" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="xp-inset p-2.5 h-12 rounded" />
                    <div className="xp-inset p-2.5 h-12 rounded" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
                  Past Seasons
                </div>
                <div className="xp-inset p-3 h-10 animate-pulse" />
              </div>
            </div>
          </RetroWindow>
        </div>
      </div>

      {/* Second Row: League Stats (Division Standings + Top Performers + Recent Match Results) */}
      <RetroWindow title="Season Stats" theme="scdl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-2.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                Standings (Top 4)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="xp-panel p-3 h-[196px] space-y-2 animate-pulse"
                  >
                    <div className="h-5 w-32 rounded bg-white/15" />
                    {Array.from({ length: 4 }).map((__, r) => (
                      <div key={r} className="h-7 rounded bg-black/35" />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                Top Performers
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg border-2 border-[#f0c020]/50 bg-[#171b19] p-3 h-[232px] space-y-2 animate-pulse"
                  >
                    <div className="h-5 w-32 rounded bg-white/15" />
                    {Array.from({ length: 5 }).map((__, r) => (
                      <div key={r} className="h-7 rounded bg-black/35" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
              Recent Match Results
            </h2>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="xp-panel p-3 h-[76px] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

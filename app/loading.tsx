import { BarChart3, Eye, ListOrdered, Trophy } from "lucide-react";
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
                  icon: <Eye className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />,
                },
                {
                  title: "Consensus",
                  desc: "See community power rankings across divisions",
                  icon: (
                    <Trophy className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />
                  ),
                },
                {
                  title: "Stats",
                  desc: "Dive into player, team, and division stats",
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
          <RetroWindow
            title="Seasons & Leagues"
            theme="scdl"
            className="h-full"
            statusText="Loading live season data..."
          >
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="xp-panel p-4 space-y-3 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-white/10 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-44 rounded bg-white/15" />
                      <div className="h-3 w-32 rounded bg-white/10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-9 rounded bg-black/35 border border-white/10" />
                    <div className="h-9 rounded bg-black/35 border border-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </RetroWindow>
        </div>
      </div>

      {/* Second Row: Standings + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {["Standings", "Top Performers"].map((title) => (
          <RetroWindow key={title} title={title} theme="scdl">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-10 rounded border border-white/10 bg-black/30 animate-pulse"
                />
              ))}
            </div>
          </RetroWindow>
        ))}
      </div>
    </div>
  );
}

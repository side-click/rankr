import { BarChart3, Loader2, Trophy, Users } from "lucide-react";

export function StatsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Selector Bar Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/15 bg-[#151d1a]/95 px-3.5 py-3 flex items-center gap-3 animate-pulse"
          >
            <div className="w-9 h-9 rounded-lg bg-white/10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-24 rounded bg-white/10" />
              <div className="h-4 w-44 rounded bg-white/15" />
            </div>
          </div>
        ))}
      </div>

      {/* Players / Teams / Division Section Switcher Skeleton */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Players", icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" /> },
          { label: "Teams", icon: <Trophy className="w-4 h-4 sm:w-5 sm:h-5" /> },
          {
            label: "Division",
            icon: <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="xp-panel px-3 py-3 sm:py-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-base font-extrabold uppercase tracking-wider text-[#a6a89e]/80"
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Main Stat Frame Skeleton */}
      <div className="xp-panel overflow-hidden">
        <div className="bg-[#121615] border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading Stats...</span>
          </div>
          <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded border border-white/10 bg-black/30 p-3 space-y-2.5 animate-pulse"
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
    </div>
  );
}

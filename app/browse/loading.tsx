import { RetroWindow } from "@/components/RetroWindow";

export default function BrowseLoading() {
  return (
    <RetroWindow
      title="Browse Published Rankings"
      theme="scdl"
      statusText="Loading published rankings..."
    >
      <div className="space-y-4">
        {/* Filter Bar Skeleton (matches 5-input filter bar + Filter/Reset buttons) */}
        <div className="xp-panel p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-2.5 w-14 rounded bg-white/10 animate-pulse" />
                <div className="h-8 rounded border border-white/10 bg-black/35 animate-pulse" />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="xp-btn xp-btn-primary text-xs px-3 py-1.5 pointer-events-none opacity-80">
                Filter
              </div>
              <div className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-70">
                Reset
              </div>
            </div>
          </div>
        </div>

        {/* Count + Grid/List Toggle */}
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-white/15">
            <span className="xp-btn xp-btn-primary text-xs px-2.5 py-1 pointer-events-none">
              Grid
            </span>
            <span className="xp-btn text-xs px-2.5 py-1 pointer-events-none opacity-75">
              List
            </span>
          </div>
        </div>

        {/* 3-Column Ballot Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-white/15 bg-black/35 p-3 space-y-2.5 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded bg-white/10 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 rounded bg-white/15" />
                  <div className="h-3 w-24 rounded bg-white/10" />
                  <div className="h-3 w-32 rounded bg-white/10" />
                </div>
              </div>
              <div className="h-2.5 w-28 rounded bg-white/10 pt-1" />
            </div>
          ))}
        </div>
      </div>
    </RetroWindow>
  );
}

import { LayoutGrid, List, Search } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";

export default function BrowseLoading() {
  return (
    <RetroWindow title="Browse Published Rankings" theme="scdl">
      <div className="space-y-4">
        {/* Filter Bar Skeleton (exact match to app/browse/page.tsx) */}
        <div className="xp-panel p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {["Type", "Season", "Division", "Edition", "Author"].map((label) => (
            <div key={label}>
              <div className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
                {label}
              </div>
              <div className="w-full xp-inset h-[30px] animate-pulse" />
            </div>
          ))}
          <div className="flex gap-2">
            <span className="xp-btn xp-btn-primary text-xs flex-1 pointer-events-none opacity-80">
              <Search className="w-3.5 h-3.5" />
              <span>Filter</span>
            </span>
            <span className="xp-btn text-xs pointer-events-none opacity-75">
              Reset
            </span>
          </div>
        </div>

        {/* Count + Grid/List Toggle (exact match to BallotListGrid) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
            <div className="xp-inset p-0.5 hidden md:inline-flex items-center gap-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-xs bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]">
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-xs text-[#c7c5b8]">
                <List className="w-3.5 h-3.5" />
                <span>List</span>
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
      </div>
    </RetroWindow>
  );
}

import { Trophy } from "lucide-react";

export default function ConsensusLoading() {
  return (
    <div className="relative rounded-2xl border border-[#c89b3c]/50 bg-[#0d1412] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.65)] p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-4 border-b border-[#c89b3c]/25">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0c020]/25 to-[#8c6b16]/25 border border-[#f0c020]/60 flex items-center justify-center shadow-[0_0_24px_rgba(240,192,32,0.22)] shrink-0">
          <Trophy className="w-6 h-6 text-[#f0c020]" />
        </div>
        <div>
          <h1 className="wow-heading text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            Consensus{" "}
            <span className="whitespace-nowrap">Power Rankings</span>
          </h1>
        </div>
      </div>

      {/* 3-Dropdown Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {["League / Season", "Division", "Week / Edition"].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-white/15 bg-[#151d1a]/95 px-3.5 py-3 flex items-center gap-3 animate-pulse"
          >
            <div className="w-9 h-9 rounded-lg bg-white/10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                {label}
              </div>
              <div className="h-3.5 w-32 rounded bg-white/15" />
            </div>
          </div>
        ))}
      </div>

      {/* Voting Panel + Action Toolbar Skeleton */}
      <div className="h-10 rounded-lg border border-white/10 bg-black/30 animate-pulse" />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-65">
          Hide Change
        </span>
        <span className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-65">
          Show Voter Ranks
        </span>
        <span className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-65">
          Copy Link
        </span>
        <span className="xp-btn xp-btn-gold text-xs px-3 py-1.5 pointer-events-none opacity-65">
          Export PNG
        </span>
      </div>

      {/* Graphic Preview Inside Outer Container */}
      <div className="max-w-[960px] mx-auto w-full rounded-[32px] border-[6px] border-[#c89b3c]/75 bg-[#181e1c] overflow-hidden">
        <div className="h-24 bg-black/40 border-b-2 border-[#c89b3c]/50 animate-pulse" />
        <div className="p-4 sm:p-6 space-y-2.5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 rounded-lg border border-white/10 bg-black/35 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

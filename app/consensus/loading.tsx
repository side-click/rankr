import { Loader2, Trophy } from "lucide-react";

export default function ConsensusLoading() {
  return (
    <div className="space-y-5">
      {/* Header & 3-Dropdown Selector Card (matches ConsensusRankingsView) */}
      <div className="relative rounded-2xl border border-[#c89b3c]/50 bg-[#0d1412] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.65)] p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#c89b3c]/25">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0c020]/25 to-[#8c6b16]/25 border border-[#f0c020]/60 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-[#f0c020]" />
          </div>
          <div className="space-y-1">
            <h1 className="wow-heading text-lg sm:text-xl font-bold text-[#f0c020] tracking-wide">
              Consensus Power Rankings
            </h1>
            <p className="text-xs text-[#a6a89e] flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-[#f0c020]" />
              <span>Loading division consensus...</span>
            </p>
          </div>
        </div>

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
      </div>

      {/* Graphic Preview Skeleton */}
      <div className="max-w-[960px] mx-auto w-full rounded-[32px] border-[6px] border-[#c89b3c]/50 bg-[#181e1c] overflow-hidden">
        <div className="h-24 bg-black/40 border-b-2 border-[#c89b3c]/40 animate-pulse" />
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

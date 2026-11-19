import { Loader2, Trophy } from "lucide-react";

export default function ConsensusLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#c89b3c]/50 bg-[#0d1412] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-[#c89b3c]/25">
          <div className="w-11 h-11 rounded-xl bg-[#f0c020]/15 border border-[#f0c020]/50 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-[#f0c020]" />
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-52 rounded bg-white/15 animate-pulse" />
            <div className="h-3 w-72 rounded bg-white/10 animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/15 bg-[#151d1a]/95 px-3.5 py-3 h-[62px] animate-pulse"
            />
          ))}
        </div>
      </div>

      <div className="xp-panel overflow-hidden">
        <div className="bg-[#121615] border-b border-white/10 px-4 py-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading Consensus Rankings...</span>
        </div>
        <div className="p-4 space-y-2.5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 rounded-lg border border-white/10 bg-black/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

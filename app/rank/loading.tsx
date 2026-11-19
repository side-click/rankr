import { Loader2, User } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";

export default function RankLoading() {
  return (
    <div className="space-y-4">
      {/* Mode Selector: Team Power Rankings vs Player Tier List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg border-2 bg-[#221d12] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border bg-[#382e12] border-[#f0c020] text-[#f0c020] flex items-center justify-center shrink-0">
            <TeamGroupIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-[#f0c020]">
              Team Power Rankings
            </div>
            <div className="text-[11px] text-[#c7c5b8]">
              Rank division teams 1–N with notes
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg border-2 bg-[#15181f] border-white/10 opacity-75 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border bg-black/40 border-white/15 text-[#c7c5b8] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-[#f0ede0]">
              Player Tier List
            </div>
            <div className="text-[11px] text-[#a6a89e]">
              Tier-rank players across roles
            </div>
          </div>
        </div>
      </div>

      <RetroWindow
        title="Create Ranking"
        theme="scdl"
        statusText="Loading workspace..."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-[#f0c020] font-bold">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading teams and editions...</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 rounded border border-white/10 bg-black/35 animate-pulse"
              />
            ))}
          </div>

          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-12 rounded border border-white/10 bg-black/30 animate-pulse"
              />
            ))}
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

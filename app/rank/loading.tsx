import { Lock, User } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export default async function RankLoading() {
  const auth = await getServerAuthContext();

  if (!auth.user) {
    return (
      <RetroWindow title="Sign In Required — Rankings Editor" theme="scdl">
        <div className="py-8 px-4 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded xp-inset flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#f0c020]" />
          </div>
          <h1 className="text-lg font-bold text-[#f0ede0]">
            Sign in with Discord to Create Rankings
          </h1>
          <div className="flex justify-center">
            <div className="h-8 w-40 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </RetroWindow>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Selector: Team Power Rankings vs Player Tier List (no subtitles, matching RankWorkspace) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg border-2 bg-[#221d12] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border bg-[#382e12] border-[#f0c020] text-[#f0c020] flex items-center justify-center shrink-0">
            <TeamGroupIcon className="w-5 h-5" />
          </div>
          <div className="text-sm font-extrabold text-[#f0c020]">
            Team Power Rankings
          </div>
        </div>

        <div className="p-2.5 rounded-lg border-2 bg-[#15181f] border-white/10 opacity-75 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border bg-black/40 border-white/15 text-[#c7c5b8] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="text-sm font-extrabold text-[#f0ede0]">
            Player Tier List
          </div>
        </div>
      </div>

      <RetroWindow title="Team Power Rankings Editor" theme="scdl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["Season", "Division", "Edition"].map((label) => (
              <div key={label} className="space-y-1">
                <div className="text-[11px] font-bold text-[#a6a89e]">
                  {label}
                </div>
                <div className="h-9 rounded border border-white/15 bg-black/35 animate-pulse" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
            <div className="h-8 w-36 rounded bg-white/10 animate-pulse" />
          </div>

          <div className="xp-inset p-6 text-center text-xs text-[#a6a89e] animate-pulse">
            Loading editor...
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

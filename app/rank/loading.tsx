import { Lock, Save, Send, User } from "lucide-react";
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
      {/* Mode Selector: exact match to RankWorkspace */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="text-left p-2.5 rounded-lg border-2 flex items-center gap-3 bg-[#221d12] border-[#f0c020] shadow-[0_0_20px_rgba(240,192,32,0.18)]">
          <div className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 bg-[#382e12] border-[#f0c020] text-[#f0c020]">
            <TeamGroupIcon className="w-5 h-5" />
          </div>
          <span className="font-black text-sm tracking-tight text-[#f0c020]">
            Team Power Rankings
          </span>
        </div>

        <div className="text-left p-2.5 rounded-lg border-2 flex items-center gap-3 bg-[#15181f] border-white/10 opacity-75">
          <div className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 bg-black/30 border-white/15 text-[#c89b3c]/70">
            <User className="w-5 h-5" />
          </div>
          <span className="font-black text-sm tracking-tight text-[#f0ede0]">
            Player Tier List
          </span>
        </div>
      </div>

      <RetroWindow title="Team Power Rankings Editor" theme="scdl">
        <div className="space-y-4">
          {/* Exact xp-panel framing around Season / Division / Edition */}
          <div className="xp-panel p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["Season", "Division", "Edition"].map((label) => (
                <div key={label}>
                  <div className="block text-[11px] font-bold mb-1 text-[#c7c5b8]">
                    {label}
                  </div>
                  <div className="w-full xp-inset h-[30px] animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="xp-btn text-xs px-2.5 py-1 pointer-events-none opacity-65">
              + Custom Author Name
            </div>
            <div className="xp-btn text-xs px-2.5 py-1 pointer-events-none opacity-65">
              + Add General Notes
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <div className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-55">
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </div>
            <div className="xp-btn xp-btn-primary text-xs px-3 py-1.5 pointer-events-none opacity-55">
              <Send className="w-3.5 h-3.5" />
              <span>Publish Ranking</span>
            </div>
          </div>

          <div className="xp-inset p-6 text-center text-xs text-[#a6a89e] animate-pulse">
            Loading editor...
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

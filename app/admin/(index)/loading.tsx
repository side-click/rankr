import { RetroWindow } from "@/components/RetroWindow";

export default function AdminLoading() {
  return (
    <RetroWindow title="Admin Console" theme="scdl">
      <div className="space-y-4">
        {/* Admin Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="xp-btn xp-btn-primary text-xs px-3 py-1.5 pointer-events-none">
              Setup Seasons
            </span>
            {[
              "Setup Divisions and Editions",
              "Setup Teams",
              "Setup Players",
              "Moderation & Safety",
            ].map((label) => (
              <span
                key={label}
                className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-80"
              >
                {label}
              </span>
            ))}
          </div>
          <span className="xp-btn text-xs px-3 py-1.5 pointer-events-none opacity-80">
            Stats Dashboard
          </span>
        </div>

        {/* 2-Column Leagues / Seasons Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="xp-panel p-3.5 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
              Leagues
            </div>
            <div className="h-20 rounded border border-white/10 bg-black/35 animate-pulse" />
            <div className="h-9 rounded border border-white/10 bg-black/30 animate-pulse" />
          </div>

          <div className="xp-panel p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020]">
                Seasons
              </div>
              <div className="h-7 w-40 rounded border border-white/10 bg-black/35 animate-pulse" />
            </div>
            <div className="h-20 rounded border border-white/10 bg-black/35 animate-pulse" />
            <div className="h-9 rounded border border-white/10 bg-black/30 animate-pulse" />
          </div>
        </div>
      </div>
    </RetroWindow>
  );
}

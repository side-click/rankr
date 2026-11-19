import { Loader2 } from "lucide-react";

export default function BrowseLoading() {
  return (
    <div className="xp-window xp-window-scdl overflow-hidden">
      <div className="xp-titlebar xp-titlebar-scdl flex items-center gap-2 px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f0c020]" />
        <span>Loading Published Rankings...</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 rounded border border-white/10 bg-black/30 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-lg border border-white/10 bg-black/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { RetroWindow } from "@/components/RetroWindow";

export function RetroLoadingWindow({
  title = "Loading...",
}: {
  title?: string;
}) {
  return (
    <RetroWindow title={title} theme="scdl">
      <div className="py-12 px-4 text-center space-y-3 animate-pulse">
        <div className="h-4 w-48 mx-auto rounded bg-white/10" />
        <div className="h-3 w-72 mx-auto rounded bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-4">
          <div className="h-20 rounded bg-white/5 border border-white/10" />
          <div className="h-20 rounded bg-white/5 border border-white/10" />
          <div className="h-20 rounded bg-white/5 border border-white/10" />
        </div>
      </div>
    </RetroWindow>
  );
}

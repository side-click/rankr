import { RetroWindow } from "@/components/RetroWindow";

interface RetroLoadingWindowProps {
  title?: string;
  label?: string;
  theme?: "scdl" | "baron" | "dragon";
}

export function RetroLoadingWindow({
  title = "Loading...",
  label = "Loading...",
  theme = "scdl",
}: RetroLoadingWindowProps) {
  return (
    <div className="max-w-md mx-auto my-8">
      <RetroWindow title={title} theme={theme}>
        <div className="p-5 space-y-3">
          <div className="text-xs font-semibold text-[#e8e5d8] tracking-wide">
            {label}
          </div>
          <div
            className="xp-progress-track"
            role="progressbar"
            aria-label={label}
          >
            <div className="xp-progress-blocks" />
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

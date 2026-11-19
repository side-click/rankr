import { RetroWindow } from "@/components/RetroWindow";

export default function MyRankingsLoading() {
  return (
    <RetroWindow title="My Ranking History" theme="scdl">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="xp-panel p-3.5 h-20 animate-pulse"
          />
        ))}
      </div>
    </RetroWindow>
  );
}

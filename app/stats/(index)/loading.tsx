import { RetroLoadingWindow } from "@/components/RetroLoadingWindow";

export default function StatsLoading() {
  return (
    <RetroLoadingWindow
      title="Season Stats"
      label="Loading Season Stats & Leaderboards..."
      theme="scdl"
    />
  );
}

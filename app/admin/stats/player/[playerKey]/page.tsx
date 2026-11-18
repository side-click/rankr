import { ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { PlayerStatsContent } from "@/components/PlayerStatsContent";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";

export const dynamic = "force-dynamic";

export default async function AdminPlayerStatsPage({
  params,
}: {
  params: Promise<{ playerKey: string }>;
}) {
  const { playerKey } = await params;
  const decodedKey = decodeURIComponent(playerKey).toLowerCase();
  const ctx = await loadAdminStatsContext();

  if (!ctx.authorized) {
    return (
      <RetroWindow title="Player Stats — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <p className="text-xs text-[#a6a89e]">Admin Access Required.</p>
        </div>
      </RetroWindow>
    );
  }

  return (
    <PlayerStatsContent
      ctx={ctx}
      decodedKey={decodedKey}
      basePath="/admin/stats"
    />
  );
}

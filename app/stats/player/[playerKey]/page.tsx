import { PlayerStatsContent } from "@/components/PlayerStatsContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";

export const dynamic = "force-dynamic";

export default async function PublicPlayerStatsPage({
  params,
}: {
  params: Promise<{ playerKey: string }>;
}) {
  const { playerKey } = await params;
  const decodedKey = decodeURIComponent(playerKey).toLowerCase();
  const ctx = await loadPublicStatsContext();

  return (
    <PlayerStatsContent ctx={ctx} decodedKey={decodedKey} basePath="/stats" />
  );
}

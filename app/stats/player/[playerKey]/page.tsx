import { PlayerStatsContent } from "@/components/PlayerStatsContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

export const dynamic = "force-dynamic";

export default async function PublicPlayerStatsPage({
  params,
}: {
  params: Promise<{ playerKey: string }>;
}) {
  const { playerKey } = await params;
  const decodedKey = decodeURIComponent(playerKey).toLowerCase();
  const effectiveSeason = await getFocusedSeasonSlug();
  const ctx = await loadPublicStatsContext(effectiveSeason);

  return (
    <PlayerStatsContent ctx={ctx} decodedKey={decodedKey} basePath="/stats" />
  );
}

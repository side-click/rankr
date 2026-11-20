import type { Metadata } from "next";
import { ChampionStatsContent } from "@/components/ChampionStatsContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

export const metadata: Metadata = {
  title: "Champion Stats | Rankr",
};

export const dynamic = "force-dynamic";

export default async function PublicChampionStatsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const championName = decodeURIComponent(name);
  const effectiveSeason = await getFocusedSeasonSlug();
  const ctx = await loadPublicStatsContext(effectiveSeason);

  return (
    <ChampionStatsContent
      ctx={ctx}
      championName={championName}
      basePath="/stats"
    />
  );
}

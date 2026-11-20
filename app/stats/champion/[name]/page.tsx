import type { Metadata } from "next";
import { ChampionStatsContent } from "@/components/ChampionStatsContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { fetchAllScdlSeries } from "@/utils/scdlSheetStats";
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
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    includeRiotStats: false,
  });
  const series = await fetchAllScdlSeries(ctx.sheetConfig).catch(() => []);

  return (
    <ChampionStatsContent
      ctx={ctx}
      series={series}
      championName={championName}
      basePath="/stats"
    />
  );
}

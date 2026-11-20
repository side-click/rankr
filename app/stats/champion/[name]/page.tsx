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
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ division?: string; season?: string }>;
}) {
  const [{ name }, { division, season }] = await Promise.all([
    params,
    searchParams,
  ]);
  const championName = decodeURIComponent(name);
  const effectiveSeason = await getFocusedSeasonSlug(season);
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    includeRiotStats: false,
  });
  const series = await fetchAllScdlSeries(ctx.sheetConfig).catch(() => []);

  return (
    <ChampionStatsContent
      ctx={ctx}
      series={series}
      championName={championName}
      initialDivision={division}
      basePath="/stats"
    />
  );
}

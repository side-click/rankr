import type { Metadata } from "next";
import { ChampionStatsContent } from "@/components/ChampionStatsContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { fetchAllScdlSeries } from "@/utils/leagueStats";
import { safeDecodeParam } from "@/utils/ogFonts";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ division?: string; season?: string }>;
}): Promise<Metadata> {
  const [{ name }, { division, season }] = await Promise.all([
    params,
    searchParams,
  ]);
  const championName = safeDecodeParam(name) ?? name;
  const encodedName = encodeURIComponent(championName);
  const title = `${championName} Stats | Rankr`;

  const hasDiv = Boolean(division && division !== "all");
  const ogParams = new URLSearchParams();
  if (hasDiv && division) ogParams.set("division", division);
  if (season) ogParams.set("season", season);

  const ogUrl =
    hasDiv || season
      ? `/api/og/champion/${encodedName}?${ogParams.toString()}`
      : `/stats/champion/${encodedName}/opengraph-image`;

  return {
    title,
    openGraph: {
      type: "website",
      siteName: "Rankr",
      title,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogUrl],
    },
  };
}

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
  const championName = safeDecodeParam(name) ?? name;
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

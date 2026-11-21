import type { Metadata } from "next";
import { MatchSeriesContent } from "@/components/MatchSeriesContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ seriesKey: string }>;
  searchParams: Promise<{ season?: string }>;
}): Promise<Metadata> {
  const [{ seriesKey }, { season }] = await Promise.all([params, searchParams]);
  const decodedKey = decodeURIComponent(seriesKey);
  const encodedKey = encodeURIComponent(decodedKey);
  const title = "Match Series | Rankr";

  const ogUrl = season
    ? `/api/og/match/${encodedKey}?season=${encodeURIComponent(season)}`
    : `/stats/match/${encodedKey}/opengraph-image`;

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

export default async function PublicMatchSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ seriesKey: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ seriesKey }, { season }] = await Promise.all([params, searchParams]);
  const decodedKey = decodeURIComponent(seriesKey);
  const effectiveSeason = await getFocusedSeasonSlug(season);
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    includeRiotStats: false,
  });

  return (
    <MatchSeriesContent ctx={ctx} decodedKey={decodedKey} basePath="/stats" />
  );
}

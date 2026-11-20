import { MatchSeriesContent } from "@/components/MatchSeriesContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match History | Rankr",
};

export const dynamic = "force-dynamic";

export default async function PublicMatchSeriesPage({
  params,
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  const decodedKey = decodeURIComponent(seriesKey);
  const effectiveSeason = await getFocusedSeasonSlug();
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    includeRiotStats: false,
  });

  return (
    <MatchSeriesContent ctx={ctx} decodedKey={decodedKey} basePath="/stats" />
  );
}

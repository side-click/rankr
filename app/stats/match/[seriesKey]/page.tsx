import { MatchSeriesContent } from "@/components/MatchSeriesContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";

export const dynamic = "force-dynamic";

export default async function PublicMatchSeriesPage({
  params,
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  const decodedKey = decodeURIComponent(seriesKey);
  const ctx = await loadPublicStatsContext();

  return (
    <MatchSeriesContent ctx={ctx} decodedKey={decodedKey} basePath="/stats" />
  );
}

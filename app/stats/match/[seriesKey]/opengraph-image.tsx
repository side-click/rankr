import {
  MATCH_OG_SIZE,
  renderMatchOpenGraphImage,
} from "@/utils/matchOgImage";

export const alt = "Rankr — Match Series";
export const size = MATCH_OG_SIZE;
export const contentType = "image/png";

export default async function MatchSeriesOpenGraphImage({
  params,
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  return renderMatchOpenGraphImage(decodeURIComponent(seriesKey));
}

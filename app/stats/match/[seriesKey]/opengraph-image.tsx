import { NextResponse } from "next/server";
import {
  MATCH_OG_SIZE,
  renderMatchOpenGraphImage,
} from "@/utils/matchOgImage";
import { safeDecodeParam } from "@/utils/ogFonts";

export const alt = "Rankr — Match Series";
export const size = MATCH_OG_SIZE;
export const contentType = "image/png";

export default async function MatchSeriesOpenGraphImage({
  params,
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  const decoded = safeDecodeParam(seriesKey);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid seriesKey" }, { status: 400 });
  }
  return renderMatchOpenGraphImage(decoded);
}

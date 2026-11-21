import type { NextRequest } from "next/server";
import { renderMatchOpenGraphImage } from "@/utils/matchOgImage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesKey: string }> }
) {
  const { seriesKey } = await params;
  const season = request.nextUrl.searchParams.get("season") ?? undefined;
  return renderMatchOpenGraphImage(decodeURIComponent(seriesKey), season);
}

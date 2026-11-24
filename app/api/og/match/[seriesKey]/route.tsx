import { NextResponse, type NextRequest } from "next/server";
import { renderMatchOpenGraphImage } from "@/utils/matchOgImage";
import { safeDecodeParam } from "@/utils/ogFonts";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesKey: string }> }
) {
  const { seriesKey } = await params;
  const decoded = safeDecodeParam(seriesKey);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid seriesKey" }, { status: 400 });
  }
  const season = request.nextUrl.searchParams.get("season") ?? undefined;
  return renderMatchOpenGraphImage(decoded, season);
}

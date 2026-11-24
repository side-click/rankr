import { NextResponse, type NextRequest } from "next/server";
import { renderChampionOpenGraphImage } from "@/utils/championOgImage";
import { safeDecodeParam } from "@/utils/ogFonts";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = safeDecodeParam(name);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid champion parameter" }, { status: 400 });
  }
  const division = request.nextUrl.searchParams.get("division") ?? undefined;
  const season = request.nextUrl.searchParams.get("season") ?? undefined;
  return renderChampionOpenGraphImage(decoded, division, season);
}

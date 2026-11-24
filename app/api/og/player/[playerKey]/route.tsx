import { NextResponse, type NextRequest } from "next/server";
import { safeDecodeParam } from "@/utils/ogFonts";
import { renderPlayerOpenGraphImage } from "@/utils/playerOgImage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerKey: string }> }
) {
  const { playerKey } = await params;
  const decoded = safeDecodeParam(playerKey);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid playerKey" }, { status: 400 });
  }
  const season = request.nextUrl.searchParams.get("season") ?? undefined;
  return renderPlayerOpenGraphImage(decoded.toLowerCase(), season);
}

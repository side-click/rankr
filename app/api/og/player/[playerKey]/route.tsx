import type { NextRequest } from "next/server";
import { renderPlayerOpenGraphImage } from "@/utils/playerOgImage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerKey: string }> }
) {
  const { playerKey } = await params;
  const season = request.nextUrl.searchParams.get("season") ?? undefined;
  return renderPlayerOpenGraphImage(
    decodeURIComponent(playerKey).toLowerCase(),
    season
  );
}

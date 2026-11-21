import type { NextRequest } from "next/server";
import { renderChampionOpenGraphImage } from "@/utils/championOgImage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const division = request.nextUrl.searchParams.get("division") ?? undefined;
  const season = request.nextUrl.searchParams.get("season") ?? undefined;
  return renderChampionOpenGraphImage(
    decodeURIComponent(name),
    division,
    season
  );
}

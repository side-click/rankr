import { NextResponse } from "next/server";
import {
  CHAMPION_OG_SIZE,
  renderChampionOpenGraphImage,
} from "@/utils/championOgImage";
import { safeDecodeParam } from "@/utils/ogFonts";

export const alt = "Rankr — Champion Stats";
export const size = CHAMPION_OG_SIZE;
export const contentType = "image/png";

export default async function ChampionOpenGraphImage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = safeDecodeParam(name);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid champion parameter" }, { status: 400 });
  }
  return renderChampionOpenGraphImage(decoded);
}

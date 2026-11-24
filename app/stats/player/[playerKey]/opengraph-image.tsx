import { NextResponse } from "next/server";
import { safeDecodeParam } from "@/utils/ogFonts";
import {
  PLAYER_OG_SIZE,
  renderPlayerOpenGraphImage,
} from "@/utils/playerOgImage";

export const alt = "Rankr — Player Stats";
export const size = PLAYER_OG_SIZE;
export const contentType = "image/png";

export default async function PlayerOpenGraphImage({
  params,
}: {
  params: Promise<{ playerKey: string }>;
}) {
  const { playerKey } = await params;
  const decoded = safeDecodeParam(playerKey);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid playerKey" }, { status: 400 });
  }
  return renderPlayerOpenGraphImage(decoded.toLowerCase());
}

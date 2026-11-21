import {
  CHAMPION_OG_SIZE,
  renderChampionOpenGraphImage,
} from "@/utils/championOgImage";

export const alt = "Rankr — Champion Stats";
export const size = CHAMPION_OG_SIZE;
export const contentType = "image/png";

export default async function ChampionOpenGraphImage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return renderChampionOpenGraphImage(decodeURIComponent(name));
}

import {
  BALLOT_OG_SIZE,
  renderBallotOpenGraphImage,
} from "@/utils/rankingOgImage";

export const alt = "Rankr — Published Tier List";
export const size = BALLOT_OG_SIZE;
export const contentType = "image/png";

export default async function TierListOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderBallotOpenGraphImage(id);
}

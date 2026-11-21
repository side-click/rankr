import {
  BALLOT_OG_SIZE,
  renderBallotOpenGraphImage,
} from "@/utils/ballotOgImage";

export const alt = "Rankr — Published Ranking";
export const size = BALLOT_OG_SIZE;
export const contentType = "image/png";

export default async function RankingOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderBallotOpenGraphImage(id);
}

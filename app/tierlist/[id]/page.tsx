import type { Metadata } from "next";
import { PlayerTierShareView } from "@/components/PlayerTierShareView";
import {
  generateRankingMetadata,
  loadRankingPageView,
} from "@/utils/rankingPageLoader";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return generateRankingMetadata(id, "tierlist");
}

export default async function PlayerTierListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ballot, themes, isOwner, isAdmin } = await loadRankingPageView(
    id,
    "player"
  );

  return (
    <PlayerTierShareView
      ballot={ballot}
      themes={themes}
      isOwner={isOwner}
      isAdmin={isAdmin}
    />
  );
}

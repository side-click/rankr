import type { Metadata } from "next";
import { TeamRankingShareView } from "@/components/TeamRankingShareView";
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
  return generateRankingMetadata(id, "rankings");
}

export default async function TeamRankingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ballot, entries, themes, isOwner, isAdmin } =
    await loadRankingPageView(id, "team");

  return (
    <TeamRankingShareView
      ballot={ballot}
      entries={entries}
      themes={themes}
      isOwner={isOwner}
      isAdmin={isAdmin}
    />
  );
}

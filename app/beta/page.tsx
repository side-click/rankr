import type { Metadata } from "next";
import { BetaHomeView } from "@/components/BetaHomeView";
import { loadBetaHomeData } from "@/utils/betaHomeData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankr Beta Hub",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BetaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const data = await loadBetaHomeData(params.season);

  return <BetaHomeView data={data} />;
}

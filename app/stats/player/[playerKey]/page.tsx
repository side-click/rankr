import type { Metadata } from "next";
import { PlayerStatsContent } from "@/components/PlayerStatsContent";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ playerKey: string }>;
  searchParams: Promise<{ season?: string }>;
}): Promise<Metadata> {
  const [{ playerKey }, { season }] = await Promise.all([params, searchParams]);
  const decoded = decodeURIComponent(playerKey);
  const displayName = decoded.split("#")[0]?.trim() || decoded;
  const encodedKey = encodeURIComponent(decoded.toLowerCase());
  const title = `${displayName} Stats | Rankr`;

  const ogUrl = season
    ? `/api/og/player/${encodedKey}?season=${encodeURIComponent(season)}`
    : `/stats/player/${encodedKey}/opengraph-image`;

  return {
    title,
    openGraph: {
      type: "website",
      siteName: "Rankr",
      title,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogUrl],
    },
  };
}

export default async function PublicPlayerStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerKey: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ playerKey }, { season }] = await Promise.all([params, searchParams]);
  const decodedKey = decodeURIComponent(playerKey).toLowerCase();
  const effectiveSeason = await getFocusedSeasonSlug(season);
  const ctx = await loadPublicStatsContext(effectiveSeason, {
    playerKeyFilter: decodedKey,
  });

  return (
    <PlayerStatsContent ctx={ctx} decodedKey={decodedKey} basePath="/stats" />
  );
}

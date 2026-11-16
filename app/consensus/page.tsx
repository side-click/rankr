import type { Metadata } from "next";
import { loadConsensusPageData } from "@/utils/consensusData";
import { ConsensusRankingsView } from "@/components/ConsensusRankingsView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    division?: string;
    edition?: string;
  }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const hasSpecificScope = Boolean(
    params.season || params.division || params.edition
  );

  if (!hasSpecificScope) {
    const genericTitle = "Consensus Rankings | Rankr";
    const genericDescription =
      "Aggregated team power rankings averaged across all published submissions.";
    const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
    const genericOgUrl = `/consensus/opengraph-image?v=${deploySha}`;
    return {
      title: genericTitle,
      description: genericDescription,
      openGraph: {
        type: "website",
        siteName: "Rankr",
        title: genericTitle,
        description: genericDescription,
        images: [
          {
            url: genericOgUrl,
            width: 1200,
            height: 630,
            alt: genericTitle,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: genericTitle,
        description: genericDescription,
        images: [genericOgUrl],
      },
    };
  }

  const data = await loadConsensusPageData(params);

  const title = data.divisionName && data.editionName
    ? `${data.divisionName} — ${data.editionName} Consensus`
    : "Consensus Power Rankings | Rankr";

  const top3 = data.rows.slice(0, 3);
  const topSummary =
    top3.length > 0
      ? `Top 3: ${top3
          .map(
            (r) =>
              `#${r.consensusRank} ${r.teamName} (${r.averageRank.toFixed(2)} avg)`
          )
          .join(" • ")}`
      : null;

  const description = topSummary
    ? `${topSummary} — Average of ${data.submissionCount} published ${
        data.submissionCount === 1 ? "ranking" : "rankings"
      }`
    : "Aggregated team power rankings averaged across all published submissions.";

  const ogParams = new URLSearchParams();
  if (data.selectedSeasonSlug) ogParams.set("season", data.selectedSeasonSlug);
  if (data.selectedDivisionSlug) {
    ogParams.set("division", data.selectedDivisionSlug);
  }
  if (data.selectedEditionSlug) {
    ogParams.set("edition", data.selectedEditionSlug);
  }
  const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  ogParams.set(
    "v",
    `${deploySha}-${data.submissionCount}-${top3.map((r) => r.teamKey).join(",")}`
  );
  const ogImageUrl = `/api/og/consensus?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      type: "article",
      siteName: "Rankr",
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ConsensusPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    division?: string;
    edition?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await loadConsensusPageData(params);

  return (
    <ConsensusRankingsView
      seasons={data.seasons}
      divisions={data.divisions}
      editions={data.editions}
      selectedSeasonSlug={data.selectedSeasonSlug}
      selectedDivisionSlug={data.selectedDivisionSlug}
      selectedEditionSlug={data.selectedEditionSlug}
      leagueName={data.leagueName}
      leagueLogoUrl={data.leagueLogoUrl}
      seasonName={data.seasonName}
      divisionName={data.divisionName}
      divisionLogoUrl={data.divisionLogoUrl}
      divisionTheme={data.divisionTheme}
      editionName={data.editionName}
      submissionCount={data.submissionCount}
      isFallbackOutdated={data.isFallbackOutdated}
      latestEditionName={data.latestEditionName}
      latestEditionCount={data.latestEditionCount}
      rows={data.rows}
      contributors={data.contributors}
    />
  );
}

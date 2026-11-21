import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { checkUserAllowlisted } from "@/utils/allowlist";
import { TeamRankingShareView } from "@/components/TeamRankingShareView";
import type { PlayerTierListPayload } from "@/types/database";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ballot } = await supabase
    .from("rankings")
    .select(
      `
      title,
      ranking_type,
      tier_data,
      author_notes,
      updated_at,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      edition_name_snapshot,
      profiles ( username ),
      seasons ( name, leagues ( name, short_name ) ),
      divisions ( name ),
      editions ( name ),
      ranking_entries ( rank, team_name_snapshot, teams ( name ) )
    `
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!ballot) {
    return { title: "Rankr — Rankings" };
  }

  const profile = Array.isArray(ballot.profiles)
    ? ballot.profiles[0]
    : ballot.profiles;
  const season = Array.isArray(ballot.seasons)
    ? ballot.seasons[0]
    : ballot.seasons;
  const division = Array.isArray(ballot.divisions)
    ? ballot.divisions[0]
    : ballot.divisions;
  const edition = Array.isArray(ballot.editions)
    ? ballot.editions[0]
    : ballot.editions;

  const divisionName = division?.name ?? ballot.division_name_snapshot ?? "";
  const editionName = edition?.name ?? ballot.edition_name_snapshot ?? "";
  const seasonName = season?.name ?? ballot.season_name_snapshot ?? "";
  const seasonLeague = season && "leagues" in season
    ? (Array.isArray(season.leagues) ? season.leagues[0] : season.leagues)
    : null;
  const leagueShortName =
    seasonLeague?.short_name ||
    seasonLeague?.name ||
    ballot.league_name_snapshot ||
    "";
  const authorName = profile?.username ?? "Voter";
  const isPlayerTierList = ballot.ranking_type === "player";

  let title: string;
  if (isPlayerTierList) {
    const scopeTitle = divisionName
      ? `${divisionName} Player Tier List`
      : `${leagueShortName || seasonName || "League"} Player Tier List`;
    title = editionName
      ? `${scopeTitle} — ${editionName}`
      : ballot.title || scopeTitle;
  } else {
    title =
      divisionName && editionName
        ? `${divisionName} — ${editionName}`
        : ballot.title || `${seasonName} ${divisionName} — ${editionName}`.trim();
  }

  let topSummary: string | null = null;
  if (isPlayerTierList) {
    const tierData = ballot.tier_data as PlayerTierListPayload | null;
    const firstSection = tierData?.sections?.[0];
    const firstTierWithPlayers = firstSection?.tiers?.find(
      (t) => t.players.length > 0
    );
    if (firstTierWithPlayers) {
      const topNames = firstTierWithPlayers.players
        .slice(0, 4)
        .map((p) => p.name);
      topSummary = `${firstTierWithPlayers.label}: ${topNames.join(" • ")}`;
    }
  } else {
    const items = Array.isArray(ballot.ranking_entries)
      ? ballot.ranking_entries
      : [];
    const top3 = [...items]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((item) => {
        const team = Array.isArray(item.teams) ? item.teams[0] : item.teams;
        return `#${item.rank} ${team?.name ?? item.team_name_snapshot ?? "Team"}`;
      });
    if (top3.length > 0) {
      topSummary = `Top 3: ${top3.join(" • ")}`;
    }
  }

  const descriptionParts = [
    topSummary,
    ballot.author_notes ? `"${ballot.author_notes}"` : null,
  ].filter(Boolean);

  const description =
    descriptionParts.join(" — ") ||
    `${isPlayerTierList ? "Player Tier List" : "Team Power Rankings"} by ${authorName}`;

  const fullTitle = `${title} | by ${authorName}`;
  const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  const ogVersion = encodeURIComponent(
    `${deploySha}-${editionName}-${divisionName}-${ballot.updated_at ?? ""}`
  );
  const ogImageUrl = `/ballot/${id}/opengraph-image?v=${ogVersion}`;

  return {
    title: fullTitle,
    description,
    openGraph: {
      type: "article",
      siteName: "Rankr",
      title: fullTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function BallotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ballot } = await supabase
    .from("rankings")
    .select(
      `
      *,
      profiles ( id, username, avatar_url ),
      seasons ( id, name, slug, leagues ( id, name, short_name, slug, logo_url, theme_key ) ),
      divisions ( id, name, slug, logo_url, theme_key ),
      editions ( id, name, slug, sort_order, is_open, is_archived )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!ballot) {
    notFound();
  }

  if (ballot.status !== "published") {
    if (ballot.user_id === user?.id) {
      const season = Array.isArray(ballot.seasons)
        ? ballot.seasons[0]
        : ballot.seasons;
      const division = Array.isArray(ballot.divisions)
        ? ballot.divisions[0]
        : ballot.divisions;
      const edition = Array.isArray(ballot.editions)
        ? ballot.editions[0]
        : ballot.editions;
      const params = new URLSearchParams();
      if (ballot.ranking_type === "player") params.set("type", "player");
      if (season?.slug) params.set("season", season.slug);
      if (ballot.ranking_type === "player") {
        params.set("division", division?.slug ?? "all");
      } else if (division?.slug) {
        params.set("division", division.slug);
      }
      if (edition?.slug) params.set("edition", edition.slug);
      if (ballot.ranking_type === "player" && ballot.tier_variant) {
        params.set("variant", ballot.tier_variant);
      }
      redirect(`/create?${params.toString()}`);
    }
    notFound();
  }

  const isPlayerTierList = ballot.ranking_type === "player";

  const [
    entriesResult,
    { data: divisionThemes },
    { data: viewerProfile },
    isAllowlisted,
  ] = await Promise.all([
    isPlayerTierList
      ? Promise.resolve({ data: [] })
      : supabase
          .from("ranking_entries")
          .select("*")
          .eq("ranking_id", ballot.id)
          .order("rank", { ascending: true }),
    supabase.from("division_themes").select("*").order("name"),
    user
      ? supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user ? checkUserAllowlisted(supabase) : Promise.resolve(false),
  ]);

  const isOwner = user?.id === ballot.user_id && isAllowlisted;
  const isAdmin = Boolean(viewerProfile?.is_admin);

  if (isPlayerTierList) {
    redirect(`/tierlist/${encodeURIComponent(id)}`);
  }

  return (
    <TeamRankingShareView
      ballot={ballot}
      entries={entriesResult.data ?? []}
      themes={divisionThemes ?? []}
      isOwner={isOwner}
      isAdmin={isAdmin}
    />
  );
}

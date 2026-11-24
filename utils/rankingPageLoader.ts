import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkUserAllowlistedForLeague } from "@/utils/allowlist";
import { unwrap } from "@/utils/formatters";
import { attachPublicProfiles } from "@/utils/publicProfiles";
import { createClient, createPublicClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import type {
  DivisionTheme,
  PlayerTierListPayload,
  Ranking,
  RankingEntry,
} from "@/types/database";

const RANKING_SELECT = `
  *,
  seasons ( id, league_id, name, slug, leagues ( id, name, short_name, slug, logo_url, theme_key ) ),
  divisions ( id, name, slug, logo_url, theme_key ),
  editions ( id, name, slug, sort_order, is_open, is_archived ),
  ranking_entries ( * )
`;

const loadPublishedRankingCached = cache(async (id: string) => {
  const supabase = createPublicClient();
  const [{ data: ballot }, { data: divisionThemes }] = await Promise.all([
    supabase
      .from("rankings")
      .select(RANKING_SELECT)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle(),
    supabase.from("division_themes").select("*").order("name"),
  ]);

  if (!ballot) return null;
  const [hydrated] = await attachPublicProfiles(supabase, [ballot]);
  return {
    ballot: hydrated ?? null,
    divisionThemes: (divisionThemes ?? []) as DivisionTheme[],
  };
});

export async function generateRankingMetadata(
  id: string,
  routeType: "rankings" | "tierlist"
): Promise<Metadata> {
  const loaded = await loadPublishedRankingCached(id);
  const ballot = loaded?.ballot;

  if (!ballot) {
    return {
      title: routeType === "tierlist" ? "Rankr — Tier Lists" : "Rankr — Rankings",
    };
  }

  const profile = unwrap(ballot.profiles);
  const season = unwrap(ballot.seasons);
  const division = unwrap(ballot.divisions);
  const edition = unwrap(ballot.editions);

  const divisionName = division?.name ?? ballot.division_name_snapshot ?? "";
  const editionName = edition?.name ?? ballot.edition_name_snapshot ?? "";
  const seasonName = season?.name ?? ballot.season_name_snapshot ?? "";
  const seasonLeague =
    season && "leagues" in season ? unwrap(season.leagues) : null;
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
      ? (ballot.ranking_entries as (RankingEntry & {
          teams?: { name?: string } | { name?: string }[] | null;
        })[])
      : [];
    const top3 = [...items]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((item) => {
        const team = unwrap(item.teams);
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
    `${
      isPlayerTierList ? "Player Tier List" : "Team Power Rankings"
    } by ${authorName}`;

  const fullTitle = `${title} | by ${authorName}`;
  const deploySha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  const ogVersion = encodeURIComponent(
    `${deploySha}-${editionName}-${divisionName}-${ballot.updated_at ?? ""}`
  );
  const ogBase = isPlayerTierList ? "tierlist" : "rankings";
  const ogImageUrl = `/${ogBase}/${id}/opengraph-image?v=${ogVersion}`;

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

export async function loadRankingPageView(
  id: string,
  expectedType: "team" | "player"
): Promise<{
  ballot: Ranking;
  entries: RankingEntry[];
  themes: DivisionTheme[];
  isOwner: boolean;
  isAdmin: boolean;
}> {
  const [loaded, auth] = await Promise.all([
    loadPublishedRankingCached(id),
    getServerAuthContext(),
  ]);

  if (!loaded?.ballot) {
    if (auth.user) {
      const supabase = await createClient();
      const { data: draftRow } = await supabase
        .from("rankings")
        .select(
          `
          user_id,
          ranking_type,
          tier_variant,
          status,
          seasons ( slug ),
          divisions ( slug ),
          editions ( slug )
        `
        )
        .eq("id", id)
        .maybeSingle();

      if (draftRow && draftRow.status !== "published" && draftRow.user_id === auth.user.id) {
        const season = unwrap(draftRow.seasons);
        const division = unwrap(draftRow.divisions);
        const edition = unwrap(draftRow.editions);
        const qp = new URLSearchParams();
        if (draftRow.ranking_type === "player") qp.set("type", "player");
        if (season?.slug) qp.set("season", season.slug);
        if (draftRow.ranking_type === "player") {
          qp.set("division", division?.slug ?? "all");
        } else if (division?.slug) {
          qp.set("division", division.slug);
        }
        if (edition?.slug) qp.set("edition", edition.slug);
        if (draftRow.ranking_type === "player" && draftRow.tier_variant) {
          qp.set("variant", draftRow.tier_variant);
        }
        redirect(`/create?${qp.toString()}`);
      }
    }
    notFound();
  }

  const ballot = loaded.ballot;
  const isPlayerTierList = ballot.ranking_type === "player";

  if (expectedType === "team" && isPlayerTierList) {
    redirect(`/tierlist/${encodeURIComponent(id)}`);
  }
  if (expectedType === "player" && !isPlayerTierList) {
    redirect(`/rankings/${encodeURIComponent(id)}`);
  }

  const entries = isPlayerTierList
    ? []
    : ([
        ...(Array.isArray(ballot.ranking_entries)
          ? ballot.ranking_entries
          : []),
      ] as RankingEntry[]).sort((a, b) => a.rank - b.rank);

  let isOwner = false;
  if (auth.user && auth.user.id === ballot.user_id) {
    const season = unwrap(ballot.seasons);
    const leagueId =
      (season as { league_id?: string | null } | null)?.league_id ?? null;
    const supabase = await createClient();
    isOwner =
      auth.isAdmin ||
      (await checkUserAllowlistedForLeague(supabase, leagueId));
  }

  return {
    ballot: ballot as unknown as Ranking,
    entries,
    themes: loaded.divisionThemes,
    isOwner,
    isAdmin: auth.isAdmin,
  };
}

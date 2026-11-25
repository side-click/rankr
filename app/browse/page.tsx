import type { Metadata } from "next";
import type { BlogCardData } from "@/components/BlogCard";
import { BrowseFilterForm } from "@/components/BrowseFilterForm";
import type { ContentCardData } from "@/components/ContentCard";
import {
  ContentListGrid,
  type ContentItem,
} from "@/components/ContentListGrid";
import { RetroWindow } from "@/components/RetroWindow";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";
import { attachPublicProfiles } from "@/utils/publicProfiles";
import { compactRankingCardRow } from "@/utils/recentContentQuery";
import { createPublicClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Browse Content | Rankr",
};

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    season?: string;
    division?: string;
    edition?: string;
    author?: string;
  }>;
}) {
  const params = await searchParams;
  const effectiveSeason = await getFocusedSeasonSlug(params.season);
  const supabase = createPublicClient();

  const [{ data: seasons }, { data: divisions }, { data: editions }] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("*, leagues ( * )")
        .order("created_at", { ascending: false }),
      supabase.from("divisions").select("*").order("name"),
      supabase
        .from("editions")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

  const includeBallots = params.type !== "blog";
  const includeBlogs =
    (params.type === "" || !params.type || params.type === "blog") &&
    !params.division &&
    !params.edition;

  let query = supabase
    .from("rankings")
    .select(
      `
      id,
      user_id,
      title,
      ranking_type,
      tier_variant,
      tier_data,
      published_at,
      season_id,
      division_id,
      edition_id,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      division_logo_snapshot,
      edition_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, logo_url, theme_key ),
      editions ( name, slug ),
      ranking_entries ( rank, team_name_snapshot, teams ( name, logo_url ) )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (params.type === "team" || params.type === "player") {
    query = query.eq("ranking_type", params.type);
  }
  const focusedSeasonRow = effectiveSeason
    ? seasons?.find((x) => x.slug === effectiveSeason)
    : undefined;

  if (focusedSeasonRow) {
    query = query.eq("season_id", focusedSeasonRow.id);
  }
  if (params.division) {
    const matchingDivIds = (divisions ?? [])
      .filter((d) => d.slug === params.division)
      .map((d) => d.id);
    if (matchingDivIds.length > 0) {
      query = query.in("division_id", matchingDivIds);
    }
  }
  if (params.edition) {
    const matchingEdIds = (editions ?? [])
      .filter((e) => e.slug === params.edition)
      .map((e) => e.id);
    if (matchingEdIds.length > 0) {
      query = query.in("edition_id", matchingEdIds);
    }
  }

  let blogQuery = supabase
    .from("blogs")
    .select(
      `
      id,
      user_id,
      title,
      subtitle,
      banner_url,
      author_name,
      published_at,
      season_id,
      season_name_snapshot,
      league_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (focusedSeasonRow) {
    blogQuery = blogQuery.eq("season_id", focusedSeasonRow.id);
  }

  const [{ data: rawBallots }, { data: rawBlogs }] = await Promise.all([
    includeBallots ? query.limit(60) : Promise.resolve({ data: [] }),
    includeBlogs ? blogQuery.limit(60) : Promise.resolve({ data: [] }),
  ]);

  const [ballots, blogs] = await Promise.all([
    attachPublicProfiles(
      supabase,
      ((rawBallots ?? []) as unknown as (ContentCardData & {
        user_id?: string | null;
      })[]).map(compactRankingCardRow)
    ),
    attachPublicProfiles(
      supabase,
      (rawBlogs ?? []) as unknown as (BlogCardData & {
        user_id?: string | null;
      })[]
    ),
  ]);

  const authorFilter = params.author?.trim().toLowerCase() ?? "";
  const filteredBallots = ballots.filter((b) => {
    if (!authorFilter) return true;
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    return (profile?.username ?? "").toLowerCase().includes(authorFilter);
  });

  const filteredBlogs = blogs.filter((b) => {
    if (!authorFilter) return true;
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    const authorDisplay = b.author_name?.trim() || profile?.username || "";
    return authorDisplay.toLowerCase().includes(authorFilter);
  });

  const mergedItems: ContentItem[] = [
    ...filteredBallots.map((b) => ({
      kind: "ballot" as const,
      id: b.id,
      publishedAt: b.published_at,
      data: b as ContentCardData,
    })),
    ...filteredBlogs.map((b) => ({
      kind: "blog" as const,
      id: b.id,
      publishedAt: b.published_at,
      data: b as BlogCardData,
    })),
  ].sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  const seasonOptions = (seasons ?? []).map((s) => {
    const league = Array.isArray(s.leagues) ? s.leagues[0] : s.leagues;
    const lgObj = league as {
      short_name?: string | null;
      slug?: string;
      name?: string;
    } | null;
    const leaguePrefix =
      lgObj?.short_name ||
      (lgObj?.slug === "scdl" ? "SCDL" : lgObj?.name ?? null);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      leaguePrefix,
    };
  });

  return (
    <RetroWindow title="Browse Content" theme="scdl">
      <BrowseFilterForm
        key={`${params.type ?? ""}|${effectiveSeason ?? ""}|${params.division ?? ""}|${params.edition ?? ""}|${params.author ?? ""}`}
        seasons={seasonOptions}
        divisions={(divisions ?? []).map((d) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          season_id: d.season_id,
        }))}
        editions={(editions ?? []).map((e) => ({
          id: e.id,
          slug: e.slug,
          name: e.name,
          season_id: e.season_id,
        }))}
        initialType={params.type ?? ""}
        initialSeason={effectiveSeason ?? ""}
        initialDivision={params.division ?? ""}
        initialEdition={params.edition ?? ""}
        initialAuthor={params.author ?? ""}
      />

      <ContentListGrid items={mergedItems} showCount />
    </RetroWindow>
  );
}

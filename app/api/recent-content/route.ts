import { NextResponse } from "next/server";
import type { BlogCardData } from "@/components/BlogCard";
import type { ContentCardData } from "@/components/ContentCard";
import { attachPublicProfiles } from "@/utils/publicProfiles";
import {
  compactRankingCardRow,
  RECENT_BLOG_SELECT,
  RECENT_CONTENT_PAGE_SIZE,
  RECENT_CONTENT_SELECT,
} from "@/utils/recentContentQuery";
import { createPublicClient } from "@/utils/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before")?.trim() || null;
  const seasonIdsParam = searchParams.get("seasonIds")?.trim() || "";
  const seasonIds = seasonIdsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_REGEX.test(s))
    .slice(0, 20);

  if (before && Number.isNaN(Date.parse(before))) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const supabase = createPublicClient();

  let rankingsQuery = supabase
    .from("rankings")
    .select(RECENT_CONTENT_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(RECENT_CONTENT_PAGE_SIZE);
  if (seasonIds.length > 0) {
    rankingsQuery = rankingsQuery.in("season_id", seasonIds);
  }
  if (before) {
    rankingsQuery = rankingsQuery.lt("published_at", before);
  }

  let blogsQuery = supabase
    .from("blogs")
    .select(RECENT_BLOG_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(RECENT_CONTENT_PAGE_SIZE);
  if (seasonIds.length > 0) {
    blogsQuery = blogsQuery.or(
      `season_id.in.(${seasonIds.join(",")}),season_id.is.null`
    );
  }
  if (before) {
    blogsQuery = blogsQuery.lt("published_at", before);
  }

  const [rankingsRes, blogsRes] = await Promise.all([rankingsQuery, blogsQuery]);

  if (rankingsRes.error) {
    return NextResponse.json(
      { error: rankingsRes.error.message },
      { status: 500 }
    );
  }
  if (blogsRes.error) {
    return NextResponse.json(
      { error: blogsRes.error.message },
      { status: 500 }
    );
  }

  const rawRankings = (rankingsRes.data ?? []) as unknown as (ContentCardData & {
    user_id?: string | null;
  })[];
  const rawBlogs = (blogsRes.data ?? []) as unknown as (BlogCardData & {
    user_id?: string | null;
  })[];

  const [hydratedRankings, hydratedBlogs] = await Promise.all([
    attachPublicProfiles(supabase, rawRankings.map(compactRankingCardRow)),
    attachPublicProfiles(supabase, rawBlogs),
  ]);

  const combined = [
    ...hydratedRankings.map((b) => ({
      kind: "ballot" as const,
      id: b.id,
      publishedAt: b.published_at,
      data: b,
    })),
    ...hydratedBlogs.map((b) => ({
      kind: "blog" as const,
      id: b.id,
      publishedAt: b.published_at,
      data: b,
    })),
  ]
    .sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, RECENT_CONTENT_PAGE_SIZE);

  return NextResponse.json({
    items: combined,
    hasMore:
      hydratedRankings.length >= RECENT_CONTENT_PAGE_SIZE ||
      hydratedBlogs.length >= RECENT_CONTENT_PAGE_SIZE,
  });
}

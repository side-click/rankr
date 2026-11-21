"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import type { ContentCardData } from "@/components/ContentCard";
import type { BlogCardData } from "@/components/BlogCard";
import {
  ContentListGrid,
  type ContentItem,
} from "@/components/ContentListGrid";
import { createClient } from "@/utils/supabase/client";
import {
  RECENT_BLOG_SELECT,
  RECENT_CONTENT_PAGE_SIZE,
  RECENT_CONTENT_SELECT,
} from "@/utils/recentContentQuery";

interface RecentContentPanelProps {
  ballots?: ContentCardData[];
  initialItems?: ContentItem[];
  browseHref?: string;
  /** Season scope used by the server query; reused when loading more. */
  seasonIds?: string[];
  hasFocusedSeason?: boolean;
}

export function RecentContentPanel({
  ballots = [],
  initialItems,
  browseHref = "/browse",
  seasonIds = [],
  hasFocusedSeason = false,
}: RecentContentPanelProps) {
  const seedItems: ContentItem[] = initialItems
    ? initialItems.slice(0, RECENT_CONTENT_PAGE_SIZE)
    : ballots.slice(0, RECENT_CONTENT_PAGE_SIZE).map((b) => ({
        kind: "ballot" as const,
        id: b.id,
        publishedAt: b.published_at,
        data: b,
      }));

  const [items, setItems] = useState<ContentItem[]>(seedItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    seedItems.length >= RECENT_CONTENT_PAGE_SIZE
  );

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const oldestPublishedAt = items[items.length - 1]?.publishedAt;

      let rankingsQuery = supabase
        .from("rankings")
        .select(RECENT_CONTENT_SELECT)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(RECENT_CONTENT_PAGE_SIZE);
      if (seasonIds.length > 0) {
        rankingsQuery = rankingsQuery.in("season_id", seasonIds);
      }
      if (oldestPublishedAt) {
        rankingsQuery = rankingsQuery.lt("published_at", oldestPublishedAt);
      }

      let blogsQuery = supabase
        .from("blogs")
        .select(RECENT_BLOG_SELECT)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(RECENT_CONTENT_PAGE_SIZE);
      if (hasFocusedSeason && seasonIds.length > 0) {
        blogsQuery = blogsQuery.in("season_id", seasonIds);
      } else if (seasonIds.length > 0) {
        blogsQuery = blogsQuery.or(
          `season_id.in.(${seasonIds.join(",")}),season_id.is.null`
        );
      }
      if (oldestPublishedAt) {
        blogsQuery = blogsQuery.lt("published_at", oldestPublishedAt);
      }

      const [
        { data: rankingsData, error: rankingsErr },
        { data: blogsData, error: blogsErr },
      ] = await Promise.all([rankingsQuery, blogsQuery]);

      if (rankingsErr) throw rankingsErr;
      if (blogsErr) throw blogsErr;

      const nextRankings = (
        (rankingsData ?? []) as unknown as ContentCardData[]
      ).map((b) => ({
        kind: "ballot" as const,
        id: b.id,
        publishedAt: b.published_at,
        data: b,
      }));
      const nextBlogs = ((blogsData ?? []) as unknown as BlogCardData[]).map(
        (b) => ({
          kind: "blog" as const,
          id: b.id,
          publishedAt: b.published_at,
          data: b,
        })
      );

      const combined = [...nextRankings, ...nextBlogs]
        .sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, RECENT_CONTENT_PAGE_SIZE);

      setItems((prev) => {
        const seen = new Set(prev.map((x) => `${x.kind}:${x.id}`));
        return [
          ...prev,
          ...combined.filter((x) => !seen.has(`${x.kind}:${x.id}`)),
        ];
      });
      if (combined.length < RECENT_CONTENT_PAGE_SIZE) setHasMore(false);
    } catch (err) {
      console.error("Failed to load more content", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <ContentListGrid
        items={items}
        defaultView="list"
        showViewToggle={false}
      />
      <div className="flex justify-end gap-2">
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="xp-btn text-xs"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
            )}
            <span>Show More</span>
          </button>
        )}
        <Link href={browseHref} className="xp-btn text-xs">
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse All</span>
        </Link>
      </div>
    </div>
  );
}

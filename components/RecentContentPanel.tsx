"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import type { ContentCardData } from "@/components/ContentCard";
import {
  ContentListGrid,
  type ContentItem,
} from "@/components/ContentListGrid";
import { RECENT_CONTENT_PAGE_SIZE } from "@/utils/recentContentQuery";

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
      const oldestPublishedAt = items[items.length - 1]?.publishedAt;
      const params = new URLSearchParams();
      if (oldestPublishedAt) params.set("before", oldestPublishedAt);
      if (seasonIds.length > 0) params.set("seasonIds", seasonIds.join(","));

      const res = await fetch(`/api/recent-content?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more content");
      const json = (await res.json()) as {
        items?: ContentItem[];
        hasMore?: boolean;
      };
      const combined = json.items ?? [];

      setItems((prev) => {
        const seen = new Set(prev.map((x) => `${x.kind}:${x.id}`));
        return [
          ...prev,
          ...combined.filter((x) => !seen.has(`${x.kind}:${x.id}`)),
        ];
      });
      if (!json.hasMore || combined.length < RECENT_CONTENT_PAGE_SIZE) {
        setHasMore(false);
      }
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

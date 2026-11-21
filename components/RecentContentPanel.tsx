"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import type { ContentCardData } from "@/components/ContentCard";
import { ContentListGrid } from "@/components/ContentListGrid";
import { createClient } from "@/utils/supabase/client";
import {
  RECENT_CONTENT_PAGE_SIZE,
  RECENT_CONTENT_SELECT,
} from "@/utils/recentContentQuery";

interface RecentContentPanelProps {
  ballots: ContentCardData[];
  browseHref?: string;
  /** Season scope used by the server query; reused when loading more. */
  seasonIds?: string[];
}

export function RecentContentPanel({
  ballots,
  browseHref = "/browse",
  seasonIds = [],
}: RecentContentPanelProps) {
  const [items, setItems] = useState<ContentCardData[]>(() =>
    ballots.slice(0, RECENT_CONTENT_PAGE_SIZE)
  );
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    ballots.length >= RECENT_CONTENT_PAGE_SIZE
  );

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const from = items.length;
      let query = supabase
        .from("rankings")
        .select(RECENT_CONTENT_SELECT)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(from, from + RECENT_CONTENT_PAGE_SIZE - 1);
      if (seasonIds.length > 0) query = query.in("season_id", seasonIds);

      const { data, error } = await query;
      if (error) throw error;
      const next = (data ?? []) as unknown as ContentCardData[];
      setItems((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        return [...prev, ...next.filter((b) => !seen.has(b.id))];
      });
      if (next.length < RECENT_CONTENT_PAGE_SIZE) setHasMore(false);
    } catch (err) {
      console.error("Failed to load more content", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <ContentListGrid ballots={items} defaultView="list" />
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

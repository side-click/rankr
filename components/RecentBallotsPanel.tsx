import Link from "next/link";
import { Eye } from "lucide-react";
import type { BallotCardData } from "@/components/BallotCard";
import {
  BallotListGrid,
  type ContentCardItem,
} from "@/components/BallotListGrid";

interface RecentBallotsPanelProps {
  ballots?: BallotCardData[];
  items?: ContentCardItem[];
  browseHref?: string;
}

export function RecentBallotsPanel({
  ballots = [],
  items,
  browseHref = "/browse",
}: RecentBallotsPanelProps) {
  const recentItems: ContentCardItem[] = items
    ? items.slice(0, 6)
    : ballots.slice(0, 6).map((b) => ({
        kind: "ballot" as const,
        id: b.id,
        publishedAt: b.published_at,
        data: b,
      }));

  return (
    <div className="space-y-3">
      <BallotListGrid items={recentItems} defaultView="list" />
      <div className="flex justify-end">
        <Link href={browseHref} className="xp-btn text-xs">
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse All</span>
        </Link>
      </div>
    </div>
  );
}

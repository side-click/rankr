import Link from "next/link";
import { Eye } from "lucide-react";
import type { ContentCardData } from "@/components/ContentCard";
import { ContentListGrid } from "@/components/ContentListGrid";

interface RecentContentPanelProps {
  ballots: ContentCardData[];
  browseHref?: string;
}

export function RecentContentPanel({
  ballots,
  browseHref = "/browse",
}: RecentContentPanelProps) {
  const recentBallots = ballots.slice(0, 6);

  return (
    <div className="space-y-3">
      <ContentListGrid ballots={recentBallots} defaultView="list" />
      <div className="flex justify-end">
        <Link href={browseHref} className="xp-btn text-xs">
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse All</span>
        </Link>
      </div>
    </div>
  );
}

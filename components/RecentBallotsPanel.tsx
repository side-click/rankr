import Link from "next/link";
import { Eye } from "lucide-react";
import type { BallotCardData } from "@/components/BallotCard";
import { BallotListGrid } from "@/components/BallotListGrid";

interface RecentBallotsPanelProps {
  ballots: BallotCardData[];
}

export function RecentBallotsPanel({ ballots }: RecentBallotsPanelProps) {
  const recentBallots = ballots.slice(0, 6);

  return (
    <div className="space-y-3">
      <BallotListGrid ballots={recentBallots} defaultView="list" />
      <div className="flex justify-start">
        <Link href="/browse" className="xp-btn text-xs">
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse All</span>
        </Link>
      </div>
    </div>
  );
}

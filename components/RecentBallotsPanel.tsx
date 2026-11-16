import Link from "next/link";
import { Eye } from "lucide-react";
import { BallotCard, type BallotCardData } from "@/components/BallotCard";

interface RecentBallotsPanelProps {
  ballots: BallotCardData[];
}

export function RecentBallotsPanel({ ballots }: RecentBallotsPanelProps) {
  const recentBallots = ballots.slice(0, 9);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {recentBallots.map((b) => (
          <BallotCard key={b.id} ballot={b} />
        ))}
      </div>

      <div className="flex justify-start">
        <Link href="/browse" className="xp-btn text-xs">
          <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
          <span>Browse All</span>
        </Link>
      </div>
    </div>
  );
}

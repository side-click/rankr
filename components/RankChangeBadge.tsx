import React from "react";

interface RankChangeBadgeProps {
  previousRank: number | null;
  rankChange: number | null;
  compact?: boolean;
}

export function RankChangeBadge({
  previousRank,
  rankChange,
  compact = false,
}: RankChangeBadgeProps) {
  if (previousRank === null || rankChange === null || rankChange === 0) {
    return null;
  }

  if (rankChange > 0) {
    return (
      <div className="inline-flex flex-col items-center justify-center leading-tight">
        <span className="px-2 py-0.5 text-xs font-bold bg-[#173b24] text-[#7cd438] border border-[#3a804d] rounded-xs">
          ▲ +{rankChange}
        </span>
        {!compact && (
          <span className="text-[11px] text-[#b8bdb2] mt-0.5 whitespace-nowrap">
            Last: #{previousRank}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center justify-center leading-tight">
      <span className="px-2 py-0.5 text-xs font-bold bg-[#451717] text-[#ff857a] border border-[#9e3535] rounded-xs">
        ▼ {rankChange}
      </span>
      {!compact && (
        <span className="text-[11px] text-[#b8bdb2] mt-0.5 whitespace-nowrap">
          Last: #{previousRank}
        </span>
      )}
    </div>
  );
}

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
  if (previousRank === null || rankChange === null) {
    return (
      <div className="inline-flex flex-col items-center justify-center leading-tight">
        <span className="px-1.5 py-0.5 text-[11px] font-bold bg-[#2b322f] text-[#b4b7ad] border border-[#4a5450] rounded-xs">
          —
        </span>
        {!compact && (
          <span className="text-[10px] text-[#9aa096] mt-0.5">
            Last: N/A
          </span>
        )}
      </div>
    );
  }

  if (rankChange > 0) {
    return (
      <div className="inline-flex flex-col items-center justify-center leading-tight">
        <span className="px-1.5 py-0.5 text-[11px] font-bold bg-[#173b24] text-[#7cd438] border border-[#3a804d] rounded-xs">
          ▲ +{rankChange}
        </span>
        {!compact && (
          <span className="text-[10px] text-[#b8bdb2] mt-0.5">
            Last: #{previousRank}
          </span>
        )}
      </div>
    );
  }

  if (rankChange < 0) {
    return (
      <div className="inline-flex flex-col items-center justify-center leading-tight">
        <span className="px-1.5 py-0.5 text-[11px] font-bold bg-[#451717] text-[#ff857a] border border-[#9e3535] rounded-xs">
          ▼ {rankChange}
        </span>
        {!compact && (
          <span className="text-[10px] text-[#b8bdb2] mt-0.5">
            Last: #{previousRank}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center justify-center leading-tight">
      <span className="px-1.5 py-0.5 text-[11px] font-bold bg-[#2b322f] text-[#d5d4c8] border border-[#4a5450] rounded-xs">
        — 0
      </span>
      {!compact && (
        <span className="text-[10px] text-[#b8bdb2] mt-0.5">
          Last: #{previousRank}
        </span>
      )}
    </div>
  );
}

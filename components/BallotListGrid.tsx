"use client";

import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { BallotCard, type BallotCardData } from "@/components/BallotCard";

interface BallotListGridProps {
  ballots: BallotCardData[];
  emptyMessage?: string;
  showCount?: boolean;
}

export function BallotListGrid({
  ballots,
  emptyMessage = "No published rankings match your filters.",
  showCount = false,
}: BallotListGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (ballots.length === 0) {
    return (
      <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-[#a6a89e]">
          {showCount
            ? `${ballots.length} ${ballots.length === 1 ? "ranking" : "rankings"}`
            : null}
        </div>
        <div className="xp-inset p-0.5 inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-colors ${
              viewMode === "grid"
                ? "bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]"
                : "text-[#c7c5b8] hover:text-white"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-colors ${
              viewMode === "list"
                ? "bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]"
                : "text-[#c7c5b8] hover:text-white"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ballots.map((b) => (
            <BallotCard key={b.id} ballot={b} layout="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {ballots.map((b) => (
            <BallotCard key={b.id} ballot={b} layout="list" />
          ))}
        </div>
      )}
    </div>
  );
}

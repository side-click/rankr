"use client";

import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import {
  BallotCard,
  type BallotCardData,
  type BallotCardLayout,
} from "@/components/BallotCard";

interface BallotListGridProps {
  ballots: BallotCardData[];
  emptyMessage?: string;
  showCount?: boolean;
  headerLeft?: React.ReactNode;
}

export function BallotListGrid({
  ballots,
  emptyMessage = "No published rankings match your filters.",
  showCount = false,
  headerLeft,
}: BallotListGridProps) {
  const [viewMode, setViewMode] = useState<BallotCardLayout>("grid");

  if (ballots.length === 0) {
    return (
      <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
        {emptyMessage}
      </div>
    );
  }

  const options: { key: BallotCardLayout; label: string; icon?: "grid" | "list" }[] = [
    { key: "grid", label: "Grid", icon: "grid" },
    { key: "list", label: "List", icon: "list" },
    { key: "test1", label: "Test1" },
    { key: "test2", label: "Test2" },
    { key: "test3", label: "Test3" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-[#a6a89e]">
          {headerLeft
            ? headerLeft
            : showCount
            ? `${ballots.length} ${ballots.length === 1 ? "ranking" : "rankings"}`
            : null}
        </div>
        <div className="xp-inset p-0.5 inline-flex flex-wrap items-center gap-0.5">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setViewMode(opt.key)}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-colors ${
                viewMode === opt.key
                  ? "bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]"
                  : "text-[#c7c5b8] hover:text-white"
              }`}
            >
              {opt.icon === "grid" && <LayoutGrid className="w-3.5 h-3.5" />}
              {opt.icon === "list" && <List className="w-3.5 h-3.5" />}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ballots.map((b) => (
            <BallotCard key={b.id} ballot={b} layout="grid" />
          ))}
        </div>
      ) : viewMode === "test2" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {ballots.map((b) => (
            <BallotCard key={b.id} ballot={b} layout="test2" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {ballots.map((b) => (
            <BallotCard key={b.id} ballot={b} layout={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}

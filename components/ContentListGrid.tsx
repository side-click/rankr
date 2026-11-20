"use client";

import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import {
  ContentCard,
  type ContentCardData,
  type ContentCardLayout,
} from "@/components/ContentCard";

interface ContentListGridProps {
  ballots: ContentCardData[];
  defaultView?: ContentCardLayout;
  emptyMessage?: string;
  showCount?: boolean;
  headerLeft?: React.ReactNode;
}

export function ContentListGrid({
  ballots,
  defaultView = "grid",
  emptyMessage = "No published rankings match your filters.",
  showCount = false,
  headerLeft,
}: ContentListGridProps) {
  const [viewMode, setViewMode] = useState<ContentCardLayout>(defaultView);

  if (ballots.length === 0) {
    return (
      <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex-wrap items-center justify-between gap-2 ${
          headerLeft || showCount ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="text-[11px] text-[#a6a89e]">
          {headerLeft
            ? headerLeft
            : showCount
            ? `${ballots.length} ${ballots.length === 1 ? "ranking" : "rankings"}`
            : null}
        </div>
        <div className="xp-inset p-0.5 hidden md:inline-flex items-center gap-0.5">
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
            <ContentCard key={b.id} ballot={b} layout="grid" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {ballots.map((b) => (
              <ContentCard key={b.id} ballot={b} layout="grid" />
            ))}
          </div>
          <div className="hidden md:block space-y-2.5">
            {ballots.map((b) => (
              <ContentCard key={b.id} ballot={b} layout="list" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

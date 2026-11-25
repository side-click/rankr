"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, LogOut } from "lucide-react";
import type { ViewAsState } from "@/utils/supabase/serverAuth";

export function ViewAsBanner({ viewAs }: { viewAs: ViewAsState }) {
  const [exiting, setExiting] = useState(false);

  async function handleExit() {
    setExiting(true);
    try {
      await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "clear" }),
      });
    } finally {
      window.location.href = "/admin";
    }
  }

  const roleText =
    viewAs.mode === "operator"
      ? `League Operator (${viewAs.label ?? viewAs.leagueId})`
      : viewAs.mode === "captain"
      ? `Team Captain (${viewAs.label ?? viewAs.teamId})`
      : "Regular User";

  return (
    <div className="bg-[#2a2210] border-b border-[#c89b3c] text-[#f0ede0] text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Eye className="w-3.5 h-3.5 text-[#f0c020] shrink-0" />
        <span className="font-bold text-[#f0c020] uppercase tracking-wide">
          Preview Mode:
        </span>
        <span>
          Viewing as <strong className="text-white">{roleText}</strong>
        </span>
        <span className="text-[#a6a89e] hidden sm:inline">
          (server permissions &amp; nav reflect this role)
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {viewAs.mode === "operator" && (
          <>
            <Link
              href="/admin"
              prefetch={false}
              className="underline text-[#7cd438] hover:text-white"
            >
              Admin Console
            </Link>
            <Link
              href="/admin/stats"
              prefetch={false}
              className="underline text-[#f0c020] hover:text-white"
            >
              Stats Controls
            </Link>
            <Link
              href="/team-hub"
              prefetch={false}
              className="underline text-[#c89b3c] hover:text-white"
            >
              Team Hub
            </Link>
          </>
        )}
        {viewAs.mode === "captain" && (
          <Link
            href="/team-hub"
            prefetch={false}
            className="underline text-[#7cd438] hover:text-white"
          >
            Team Hub
          </Link>
        )}
        <button
          type="button"
          disabled={exiting}
          onClick={() => void handleExit()}
          className="xp-btn xp-btn-primary text-[11px] px-2.5 py-0.5 inline-flex items-center gap-1"
        >
          <LogOut className="w-3 h-3" />
          <span>{exiting ? "Exiting..." : "Exit Preview"}</span>
        </button>
      </div>
    </div>
  );
}

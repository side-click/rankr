"use client";

import React, { useState } from "react";
import { Copy, Users, X } from "lucide-react";
import type { UnrosteredSheetPlayer } from "@/utils/leagueStats";

interface StatsUnrosteredModalProps {
  unrosteredPlayers: UnrosteredSheetPlayer[];
  onClose: () => void;
}

export function StatsUnrosteredModal({
  unrosteredPlayers,
  onClose,
}: StatsUnrosteredModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="xp-window xp-window-scdl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="xp-titlebar xp-titlebar-scdl flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#f0c020]" />
            <span>
              Unrostered / Sub Accounts in Sheet ({unrosteredPlayers.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c7c5b8] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs bg-[#171b19]">
          <p className="text-[11px] text-[#a6a89e]">
            These summoner names appeared in the SCDL sheet but do not match any
            main roster player or linked alt account. Copy any alt Riot ID to
            add it via <strong>Setup Teams &rarr; +Alt</strong>.
          </p>
          <div className="max-h-80 overflow-y-auto border border-white/10 rounded divide-y divide-white/10 bg-black/30">
            {unrosteredPlayers.map((u) => (
              <div
                key={`${u.riotId}-${u.teamName}`}
                className="px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="tabular-nums font-bold text-[#f0ede0] truncate">
                    {u.riotId}
                  </div>
                  <div className="text-[10px] text-[#a6a89e]">
                    {u.teamName} • {u.role.toUpperCase()} • {u.games}{" "}
                    {u.games === 1 ? "game" : "games"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(u.riotId).then(() => {
                      setCopiedId(u.riotId);
                      setTimeout(() => setCopiedId(null), 1500);
                    });
                  }}
                  className="xp-btn text-[10px] px-2 py-1 shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === u.riotId ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="xp-btn text-xs">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

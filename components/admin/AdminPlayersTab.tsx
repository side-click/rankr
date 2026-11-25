"use client";

import React from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { CAPTAIN_ICON, LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import type { SeasonPlayer } from "@/types/database";

interface AdminPlayersTabProps {
  busy: boolean;
  selectedSeasonId: string;
  isDraftLeague: boolean;
  filteredSeasonPlayers: SeasonPlayer[];
  bulkPasteByRole: Record<LeagueRole, string>;
  setBulkPasteByRole: React.Dispatch<
    React.SetStateAction<Record<LeagueRole, string>>
  >;
  onClearRolePlayers: (role: LeagueRole, roleLabel: string) => void;
  onDeleteSeasonPlayer: (player: SeasonPlayer) => void;
  onBulkAddRolePlayers: (role: LeagueRole) => void;
}

export function AdminPlayersTab({
  busy,
  selectedSeasonId,
  isDraftLeague,
  filteredSeasonPlayers,
  bulkPasteByRole,
  setBulkPasteByRole,
  onClearRolePlayers,
  onDeleteSeasonPlayer,
  onBulkAddRolePlayers,
}: AdminPlayersTabProps) {
  return (
    <div className="space-y-4">
      {!selectedSeasonId ? (
        <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
          Create or select a season before adding players.
        </div>
      ) : (
        <>
          {!isDraftLeague && (
            <div className="px-3 py-2 rounded bg-[#2a2210]/90 border border-[#c89b3c]/50 text-xs text-[#f0c020] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                This season is configured as <strong>Premade Teams</strong>{" "}
                (not a Draft League) under{" "}
                <strong>Seasons &rarr; Season Config</strong>. Draft Player
                Pool is disabled.
              </span>
            </div>
          )}

          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${
              !isDraftLeague ? "opacity-45 pointer-events-none select-none" : ""
            }`}
            aria-disabled={!isDraftLeague}
          >
            {LEAGUE_ROLES.map((role) => {
              const rolePlayers = filteredSeasonPlayers.filter(
                (p) => p.role === role.key
              );
              return (
                <div
                  key={role.key}
                  className="xp-panel p-3 space-y-2.5 flex flex-col"
                >
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <img
                        src={role.icon}
                        alt={role.label}
                        className="w-4 h-4 object-contain"
                      />
                      <h3 className="font-bold text-xs uppercase text-[#f0c020]">
                        {role.label}
                      </h3>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#14171d] border border-white/15 rounded-xs text-[#d6d3c4]">
                        {rolePlayers.length}
                      </span>
                    </div>
                    {rolePlayers.length > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onClearRolePlayers(role.key, role.label)}
                        className="xp-btn xp-btn-danger text-[10px] px-1.5 py-0.5"
                        title={`Clear all ${role.label} players`}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="xp-inset p-2 min-h-[96px] max-h-48 overflow-y-auto flex flex-wrap content-start gap-1.5">
                    {rolePlayers.length === 0 ? (
                      <span className="text-[11px] text-[#7e8781] italic">
                        No {role.label} players added yet.
                      </span>
                    ) : (
                      rolePlayers.map((pl) => (
                        <span
                          key={pl.id}
                          className="inline-flex items-center gap-1 bg-[#1e232d] border border-[#3a4149] rounded-xs px-2 py-0.5 text-[11px] font-bold text-[#f0ede0]"
                        >
                          {pl.is_captain && (
                            <img
                              src={CAPTAIN_ICON}
                              alt="Captain"
                              className="w-3 h-3 object-contain"
                            />
                          )}
                          <span>{pl.name}</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDeleteSeasonPlayer(pl)}
                            className="text-[#a6a89e] hover:text-[#ff857a]"
                            title={`Remove ${pl.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 mt-auto">
                    <textarea
                      rows={3}
                      value={bulkPasteByRole[role.key] ?? ""}
                      onChange={(e) =>
                        setBulkPasteByRole((prev) => ({
                          ...prev,
                          [role.key]: e.target.value,
                        }))
                      }
                      placeholder={`Bulk paste ${role.label} players (one per line or comma-separated)...`}
                      className="w-full xp-inset px-2 py-1.5 text-[11px] resize-y"
                    />
                    <button
                      type="button"
                      disabled={busy || !(bulkPasteByRole[role.key] ?? "").trim()}
                      onClick={() => onBulkAddRolePlayers(role.key)}
                      className="xp-btn text-[11px] w-full justify-center"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add to {role.label}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

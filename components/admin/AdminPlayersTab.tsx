"use client";

import React from "react";
import { Plus, Trash2, Users, X } from "lucide-react";
import { CAPTAIN_ICON, LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import type { SeasonPlayer } from "@/types/database";

interface AdminPlayersTabProps {
  busy: boolean;
  selectedSeasonId: string;
  filteredSeasonPlayers: SeasonPlayer[];
  newSinglePlayerName: string;
  setNewSinglePlayerName: (v: string) => void;
  newSinglePlayerRole: LeagueRole;
  setNewSinglePlayerRole: (r: LeagueRole) => void;
  bulkPasteByRole: Record<LeagueRole, string>;
  setBulkPasteByRole: React.Dispatch<
    React.SetStateAction<Record<LeagueRole, string>>
  >;
  onPullPlayersFromTeams: () => void;
  onStripPlayerTaglines: () => void;
  onAddSinglePlayer: (e: React.FormEvent) => void;
  onClearRolePlayers: (role: LeagueRole, roleLabel: string) => void;
  onDeleteSeasonPlayer: (player: SeasonPlayer) => void;
  onBulkAddRolePlayers: (role: LeagueRole) => void;
}

export function AdminPlayersTab({
  busy,
  selectedSeasonId,
  filteredSeasonPlayers,
  newSinglePlayerName,
  setNewSinglePlayerName,
  newSinglePlayerRole,
  setNewSinglePlayerRole,
  bulkPasteByRole,
  setBulkPasteByRole,
  onPullPlayersFromTeams,
  onStripPlayerTaglines,
  onAddSinglePlayer,
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
          <div className="xp-panel p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                Season Player Pool ({filteredSeasonPlayers.length} players)
              </h2>
              <p className="text-[11px] text-[#a6a89e] mt-0.5">
                Pre-draft &amp; season-wide player pool organized by role
                (used for Draft Day / All-Divisions Player Tier Lists before
                teams exist).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onPullPlayersFromTeams}
                className="xp-btn xp-btn-primary text-xs"
                title="Copy roster players from all divisions/teams in this season into this pool (skips duplicates)"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Pull from Assigned Teams</span>
              </button>
              <button
                type="button"
                disabled={busy || filteredSeasonPlayers.length === 0}
                onClick={onStripPlayerTaglines}
                className="xp-btn xp-btn-danger text-xs"
                title="Remove #tagline suffixes (e.g. #NA1) from all players in this season's pool"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Strip #Taglines</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={onAddSinglePlayer}
            className="xp-panel p-3 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-[10px] font-bold text-[#c7c5b8]">
                Player Name
              </label>
              <input
                type="text"
                value={newSinglePlayerName}
                onChange={(e) => setNewSinglePlayerName(e.target.value)}
                placeholder="Summoner#NA1"
                className="xp-inset px-2 py-1 text-xs w-48"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#c7c5b8]">
                Role
              </label>
              <select
                value={newSinglePlayerRole}
                onChange={(e) =>
                  setNewSinglePlayerRole(e.target.value as LeagueRole)
                }
                className="xp-inset px-2 py-1 text-xs"
              >
                {LEAGUE_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy || !newSinglePlayerName.trim()}
              className="xp-btn text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Player</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

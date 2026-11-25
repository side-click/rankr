"use client";

import React from "react";
import { Plus, Save, Trash2, Upload, X } from "lucide-react";
import { BulkTeamRosterImporter } from "@/components/admin/AdminDataImportPanel";
import { CAPTAIN_ICON, LEAGUE_ROLES, normalizeRoster } from "@/utils/roles";
import type { Profile, Team, TeamCaptain } from "@/types/database";

interface AdminTeamsTabProps {
  busy: boolean;
  selectedDivisionId: string;
  filteredTeams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  teamCaptains: TeamCaptain[];
  profiles: Profile[];
  newCaptainDiscordByTeam: Record<string, string>;
  setNewCaptainDiscordByTeam: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  newTeamName: string;
  setNewTeamName: (v: string) => void;
  onAddTeam: (e: React.FormEvent) => void;
  onSaveTeam: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
  onLogoUpload: (teamId: string, file: File) => void;
  onOpenAltModal: (payload: {
    teamId: string;
    teamName: string;
    slotIdx: number;
    playerName: string;
    alts: string[];
  }) => void;
  onAddTeamCaptain: (teamId: string, discordId: string) => void;
  onRemoveTeamCaptain: (captainId: string) => void;
  onRevalidate: () => void;
  onRefresh: () => Promise<void>;
  onStatusMsg: (msg: string | null) => void;
}

export function AdminTeamsTab({
  busy,
  selectedDivisionId,
  filteredTeams,
  setTeams,
  teamCaptains,
  profiles,
  newCaptainDiscordByTeam,
  setNewCaptainDiscordByTeam,
  newTeamName,
  setNewTeamName,
  onAddTeam,
  onSaveTeam,
  onDeleteTeam,
  onLogoUpload,
  onOpenAltModal,
  onAddTeamCaptain,
  onRemoveTeamCaptain,
  onRevalidate,
  onRefresh,
  onStatusMsg,
}: AdminTeamsTabProps) {
  return (
    <div className="space-y-4">
      {!selectedDivisionId ? (
        <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
          Create a division for this season under &quot;Setup Divisions and
          Editions&quot; before adding teams.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTeams.map((team) => (
              <div key={team.id} className="xp-panel p-3 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 shrink-0 xp-inset p-1 flex items-center justify-center">
                    {team.logo_url ? (
                      <img
                        src={team.logo_url}
                        alt={team.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-[#7e8781]">LOGO</span>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#c7c5b8]">
                        Team Name
                      </label>
                      <input
                        type="text"
                        value={team.name}
                        onChange={(e) =>
                          setTeams((prev) =>
                            prev.map((t) =>
                              t.id === team.id
                                ? { ...t, name: e.target.value }
                                : t
                            )
                          )
                        }
                        className="w-full xp-inset px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#c7c5b8]">
                        Captain
                      </label>
                      <input
                        type="text"
                        value={team.captain ?? ""}
                        onChange={(e) =>
                          setTeams((prev) =>
                            prev.map((t) =>
                              t.id === team.id
                                ? { ...t, captain: e.target.value }
                                : t
                            )
                          )
                        }
                        className="w-full xp-inset px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={team.logo_url ?? ""}
                        onChange={(e) =>
                          setTeams((prev) =>
                            prev.map((t) =>
                              t.id === team.id
                                ? { ...t, logo_url: e.target.value }
                                : t
                            )
                          )
                        }
                        placeholder="Logo URL"
                        className="flex-1 xp-inset px-2 py-1 text-[11px]"
                      />
                      <label className="xp-btn text-[11px] px-2 py-1 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onLogoUpload(team.id, f);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#c7c5b8] mb-1.5">
                    Roster (Top / Jungle / Mid / Bot / Support)
                  </label>
                  <div className="space-y-1.5">
                    {normalizeRoster(team.roster, team.captain).map(
                      (slot, sIdx) => {
                        const roleMeta = LEAGUE_ROLES[sIdx];
                        return (
                          <div
                            key={roleMeta.key}
                            className="xp-inset px-2 py-1 flex items-center gap-2"
                          >
                            <img
                              src={roleMeta.icon}
                              alt={roleMeta.label}
                              title={roleMeta.label}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            <input
                              type="text"
                              value={slot.name}
                              onChange={(e) => {
                                const updatedName = e.target.value;
                                setTeams((prev) =>
                                  prev.map((t) => {
                                    if (t.id !== team.id) return t;
                                    const nextRoster = normalizeRoster(
                                      t.roster,
                                      t.captain
                                    ).map((r, idx) =>
                                      idx === sIdx
                                        ? { ...r, name: updatedName }
                                        : r
                                    );
                                    return { ...t, roster: nextRoster };
                                  })
                                );
                              }}
                              placeholder={roleMeta.label}
                              className="flex-1 min-w-0 bg-transparent text-xs font-mono focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onOpenAltModal({
                                  teamId: team.id,
                                  teamName: team.name,
                                  slotIdx: sIdx,
                                  playerName: slot.name || roleMeta.label,
                                  alts: [...(slot.alt_accounts ?? [])],
                                })
                              }
                              title={
                                slot.alt_accounts?.length
                                  ? `Alt accounts: ${slot.alt_accounts.join(", ")}`
                                  : "Add alt Riot ID for official match stats"
                              }
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 cursor-pointer transition ${
                                slot.alt_accounts?.length
                                  ? "bg-[#2a2210] border-[#c89b3c]/70 text-[#f0c020]"
                                  : "bg-black/30 border-white/15 text-[#a6a89e] hover:text-white hover:border-white/30"
                              }`}
                            >
                              {slot.alt_accounts?.length
                                ? `Alt (${slot.alt_accounts.length})`
                                : "+Alt"}
                            </button>
                            <label
                              className="inline-flex items-center gap-1 cursor-pointer shrink-0 text-[10px] text-[#c7c5b8]"
                              title="Set as Team Captain"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(slot.is_captain)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setTeams((prev) =>
                                    prev.map((t) => {
                                      if (t.id !== team.id) return t;
                                      const nextRoster = normalizeRoster(
                                        t.roster,
                                        t.captain
                                      ).map((r, idx) => ({
                                        ...r,
                                        is_captain:
                                          idx === sIdx ? checked : false,
                                      }));
                                      const capName = checked
                                        ? slot.name.split("#")[0].trim()
                                        : "";
                                      return {
                                        ...t,
                                        captain: capName || null,
                                        roster: nextRoster,
                                      };
                                    })
                                  );
                                }}
                                className="accent-[#f0c020]"
                              />
                              <img
                                src={CAPTAIN_ICON}
                                alt="Captain"
                                className="w-3.5 h-3.5 object-contain"
                              />
                            </label>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Discord-linked Team Hub Captains */}
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                    Team Hub Captains (Discord ID)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {teamCaptains
                      .filter((c) => c.team_id === team.id)
                      .map((c) => {
                        const prof = profiles.find(
                          (p) => p.discord_id === c.discord_id
                        );
                        return (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 border border-white/15 text-[10px] text-[#f0ede0]"
                          >
                            <span>
                              {c.label || prof?.username || c.discord_id}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onRemoveTeamCaptain(c.id)}
                              className="text-[#ff857a] hover:text-white cursor-pointer"
                              title="Remove captain"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newCaptainDiscordByTeam[team.id] ?? ""}
                      onChange={(e) =>
                        setNewCaptainDiscordByTeam((prev) => ({
                          ...prev,
                          [team.id]: e.target.value,
                        }))
                      }
                      placeholder="Discord User ID for tourney codes..."
                      className="flex-1 xp-inset px-2 py-1 text-[11px]"
                    />
                    <button
                      type="button"
                      disabled={
                        busy || !(newCaptainDiscordByTeam[team.id] ?? "").trim()
                      }
                      onClick={() =>
                        onAddTeamCaptain(
                          team.id,
                          newCaptainDiscordByTeam[team.id] ?? ""
                        )
                      }
                      className="xp-btn text-[11px] px-2 py-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteTeam(team)}
                    className="xp-btn xp-btn-danger text-xs"
                    title="Delete Team"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSaveTeam(team)}
                    className="xp-btn xp-btn-primary text-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Team</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={onAddTeam}
            className="xp-panel p-3 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-[10px] font-bold text-[#c7c5b8]">
                New Team Name
              </label>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team Name"
                className="xp-inset px-2 py-1 text-xs"
              />
            </div>
            <button type="submit" disabled={busy} className="xp-btn text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Team</span>
            </button>
          </form>

          <BulkTeamRosterImporter
            divisionId={selectedDivisionId}
            existingTeamCount={filteredTeams.length}
            busy={busy}
            onRevalidate={onRevalidate}
            onRefresh={onRefresh}
            onStatusMsg={onStatusMsg}
          />
        </>
      )}
    </div>
  );
}

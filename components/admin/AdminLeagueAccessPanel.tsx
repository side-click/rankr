"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type {
  League,
  LeagueAllowedUser,
  LeagueOperator,
  Profile,
} from "@/types/database";
import { Lock, Plus, Shield, Trash2, Unlock, UserCheck } from "lucide-react";

interface AdminLeagueAccessPanelProps {
  isSiteAdmin: boolean;
  leagues: League[];
  profiles: Profile[];
  leagueOperators: LeagueOperator[];
  leagueAllowedUsers: LeagueAllowedUser[];
  currentUserId: string;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onStatusMsg: (msg: string) => void;
}

export function AdminLeagueAccessPanel({
  isSiteAdmin,
  leagues,
  profiles,
  leagueOperators,
  leagueAllowedUsers,
  currentUserId,
  busy,
  onRefresh,
  onStatusMsg,
}: AdminLeagueAccessPanelProps) {
  const supabase = createClient();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(
    leagues[0]?.id ?? ""
  );
  const [newOperatorDiscordId, setNewOperatorDiscordId] = useState("");
  const [newOperatorLabel, setNewOperatorLabel] = useState("");
  const [newAllowedDiscordId, setNewAllowedDiscordId] = useState("");
  const [newAllowedLabel, setNewAllowedLabel] = useState("");

  useEffect(() => {
    if (!leagues.some((l) => l.id === selectedLeagueId)) {
      setSelectedLeagueId(leagues[0]?.id ?? "");
    }
  }, [leagues, selectedLeagueId]);

  const activeLeague =
    leagues.find((l) => l.id === selectedLeagueId) ?? leagues[0] ?? null;

  if (!activeLeague) return null;

  const operatorsForLeague = leagueOperators.filter(
    (o) => o.league_id === activeLeague.id
  );
  const allowedForLeague = leagueAllowedUsers.filter(
    (u) => u.league_id === activeLeague.id
  );
  const profilesWithDiscord = profiles.filter((p) => Boolean(p.discord_id));

  async function handleToggleLeagueAllowlist() {
    if (!activeLeague) return;
    const nextVal = !activeLeague.require_allowlist;
    const { error } = await supabase
      .from("leagues")
      .update({ require_allowlist: nextVal })
      .eq("id", activeLeague.id);
    if (error) {
      onStatusMsg(
        error.message.includes("column")
          ? "Error: Run migration 037_multi_league_rbac.sql first."
          : `Error: ${error.message}`
      );
      return;
    }
    onStatusMsg(
      `${activeLeague.name} creator access set to ${
        nextVal ? "Approval Required" : "Open to All"
      }.`
    );
    await onRefresh();
  }

  async function handleAddOperator(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newOperatorDiscordId.trim();
    if (!trimmed || !activeLeague) return;
    const matchedProfile = profiles.find((p) => p.discord_id === trimmed);
    const { error } = await supabase.from("league_operators").upsert(
      {
        league_id: activeLeague.id,
        discord_id: trimmed,
        label: newOperatorLabel.trim() || matchedProfile?.username || null,
        added_by: currentUserId,
      },
      { onConflict: "league_id,discord_id" }
    );
    if (error) {
      onStatusMsg(
        error.message.includes("relation")
          ? "Error: Run migration 037_multi_league_rbac.sql first."
          : `Error: ${error.message}`
      );
      return;
    }
    setNewOperatorDiscordId("");
    setNewOperatorLabel("");
    onStatusMsg(`Added league operator ${trimmed} for ${activeLeague.name}.`);
    await onRefresh();
  }

  async function handleRemoveOperator(row: LeagueOperator) {
    const { error } = await supabase
      .from("league_operators")
      .delete()
      .eq("id", row.id);
    if (error) {
      onStatusMsg(`Error: ${error.message}`);
      return;
    }
    onStatusMsg("Removed league operator.");
    await onRefresh();
  }

  async function handleAddLeagueCreator(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newAllowedDiscordId.trim();
    if (!trimmed || !activeLeague) return;
    const matchedProfile = profiles.find((p) => p.discord_id === trimmed);
    const { error } = await supabase.from("league_allowed_users").upsert(
      {
        league_id: activeLeague.id,
        discord_id: trimmed,
        label: newAllowedLabel.trim() || matchedProfile?.username || null,
        added_by: currentUserId,
      },
      { onConflict: "league_id,discord_id" }
    );
    if (error) {
      onStatusMsg(
        error.message.includes("relation")
          ? "Error: Run migration 037_multi_league_rbac.sql first."
          : `Error: ${error.message}`
      );
      return;
    }
    setNewAllowedDiscordId("");
    setNewAllowedLabel("");
    onStatusMsg(`Approved ${trimmed} for ${activeLeague.name} content.`);
    await onRefresh();
  }

  async function handleRemoveLeagueCreator(row: LeagueAllowedUser) {
    const { error } = await supabase
      .from("league_allowed_users")
      .delete()
      .eq("id", row.id);
    if (error) {
      onStatusMsg(`Error: ${error.message}`);
      return;
    }
    onStatusMsg("Removed league creator approval.");
    await onRefresh();
  }

  return (
    <div className="xp-panel p-4 space-y-4">
      <div className="space-y-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#f0c020]" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
            Assign League Operators &amp; Manage Creators
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
            League
          </span>
          <select
            value={activeLeague.id}
            onChange={(e) => setSelectedLeagueId(e.target.value)}
            className="xp-inset px-2.5 py-1 text-xs font-bold"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* League Operators (Site Admin editable) */}
        <div className="xp-inset p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#c89b3c] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>League Operators ({operatorsForLeague.length})</span>
            </div>
            {!isSiteAdmin && (
              <span className="text-[10px] text-[#a6a89e]">
                Site Admin managed
              </span>
            )}
          </div>

          {isSiteAdmin && (
            <form onSubmit={handleAddOperator} className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <input
                  type="text"
                  value={newOperatorDiscordId}
                  onChange={(e) => setNewOperatorDiscordId(e.target.value)}
                  placeholder="Discord User ID"
                  className="flex-1 min-w-[140px] xp-inset px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  value={newOperatorLabel}
                  onChange={(e) => setNewOperatorLabel(e.target.value)}
                  placeholder="Note / Name (optional)"
                  className="flex-1 min-w-[120px] xp-inset px-2 py-1 text-xs"
                />
                <button
                  type="submit"
                  disabled={busy || !newOperatorDiscordId.trim()}
                  className="xp-btn xp-btn-primary text-xs px-2.5 py-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
              {profilesWithDiscord.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const p = profilesWithDiscord.find(
                      (pr) => pr.discord_id === e.target.value
                    );
                    if (p?.discord_id) {
                      setNewOperatorDiscordId(p.discord_id);
                      setNewOperatorLabel(p.username ?? "");
                    }
                  }}
                  className="w-full xp-inset px-2 py-1 text-[11px] text-[#a6a89e]"
                >
                  <option value="">Quick-pick registered user...</option>
                  {profilesWithDiscord.map((p) => (
                    <option key={p.id} value={p.discord_id ?? ""}>
                      {p.username || "User"} ({p.discord_id})
                    </option>
                  ))}
                </select>
              )}
            </form>
          )}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {operatorsForLeague.length === 0 ? (
              <div className="text-[11px] text-[#a6a89e] py-1">
                No league operators assigned yet.
              </div>
            ) : (
              operatorsForLeague.map((op) => {
                const matched = profiles.find(
                  (p) => p.discord_id === op.discord_id
                );
                return (
                  <div
                    key={op.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-black/30 border border-white/10 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#f0ede0] truncate">
                        {op.label || matched?.username || op.discord_id}
                      </div>
                      <div className="text-[10px] text-[#a6a89e] tabular-nums">
                        {op.discord_id}
                      </div>
                    </div>
                    {isSiteAdmin && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemoveOperator(op)}
                        className="xp-btn px-2 py-0.5 text-[11px] text-[#ff857a]"
                        title="Remove operator"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Scoped League Creator Allowlist */}
        <div className="xp-inset p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#7cd438] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>League Creators ({allowedForLeague.length})</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleToggleLeagueAllowlist}
              className={`xp-btn text-[11px] px-2.5 py-1 ${
                activeLeague.require_allowlist ? "xp-btn-primary" : ""
              }`}
              title="Controls who can create TPRs, Tier Lists, and League-tagged Blogs for this league"
            >
              {activeLeague.require_allowlist ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Approval Required</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3" />
                  <span>Open to All</span>
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleAddLeagueCreator} className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <input
                type="text"
                value={newAllowedDiscordId}
                onChange={(e) => setNewAllowedDiscordId(e.target.value)}
                placeholder="Discord User ID"
                className="flex-1 min-w-[140px] xp-inset px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={newAllowedLabel}
                onChange={(e) => setNewAllowedLabel(e.target.value)}
                placeholder="Name / Note (optional)"
                className="flex-1 min-w-[120px] xp-inset px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={busy || !newAllowedDiscordId.trim()}
                className="xp-btn xp-btn-primary text-xs px-2.5 py-1"
              >
                <Plus className="w-3 h-3" />
                <span>Approve</span>
              </button>
            </div>
            {profilesWithDiscord.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const p = profilesWithDiscord.find(
                    (pr) => pr.discord_id === e.target.value
                  );
                  if (p?.discord_id) {
                    setNewAllowedDiscordId(p.discord_id);
                    setNewAllowedLabel(p.username ?? "");
                  }
                }}
                className="w-full xp-inset px-2 py-1 text-[11px] text-[#a6a89e]"
              >
                <option value="">Quick-pick registered user...</option>
                {profilesWithDiscord.map((p) => (
                  <option key={p.id} value={p.discord_id ?? ""}>
                    {p.username || "User"} ({p.discord_id})
                  </option>
                ))}
              </select>
            )}
          </form>

          {!activeLeague.require_allowlist && (
            <div className="text-[11px] text-[#a6a89e]">
              League is currently open to any signed-in user.
            </div>
          )}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {allowedForLeague.length === 0 ? (
              activeLeague.require_allowlist ? (
                <div className="text-[11px] text-[#a6a89e] py-1">
                  No approved creators added yet.
                </div>
              ) : null
            ) : (
              allowedForLeague.map((u) => {
                const matched = profiles.find(
                  (p) => p.discord_id === u.discord_id
                );
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-black/30 border border-white/10 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#f0ede0] truncate">
                        {u.label || matched?.username || u.discord_id}
                      </div>
                      <div className="text-[10px] text-[#a6a89e] tabular-nums">
                        {u.discord_id}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemoveLeagueCreator(u)}
                      className="xp-btn px-2 py-0.5 text-[11px] text-[#ff857a]"
                      title="Remove approval"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

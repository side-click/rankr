"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Ban,
  Check,
  ExternalLink,
  Plus,
  Power,
  Save,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { AdminLeagueAccessPanel } from "@/components/admin/AdminLeagueAccessPanel";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import type { AdminRankingItem } from "@/utils/adminRankingActions";
import { BUILTIN_SAFE_WORDS } from "@/utils/contentModeration";
import type {
  AllowedDiscordUser,
  AppSettings,
  League,
  LeagueAllowedUser,
  LeagueOperator,
  Profile,
} from "@/types/database";

export interface ModerationEventRow {
  id: string;
  user_id: string | null;
  league_id?: string | null;
  content_type: "ranking" | "tierlist" | "blog";
  content_id: string | null;
  action: "blocked" | "auto_unpublished" | "flagged" | "media_review";
  categories: string[];
  field_names: string[];
  matched_terms: string[];
  title_snapshot: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface ModerationRuleRow {
  id: string;
  term: string;
  rule_type: "allow" | "block" | "flag";
}

interface AdminModerationTabProps {
  busy: boolean;
  isSiteAdmin: boolean;
  currentUserId: string;
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  leagues: League[];
  profiles: Profile[];
  publishedBallots: AdminRankingItem[];
  allowedUsers: AllowedDiscordUser[];
  allowedIdSet: Set<string>;
  leagueOperators: LeagueOperator[];
  leagueAllowedUsers: LeagueAllowedUser[];
  existingBlogIds: Set<string>;
  moderationRules: ModerationRuleRow[];
  moderationRulesError: string | null;
  moderationEvents: ModerationEventRow[];
  moderationLoading: boolean;
  moderationError: string | null;
  newAllowedDiscordId: string;
  setNewAllowedDiscordId: (v: string) => void;
  newAllowedLabel: string;
  setNewAllowedLabel: (v: string) => void;
  showAllowlist: boolean;
  setShowAllowlist: React.Dispatch<React.SetStateAction<boolean>>;
  allowlistSearch: string;
  setAllowlistSearch: (v: string) => void;
  userSearch: string;
  setUserSearch: (v: string) => void;
  newRuleType: "allow" | "block" | "flag";
  setNewRuleType: (v: "allow" | "block" | "flag") => void;
  newRuleTerm: string;
  setNewRuleTerm: (v: string) => void;
  onToggleKillSwitch: () => void;
  onSaveMaintenanceMessage: () => void;
  onToggleAllowlistMode: () => void;
  onAddAllowedUser: (discordId: string, label?: string | null) => void;
  onRemoveAllowedUser: (discordId: string) => void;
  onOpenMoveEditionModal: (ballot: AdminRankingItem) => void;
  onDeleteBallot: (ballot: AdminRankingItem) => void;
  onToggleBanUser: (profile: Profile) => void;
  onRefresh: () => Promise<void>;
  onStatusMsg: (msg: string | null) => void;
  onAddModerationRule: (e: React.FormEvent) => void;
  onDeleteModerationRule: (ruleId: string) => void;
  onLoadModerationEvents: () => void;
  onToggleModerationResolved: (id: string, resolved: boolean) => void;
  onDeleteModerationEvent: (id: string, label: string) => void;
  onModerateContent: (
    ev: ModerationEventRow,
    action: "unpublish" | "delete"
  ) => void;
}

export function AdminModerationTab({
  busy,
  isSiteAdmin,
  currentUserId,
  appSettings,
  setAppSettings,
  leagues,
  profiles,
  publishedBallots,
  allowedUsers,
  allowedIdSet,
  leagueOperators,
  leagueAllowedUsers,
  existingBlogIds,
  moderationRules,
  moderationRulesError,
  moderationEvents,
  moderationLoading,
  moderationError,
  newAllowedDiscordId,
  setNewAllowedDiscordId,
  newAllowedLabel,
  setNewAllowedLabel,
  showAllowlist,
  setShowAllowlist,
  allowlistSearch,
  setAllowlistSearch,
  userSearch,
  setUserSearch,
  newRuleType,
  setNewRuleType,
  newRuleTerm,
  setNewRuleTerm,
  onToggleKillSwitch,
  onSaveMaintenanceMessage,
  onToggleAllowlistMode,
  onAddAllowedUser,
  onRemoveAllowedUser,
  onOpenMoveEditionModal,
  onDeleteBallot,
  onToggleBanUser,
  onRefresh,
  onStatusMsg,
  onAddModerationRule,
  onDeleteModerationRule,
  onLoadModerationEvents,
  onToggleModerationResolved,
  onDeleteModerationEvent,
  onModerateContent,
}: AdminModerationTabProps) {
  return (
    <div className="space-y-4">
      {isSiteAdmin && (
        <>
          {/* Global Kill Switch */}
          <div className="xp-panel p-3 space-y-3 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-5 h-5 ${
                    appSettings.maintenance_mode
                      ? "text-[#ff857a]"
                      : "text-[#7cd438]"
                  }`}
                />
                <div>
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Global Kill Switch
                  </h2>
                  <p className="text-[11px] text-[#a6a89e]">
                    Temporarily take Rankr offline for all non-admin users while
                    you adjust safety measures.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onToggleKillSwitch}
                className={`xp-btn text-xs ${
                  appSettings.maintenance_mode
                    ? "xp-btn-primary"
                    : "xp-btn-danger"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {appSettings.maintenance_mode
                    ? "Disable Kill Switch (Go Online)"
                    : "Enable Kill Switch (Go Offline)"}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={appSettings.maintenance_message}
                onChange={(e) =>
                  setAppSettings((prev) => ({
                    ...prev,
                    maintenance_message: e.target.value,
                  }))
                }
                placeholder="Maintenance message shown to users..."
                className="flex-1 min-w-[220px] xp-inset px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={busy}
                onClick={onSaveMaintenanceMessage}
                className="xp-btn text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Message</span>
              </button>
            </div>
          </div>

          {/* Discord Allowlist (Invite-Only Authoring) */}
          <div className="xp-panel p-3 space-y-3 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCheck
                  className={`w-5 h-5 ${
                    appSettings.require_allowlist
                      ? "text-[#7cd438]"
                      : "text-[#a6a89e]"
                  }`}
                />
                <div>
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Global Discord Creator Allowlist (Blogs &amp; Site-Wide)
                  </h2>
                  <p className="text-[11px] text-[#a6a89e]">
                    Controls who can create untagged general blog posts.
                    League-specific TPRs, Tier Lists, and league-tagged Blogs are
                    governed by each league&apos;s creator access settings above.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onToggleAllowlistMode}
                className={`xp-btn text-xs ${
                  appSettings.require_allowlist ? "xp-btn-primary" : ""
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  {appSettings.require_allowlist
                    ? "Allowlist Active (Click to Open)"
                    : "Require Allowlist"}
                </span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddAllowedUser(newAllowedDiscordId, newAllowedLabel);
              }}
              className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10"
            >
              <input
                type="text"
                value={newAllowedDiscordId}
                onChange={(e) => setNewAllowedDiscordId(e.target.value)}
                placeholder="Discord User ID (e.g. 123456789012345678)"
                className="flex-1 min-w-[200px] xp-inset px-2.5 py-1.5 text-xs font-mono"
              />
              <input
                type="text"
                value={newAllowedLabel}
                onChange={(e) => setNewAllowedLabel(e.target.value)}
                placeholder="Label / Name (optional)"
                className="w-48 xp-inset px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy || !newAllowedDiscordId.trim()}
                className="xp-btn xp-btn-primary text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Discord ID</span>
              </button>
            </form>

            {allowedUsers.length > 0 && (
              <div className="pt-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllowlist((prev) => !prev)}
                    className="xp-btn text-xs"
                  >
                    <span>
                      {showAllowlist
                        ? `Hide Allowlisted IDs (${allowedUsers.length})`
                        : `Show Allowlisted IDs (${allowedUsers.length})`}
                    </span>
                  </button>
                  <Link
                    href="/admin/users"
                    prefetch={false}
                    className="xp-btn text-xs"
                  >
                    <span>Manage on Users Log &rarr;</span>
                  </Link>
                </div>

                {showAllowlist && (
                  <div className="xp-inset p-2 space-y-2">
                    <input
                      type="text"
                      value={allowlistSearch}
                      onChange={(e) => setAllowlistSearch(e.target.value)}
                      placeholder="Filter allowlist by name or Discord ID..."
                      className="w-full xp-inset px-2.5 py-1 text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {allowedUsers
                        .filter((entry) => {
                          const q = allowlistSearch.trim().toLowerCase();
                          if (!q) return true;
                          const matchedProfile = profiles.find(
                            (p) => p.discord_id === entry.discord_id
                          );
                          const displayName = (
                            entry.label ||
                            matchedProfile?.username ||
                            ""
                          ).toLowerCase();
                          return (
                            displayName.includes(q) ||
                            entry.discord_id.toLowerCase().includes(q)
                          );
                        })
                        .map((entry) => {
                          const matchedProfile = profiles.find(
                            (p) => p.discord_id === entry.discord_id
                          );
                          const displayName =
                            entry.label ||
                            matchedProfile?.username ||
                            "Approved";
                          const shortId =
                            entry.discord_id.length > 4
                              ? `#${entry.discord_id.slice(-4)}`
                              : entry.discord_id;
                          return (
                            <div
                              key={entry.discord_id}
                              title={`Discord ID: ${entry.discord_id}`}
                              className="xp-panel px-2 py-1 text-[11px] flex items-center gap-1.5"
                            >
                              <span className="font-bold text-[#f0ede0]">
                                {displayName}
                              </span>
                              <code className="text-[10px] text-[#a6a89e] font-mono">
                                {shortId}
                              </code>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  onRemoveAllowedUser(entry.discord_id)
                                }
                                className="text-[#ff857a] hover:text-white ml-0.5"
                                title={`Remove ${entry.discord_id} from allowlist`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Published Rankings Moderation */}
            <div className="lg:col-span-6 xp-panel p-3 flex flex-col justify-between gap-2.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Recent Published Rankings ({Math.min(publishedBallots.length, 4)} of{" "}
                    {publishedBallots.length})
                  </h2>
                </div>
                <div className="space-y-1.5">
                  {publishedBallots.length === 0 ? (
                    <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                      No published rankings found.
                    </div>
                  ) : (
                    publishedBallots.slice(0, 4).map((b) => {
                      const author = Array.isArray(b.profiles)
                        ? b.profiles[0]
                        : b.profiles;
                      return (
                        <div
                          key={b.id}
                          className="xp-inset p-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                title={
                                  b.ranking_type === "player"
                                    ? "Player Tier List"
                                    : "Team Power Rankings"
                                }
                                className="w-5 h-5 rounded bg-[#2a2210] border border-[#c89b3c]/70 inline-flex items-center justify-center shrink-0"
                              >
                                {b.ranking_type === "player" ? (
                                  <User className="w-3 h-3 text-[#f0c020]" />
                                ) : (
                                  <TeamGroupIcon className="w-3 h-3 text-[#f0c020]" />
                                )}
                              </span>
                              <span className="font-bold text-[#f0ede0] truncate">
                                {b.title || "Untitled Ranking"}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#a6a89e] truncate">
                              By {author?.username ?? "Unknown"}
                              {author?.is_banned ? " (BANNED)" : ""} &bull;{" "}
                              {b.published_at
                                ? new Date(b.published_at).toLocaleDateString()
                                : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {b.season_id && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onOpenMoveEditionModal(b)}
                                className="xp-btn text-[11px] px-2 py-1"
                                title="Move / Force-Overwrite to Different Edition"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                              </button>
                            )}
                            <Link
                              href={
                                b.ranking_type === "player"
                                  ? `/tierlist/${b.id}`
                                  : `/rankings/${b.id}`
                              }
                              prefetch={false}
                              className="xp-btn text-[11px] px-2 py-1"
                              title="View Ranking"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onDeleteBallot(b)}
                              className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                              title="Delete Published Ranking"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <Link
                href="/admin/publishings"
                prefetch={false}
                className="xp-btn text-xs w-full justify-center"
              >
                <span>
                  View All Publishings Log ({publishedBallots.length}) &rarr;
                </span>
              </Link>
            </div>

            {/* Discord User Moderation / Bans */}
            <div className="lg:col-span-6 xp-panel p-3 flex flex-col justify-between gap-2.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Users ({Math.min(profiles.length, 4)} of {profiles.length})
                  </h2>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user or Discord ID..."
                    className="xp-inset px-2 py-1 text-xs w-48"
                  />
                </div>
                <div className="space-y-1.5">
                  {profiles
                    .filter((p) => {
                      const q = userSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.username.toLowerCase().includes(q) ||
                        (p.discord_id ?? "").toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 4)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="xp-inset p-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {p.avatar_url && (
                            <img
                              src={p.avatar_url}
                              alt={p.username}
                              className="w-6 h-6 rounded-xs object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#f0ede0] truncate">
                                {p.username}
                              </span>
                              {p.is_admin && (
                                <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#2d5a3f] text-[#7cd438] rounded-xs">
                                  Admin
                                </span>
                              )}
                              {!p.is_admin &&
                                p.discord_id &&
                                allowedIdSet.has(p.discord_id) && (
                                  <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#1f3d5a] text-[#7cc4ff] rounded-xs">
                                    Allowed
                                  </span>
                                )}
                              {p.is_banned && (
                                <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#451717] text-[#ff857a] rounded-xs">
                                  Banned
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#a6a89e] truncate">
                              Discord ID: {p.discord_id ?? "N/A"}
                              {p.ban_reason ? ` \u2022 Reason: ${p.ban_reason}` : ""}
                            </div>
                          </div>
                        </div>
                        {p.id !== currentUserId && !p.is_admin && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {p.discord_id &&
                              (allowedIdSet.has(p.discord_id) ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    onRemoveAllowedUser(p.discord_id!)
                                  }
                                  className="xp-btn text-[11px] px-2 py-1"
                                  title="Remove from allowlist"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Revoke</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    onAddAllowedUser(p.discord_id!, p.username)
                                  }
                                  className="xp-btn xp-btn-primary text-[11px] px-2 py-1"
                                  title="Approve Discord user for ranking"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              ))}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onToggleBanUser(p)}
                              className={`xp-btn text-[11px] px-2 py-1 ${
                                p.is_banned ? "xp-btn-primary" : "xp-btn-danger"
                              }`}
                            >
                              <Ban className="w-3 h-3" />
                              <span>{p.is_banned ? "Unban" : "Ban"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
              {profiles.length > 4 && (
                <Link
                  href="/admin/users"
                  prefetch={false}
                  className="xp-btn text-xs w-full justify-center"
                >
                  <span>View All Users Log ({profiles.length}) &rarr;</span>
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      <AdminLeagueAccessPanel
        isSiteAdmin={isSiteAdmin}
        leagues={leagues}
        profiles={profiles}
        leagueOperators={leagueOperators}
        leagueAllowedUsers={leagueAllowedUsers}
        currentUserId={currentUserId}
        busy={busy}
        onRefresh={onRefresh}
        onStatusMsg={onStatusMsg}
      />

      {isSiteAdmin && (
        <>
          {/* Custom Moderation Rules (Allowlist / Block / Flag) */}
          <div className="xp-panel p-3 space-y-2.5">
            <h2 className="font-bold text-xs uppercase text-[#f0c020]">
              Custom Moderation Rules ({moderationRules.length})
            </h2>
            {moderationRulesError ? (
              <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                Run migration{" "}
                <code className="text-[#f0c020]">029_moderation_rules.sql</code>{" "}
                in Supabase to manage custom allowlist/block/flag rules here.
              </div>
            ) : (
              <>
                <form
                  onSubmit={onAddModerationRule}
                  className="flex flex-wrap items-center gap-2"
                >
                  <select
                    value={newRuleType}
                    onChange={(e) =>
                      setNewRuleType(
                        e.target.value as "allow" | "block" | "flag"
                      )
                    }
                    className="xp-inset px-2 py-1 text-xs"
                  >
                    <option value="allow">Allowlist (Safe)</option>
                    <option value="block">Block (Hard)</option>
                    <option value="flag">Flag (Soft Alert)</option>
                  </select>
                  <input
                    type="text"
                    value={newRuleTerm}
                    onChange={(e) => setNewRuleTerm(e.target.value)}
                    placeholder="Word or phrase (e.g. player IGN or custom term)..."
                    className="xp-inset px-2.5 py-1 text-xs flex-1 min-w-[200px]"
                  />
                  <button
                    type="submit"
                    disabled={busy || !newRuleTerm.trim()}
                    className="xp-btn xp-btn-primary text-xs"
                  >
                    + Add Rule
                  </button>
                </form>

                {(() => {
                  const customAllow = moderationRules
                    .filter((r) => r.rule_type === "allow")
                    .map((r) => ({ id: r.id, term: r.term, builtIn: false }));
                  const builtInAllow = Array.from(BUILTIN_SAFE_WORDS).map(
                    (w) => ({ id: `builtin:${w}`, term: w, builtIn: true })
                  );
                  const allowList = [...customAllow, ...builtInAllow].sort(
                    (a, b) => a.term.localeCompare(b.term)
                  );
                  const blockList = moderationRules
                    .filter((r) => r.rule_type === "block")
                    .sort((a, b) => a.term.localeCompare(b.term));
                  const flagList = moderationRules
                    .filter((r) => r.rule_type === "flag")
                    .sort((a, b) => a.term.localeCompare(b.term));

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                      {/* Allowlist */}
                      <div className="xp-inset p-2 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#7cd438]">
                          Allowlist ({allowList.length})
                        </div>
                        <div className="max-h-[160px] overflow-y-auto divide-y divide-white/5 pr-1">
                          {allowList.map((item) => (
                            <div
                              key={item.id}
                              className="py-1 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-[#e8e5d8] truncate">
                                {item.term}
                              </span>
                              {item.builtIn ? (
                                <span className="text-[9px] uppercase text-[#6e7268] shrink-0">
                                  built-in
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onDeleteModerationRule(item.id)}
                                  className="text-[#a6a89e] hover:text-[#ff857a] shrink-0 cursor-pointer"
                                  title="Delete rule"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Block */}
                      <div className="xp-inset p-2 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#ff857a]">
                          Block ({blockList.length})
                        </div>
                        <div className="max-h-[160px] overflow-y-auto divide-y divide-white/5 pr-1">
                          {blockList.length === 0 ? (
                            <div className="py-2 text-[11px] text-[#6e7268]">
                              No custom block rules
                            </div>
                          ) : (
                            blockList.map((rule) => (
                              <div
                                key={rule.id}
                                className="py-1 flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-[#e8e5d8] truncate">
                                  {rule.term}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onDeleteModerationRule(rule.id)}
                                  className="text-[#a6a89e] hover:text-[#ff857a] shrink-0 cursor-pointer"
                                  title="Delete rule"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Flag */}
                      <div className="xp-inset p-2 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#f0c020]">
                          Flag ({flagList.length})
                        </div>
                        <div className="max-h-[160px] overflow-y-auto divide-y divide-white/5 pr-1">
                          {flagList.length === 0 ? (
                            <div className="py-2 text-[11px] text-[#6e7268]">
                              No custom flag rules
                            </div>
                          ) : (
                            flagList.map((rule) => (
                              <div
                                key={rule.id}
                                className="py-1 flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-[#e8e5d8] truncate">
                                  {rule.term}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onDeleteModerationRule(rule.id)}
                                  className="text-[#a6a89e] hover:text-[#ff857a] shrink-0 cursor-pointer"
                                  title="Delete rule"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </>
      )}

      {/* Moderation Alerts Log (Site Admins see all; League Operators see their league's alerts) */}
      <div className="xp-panel p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-xs uppercase text-[#f0c020]">
            Moderation Alerts Log ({moderationEvents.length})
            {!isSiteAdmin && (
              <span className="ml-1.5 text-[10px] font-normal text-[#a6a89e] normal-case">
                (filtered to your assigned league
                {leagues.length === 1 ? "" : "s"})
              </span>
            )}
          </h2>
          <button
            type="button"
            disabled={moderationLoading}
            onClick={onLoadModerationEvents}
            className="xp-btn text-[11px] px-2.5 py-1"
          >
            {moderationLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {moderationError ? (
          <div className="xp-inset p-3 text-xs text-[#a6a89e]">
            Run migrations{" "}
            <code className="text-[#f0c020]">028_moderation_events.sql</code>{" "}
            and{" "}
            <code className="text-[#f0c020]">
              040_moderation_events_league_scope.sql
            </code>{" "}
            in Supabase to enable the Moderation Alerts Log.
          </div>
        ) : moderationEvents.length === 0 ? (
          <div className="xp-inset p-3 text-xs text-[#a6a89e]">
            {moderationLoading
              ? "Loading moderation events..."
              : "No moderation events recorded yet."}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {moderationEvents.map((ev) => {
              const authorProfile = ev.user_id
                ? profiles.find((p) => p.id === ev.user_id)
                : null;
              const matchedLeague = ev.league_id
                ? leagues.find((l) => l.id === ev.league_id)
                : null;
              const contentExists =
                Boolean(ev.content_id) &&
                ev.action !== "blocked" &&
                ev.action !== "auto_unpublished" &&
                (ev.content_type === "blog"
                  ? existingBlogIds.has(ev.content_id!)
                  : publishedBallots.some((b) => b.id === ev.content_id));
              const contentHref = contentExists
                ? ev.content_type === "blog"
                  ? `/blog/${ev.content_id}`
                  : ev.content_type === "tierlist"
                  ? `/tierlist/${ev.content_id}`
                  : `/rankings/${ev.content_id}`
                : null;
              const badgeStyle =
                ev.action === "blocked" || ev.action === "auto_unpublished"
                  ? "bg-[#3d1414] border-[#ff857a]/60 text-[#ff857a]"
                  : ev.action === "flagged"
                  ? "bg-[#3d2e12] border-[#f0c020]/60 text-[#f0c020]"
                  : "bg-[#11241a] border-[#2f6343] text-[#7cd438]";
              const actionLabel =
                ev.action === "auto_unpublished"
                  ? "Auto-Unpublished"
                  : ev.action === "media_review"
                  ? "Media Review"
                  : ev.action === "blocked"
                  ? "Blocked"
                  : "Flagged";
              return (
                <div
                  key={ev.id}
                  className={`xp-inset p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
                    ev.resolved ? "opacity-55" : ""
                  }`}
                >
                  <div className="min-w-0 space-y-0.5 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${badgeStyle}`}
                      >
                        {actionLabel}
                      </span>
                      {matchedLeague && (
                        <span className="px-1.5 py-0.5 rounded border border-[#c89b3c]/40 bg-[#2a2210] text-[10px] font-bold text-[#f0c020]">
                          {matchedLeague.short_name || matchedLeague.name}
                        </span>
                      )}
                      <span className="font-bold text-[#f0ede0] truncate">
                        {ev.title_snapshot || `Untitled ${ev.content_type}`}
                      </span>
                      <span className="text-[11px] text-[#a6a89e]">
                        by{" "}
                        <strong className="text-[#d6d3c4]">
                          {authorProfile?.username ?? "Unknown"}
                        </strong>
                      </span>
                      <span className="text-[10px] text-[#8e9286]">
                        &bull; {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#a6a89e] flex flex-wrap gap-x-3 gap-y-0.5">
                      {ev.field_names.length > 0 && (
                        <span>Fields: {ev.field_names.join(", ")}</span>
                      )}
                      {ev.categories.length > 0 && (
                        <span>
                          Categories: {ev.categories.join(", ")}
                        </span>
                      )}
                      {ev.matched_terms.length > 0 && (
                        <span className="text-[#ff857a]">
                          Terms: {ev.matched_terms.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {contentHref && (
                      <Link
                        href={contentHref}
                        prefetch={false}
                        className="xp-btn text-[11px] px-2 py-1"
                        title="Open published content"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    {contentExists && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onModerateContent(ev, "unpublish")}
                          className="xp-btn text-[11px] px-2 py-1 text-[#f0c020] border-[#c89b3c]/50"
                          title="Revert published content back to draft and resolve alert"
                        >
                          Unpublish
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onModerateContent(ev, "delete")}
                          className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                          title="Permanently delete content and resolve alert"
                        >
                          Delete Post
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onToggleModerationResolved(ev.id, ev.resolved)
                      }
                      className={`xp-btn text-[11px] px-2.5 py-1 ${
                        ev.resolved ? "" : "xp-btn-primary"
                      }`}
                    >
                      {ev.resolved ? "Reopen" : "Resolve"}
                    </button>
                    {(ev.action === "blocked" ||
                      ev.action === "auto_unpublished" ||
                      ev.resolved ||
                      !ev.content_id ||
                      ((ev.content_type === "ranking" ||
                        ev.content_type === "tierlist") &&
                        !publishedBallots.some(
                          (b) => b.id === ev.content_id
                        )) ||
                      (ev.content_type === "blog" &&
                        !existingBlogIds.has(ev.content_id))) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onDeleteModerationEvent(
                            ev.id,
                            ev.title_snapshot || ev.content_type
                          )
                        }
                        className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                        title="Remove alert from log"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

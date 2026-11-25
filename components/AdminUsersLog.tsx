"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { AllowedDiscordUser, Profile } from "@/types/database";
import { ArrowLeft, Ban, Check, Search, X } from "lucide-react";

interface Props {
  currentUserId: string;
  initialProfiles: Profile[];
  initialAllowedUsers: AllowedDiscordUser[];
}

export function AdminUsersLog({
  currentUserId,
  initialProfiles,
  initialAllowedUsers,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [allowedUsers, setAllowedUsers] =
    useState<AllowedDiscordUser[]>(initialAllowedUsers);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "allowed" | "unapproved" | "banned" | "admin" | "pending"
  >(() => {
    const s = searchParams.get("status");
    if (
      s === "allowed" ||
      s === "unapproved" ||
      s === "banned" ||
      s === "admin" ||
      s === "pending"
    ) {
      return s;
    }
    return "all";
  });
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("q") ?? ""
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");

    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [pathname, searchParams, statusFilter, searchQuery]);

  const allowedIdSet = useMemo(
    () => new Set(allowedUsers.map((u) => u.discord_id)),
    [allowedUsers]
  );

  const profileDiscordIdSet = useMemo(
    () =>
      new Set(
        profiles.map((p) => p.discord_id).filter((id): id is string => Boolean(id))
      ),
    [profiles]
  );

  const pendingAllowedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allowedUsers.filter((u) => {
      if (profileDiscordIdSet.has(u.discord_id)) return false;
      if (!q) return true;
      return (
        (u.label ?? "").toLowerCase().includes(q) ||
        u.discord_id.toLowerCase().includes(q)
      );
    });
  }, [allowedUsers, profileDiscordIdSet, searchQuery]);

  const filteredProfiles = useMemo(() => {
    if (statusFilter === "pending") return [];
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      const isAllowed = Boolean(p.discord_id && allowedIdSet.has(p.discord_id));
      if (statusFilter === "allowed" && !isAllowed) return false;
      if (statusFilter === "unapproved" && (isAllowed || p.is_admin))
        return false;
      if (statusFilter === "banned" && !p.is_banned) return false;
      if (statusFilter === "admin" && !p.is_admin) return false;

      if (q) {
        const username = p.username.toLowerCase();
        const discordId = (p.discord_id ?? "").toLowerCase();
        if (!username.includes(q) && !discordId.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, allowedIdSet, statusFilter, searchQuery]);

  const hasFilters = Boolean(statusFilter !== "all" || searchQuery.trim());

  function resetFilters() {
    setStatusFilter("all");
    setSearchQuery("");
  }

  async function handleAddAllowedUser(discordId: string, label?: string | null) {
    const trimmed = discordId.trim();
    if (!trimmed) return;
    setBusy(true);
    const { error } = await supabase.from("allowed_discord_users").upsert({
      discord_id: trimmed,
      label: label?.trim() || null,
      added_by: currentUserId,
    });
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setAllowedUsers((prev) => {
        if (prev.some((u) => u.discord_id === trimmed)) return prev;
        return [
          {
            discord_id: trimmed,
            label: label?.trim() || null,
            added_by: currentUserId,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ];
      });
      setStatusMsg(`Allowlisted Discord ID ${trimmed}.`);
      router.refresh();
    }
    setBusy(false);
  }

  async function handleRemoveAllowedUser(discordId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("allowed_discord_users")
      .delete()
      .eq("discord_id", discordId);
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setAllowedUsers((prev) =>
        prev.filter((u) => u.discord_id !== discordId)
      );
      setStatusMsg(`Removed Discord ID ${discordId} from allowlist.`);
      router.refresh();
    }
    setBusy(false);
  }

  async function handleToggleBanUser(target: Profile) {
    if (target.id === currentUserId) return;
    const nextBanned = !target.is_banned;
    let reason: string | null = null;
    if (nextBanned) {
      const input = prompt(
        `Ban "${target.username}"? Enter an optional reason (or leave blank):`,
        target.ban_reason ?? ""
      );
      if (input === null) return;
      reason = input.trim() || null;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        is_banned: nextBanned,
        ban_reason: nextBanned ? reason : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === target.id
            ? {
                ...p,
                is_banned: nextBanned,
                ban_reason: nextBanned ? reason : null,
              }
            : p
        )
      );
      setStatusMsg(
        nextBanned ? `Banned ${target.username}.` : `Unbanned ${target.username}.`
      );
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin" className="xp-btn text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Admin Console</span>
        </Link>
        <div className="text-xs text-[#a6a89e]">
          Showing{" "}
          <span className="font-bold text-[#f0ede0]">
            {filteredProfiles.length}
          </span>{" "}
          of{" "}
          <span className="font-bold text-[#f0ede0]">{profiles.length}</span>{" "}
          users
        </div>
      </div>

      {statusMsg && (
        <div className="xp-inset px-3 py-2 text-xs text-[#f0c020] flex items-center justify-between gap-2">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-[#a6a89e] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="xp-panel p-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="block space-y-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#f0c020]">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "all"
                    | "allowed"
                    | "unapproved"
                    | "banned"
                    | "admin"
                    | "pending"
                )
              }
              className="xp-inset px-2.5 py-1.5 text-xs block"
            >
              <option value="all">All Users</option>
              <option value="allowed">Allowed</option>
              <option value="pending">Pending Allowlist (Not Signed In)</option>
              <option value="unapproved">Not Allowed</option>
              <option value="banned">Banned</option>
              <option value="admin">Admins</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs flex-1 min-w-[200px]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#f0c020]">
              Username / Discord ID
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#a6a89e] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user or Discord ID..."
                className="xp-inset pl-7 pr-2.5 py-1.5 text-xs w-full"
              />
            </div>
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="xp-btn text-xs"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Users List */}
      {statusFilter !== "pending" && (
        <div className="xp-panel p-2.5 space-y-1.5">
          {filteredProfiles.length === 0 ? (
            <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
              No users match the current filters.
            </div>
          ) : (
            filteredProfiles.map((p) => (
              <div
                key={p.id}
                className="xp-inset px-3 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {p.avatar_url && (
                    <img
                      src={p.avatar_url}
                      alt={p.username}
                      className="w-7 h-7 rounded-xs object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[#f0ede0] truncate">
                        {p.username}
                      </span>
                      {p.is_admin && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#1b3a27] text-[#9be85d] rounded-xs">
                          Admin
                        </span>
                      )}
                      {!p.is_admin &&
                        p.discord_id &&
                        allowedIdSet.has(p.discord_id) && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#1f3d5a] text-[#7cc4ff] rounded-xs">
                            Allowed
                          </span>
                        )}
                      {p.is_banned && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#451717] text-[#ff857a] rounded-xs">
                          Banned
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#a6a89e] truncate">
                      Discord ID: {p.discord_id ?? "N/A"}
                      {p.ban_reason ? ` • Reason: ${p.ban_reason}` : ""}
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
                          onClick={() => void handleRemoveAllowedUser(p.discord_id!)}
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
                            void handleAddAllowedUser(p.discord_id!, p.username)
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
                      onClick={() => void handleToggleBanUser(p)}
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
            ))
          )}
        </div>
      )}

      {/* Pending Allowlist IDs (Not Yet Signed In) */}
      {(statusFilter === "pending" ||
        (statusFilter === "all" && pendingAllowedUsers.length > 0)) && (
        <div className="xp-panel p-2.5 space-y-1.5">
          <h2 className="font-bold text-xs uppercase text-[#f0c020] px-1">
            Pending Allowlist — Not Yet Signed In ({pendingAllowedUsers.length})
          </h2>
          {pendingAllowedUsers.length === 0 ? (
            <div className="xp-inset p-4 text-center text-xs text-[#a6a89e]">
              No pending allowlisted Discord IDs match the current search.
            </div>
          ) : (
            pendingAllowedUsers.map((entry) => (
              <div
                key={entry.discord_id}
                className="xp-inset px-3 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[#f0ede0] truncate">
                      {entry.label || "Pending User"}
                    </span>
                    <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#2a2210] border border-[#c89b3c] text-[#f0c020] rounded-xs">
                      Pending
                    </span>
                  </div>
                  <div className="text-[11px] text-[#a6a89e] truncate">
                    Discord ID: {entry.discord_id}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemoveAllowedUser(entry.discord_id)}
                  className="xp-btn text-[11px] px-2 py-1 shrink-0"
                  title="Remove from allowlist"
                >
                  <X className="w-3 h-3" />
                  <span>Revoke</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

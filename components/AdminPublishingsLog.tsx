"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Division, Edition, League, Season } from "@/types/database";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import {
  ArrowLeft,
  ArrowRightLeft,
  ExternalLink,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

export interface AdminLogBallot {
  id: string;
  title: string | null;
  status: string;
  ranking_type?: "team" | "player" | null;
  tier_variant?: string | null;
  published_at: string | null;
  user_id: string;
  season_id: string | null;
  division_id: string | null;
  edition_id: string | null;
  division_name_snapshot: string | null;
  edition_name_snapshot: string | null;
  profiles:
    | {
        id: string;
        username: string;
        discord_id: string | null;
        is_banned: boolean;
      }
    | {
        id: string;
        username: string;
        discord_id: string | null;
        is_banned: boolean;
      }[]
    | null;
  seasons?: { id: string; name: string; leagues?: League | League[] | null } | null;
  divisions?: { id: string; name: string } | null;
  editions?: { id: string; name: string } | null;
}

interface ConflictingBallotInfo {
  id: string;
  title: string | null;
  status: string;
  updated_at: string;
  published_at: string | null;
}

interface Props {
  initialBallots: AdminLogBallot[];
  seasons: (Season & { leagues?: League | null })[];
  divisions: Division[];
  editions: Edition[];
}

export function AdminPublishingsLog({
  initialBallots,
  seasons,
  divisions,
  editions,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [ballots, setBallots] = useState<AdminLogBallot[]>(initialBallots);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "team" | "player">(() => {
    const t = searchParams.get("type");
    return t === "team" || t === "player" ? t : "all";
  });
  const [seasonFilter, setSeasonFilter] = useState<string>(
    () => searchParams.get("season") ?? ""
  );
  const [divisionFilter, setDivisionFilter] = useState<string>(
    () => searchParams.get("division") ?? ""
  );
  const [editionFilter, setEditionFilter] = useState<string>(
    () => searchParams.get("edition") ?? ""
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get("q") ?? ""
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (typeFilter !== "all") params.set("type", typeFilter);
    else params.delete("type");

    if (seasonFilter) params.set("season", seasonFilter);
    else params.delete("season");

    if (divisionFilter) params.set("division", divisionFilter);
    else params.delete("division");

    if (editionFilter) params.set("edition", editionFilter);
    else params.delete("edition");

    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [
    pathname,
    searchParams,
    typeFilter,
    seasonFilter,
    divisionFilter,
    editionFilter,
    searchQuery,
  ]);

  // Move / Force-Overwrite Edition Modal State
  const [movingBallot, setMovingBallot] = useState<AdminLogBallot | null>(null);
  const [targetEditionId, setTargetEditionId] = useState<string>("");
  const [moveTitle, setMoveTitle] = useState<string>("");
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictBallot, setConflictBallot] =
    useState<ConflictingBallotInfo | null>(null);
  const [confirmOverwriteChecked, setConfirmOverwriteChecked] = useState(false);

  const visibleDivisions = useMemo(() => {
    if (!seasonFilter) return divisions;
    return divisions.filter((d) => d.season_id === seasonFilter);
  }, [divisions, seasonFilter]);

  const visibleEditions = useMemo(() => {
    const list = seasonFilter
      ? editions.filter((e) => e.season_id === seasonFilter)
      : editions;
    return [...list].sort((a, b) => a.sort_order - b.sort_order);
  }, [editions, seasonFilter]);

  const filteredBallots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ballots.filter((b) => {
      const rType = b.ranking_type ?? "team";
      if (typeFilter !== "all" && rType !== typeFilter) return false;
      if (seasonFilter && b.season_id !== seasonFilter) return false;
      if (divisionFilter === "__none__") {
        if (b.division_id !== null) return false;
      } else if (divisionFilter && b.division_id !== divisionFilter) {
        return false;
      }
      if (editionFilter && b.edition_id !== editionFilter) return false;
      if (q) {
        const author = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
        const username = (author?.username ?? "").toLowerCase();
        const discordId = (author?.discord_id ?? "").toLowerCase();
        const title = (b.title ?? "").toLowerCase();
        if (
          !username.includes(q) &&
          !discordId.includes(q) &&
          !title.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    ballots,
    typeFilter,
    seasonFilter,
    divisionFilter,
    editionFilter,
    searchQuery,
  ]);

  const hasFilters = Boolean(
    typeFilter !== "all" ||
      seasonFilter ||
      divisionFilter ||
      editionFilter ||
      searchQuery.trim()
  );

  function resetFilters() {
    setTypeFilter("all");
    setSeasonFilter("");
    setDivisionFilter("");
    setEditionFilter("");
    setSearchQuery("");
  }

  async function handleAdminDeleteBallot(ballot: AdminLogBallot) {
    if (
      !confirm(
        `Permanently delete "${ballot.title || "this ranking"}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("ballots")
      .delete()
      .eq("id", ballot.id);
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setBallots((prev) => prev.filter((item) => item.id !== ballot.id));
      setStatusMsg("Published ranking deleted.");
      router.refresh();
    }
    setBusy(false);
  }

  async function checkTargetEditionConflict(
    ballot: AdminLogBallot,
    nextEditionId: string
  ) {
    if (!nextEditionId) {
      setConflictBallot(null);
      return;
    }
    const rankingType = ballot.ranking_type ?? "team";
    setCheckingConflict(true);
    let query = supabase
      .from("ballots")
      .select("id, title, status, updated_at, published_at")
      .eq("user_id", ballot.user_id)
      .eq("edition_id", nextEditionId)
      .eq("ranking_type", rankingType)
      .neq("id", ballot.id);

    if (ballot.division_id) {
      query = query.eq("division_id", ballot.division_id);
    } else {
      query = query.is("division_id", null);
    }
    if (rankingType === "player" && ballot.tier_variant) {
      query = query.eq("tier_variant", ballot.tier_variant);
    }

    const { data } = await query.maybeSingle();
    setConflictBallot((data as ConflictingBallotInfo | null) ?? null);
    setCheckingConflict(false);
  }

  function buildMovedTitle(
    ballot: AdminLogBallot,
    nextEdition: Edition | undefined
  ) {
    if (!nextEdition) return ballot.title ?? "";
    const oldEd = ballot.edition_name_snapshot;
    if (ballot.title && oldEd && ballot.title.includes(oldEd)) {
      return ballot.title.replace(oldEd, nextEdition.name);
    }
    if (ballot.ranking_type === "player") {
      return `${
        ballot.division_name_snapshot || "All Divisions"
      } Player Tier List — ${nextEdition.name}`;
    }
    if (ballot.division_name_snapshot) {
      return `${ballot.division_name_snapshot} Team Power Rankings — ${nextEdition.name}`;
    }
    return ballot.title ?? nextEdition.name;
  }

  function getEligibleTargetEditions(ballot: AdminLogBallot) {
    const rankingType = ballot.ranking_type ?? "team";
    return editions
      .filter(
        (e) =>
          e.season_id === ballot.season_id &&
          e.id !== ballot.edition_id &&
          (rankingType === "player" || !e.is_players_only)
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async function openMoveEditionModal(ballot: AdminLogBallot) {
    const seasonEds = getEligibleTargetEditions(ballot);
    const firstTarget = seasonEds[0];
    setMovingBallot(ballot);
    setTargetEditionId(firstTarget?.id ?? "");
    setMoveTitle(buildMovedTitle(ballot, firstTarget));
    setConflictBallot(null);
    setConfirmOverwriteChecked(false);
    if (firstTarget) {
      await checkTargetEditionConflict(ballot, firstTarget.id);
    }
  }

  async function handleTargetEditionChange(nextEditionId: string) {
    setTargetEditionId(nextEditionId);
    setConfirmOverwriteChecked(false);
    if (!movingBallot) return;
    const nextEd = editions.find((e) => e.id === nextEditionId);
    setMoveTitle(buildMovedTitle(movingBallot, nextEd));
    await checkTargetEditionConflict(movingBallot, nextEditionId);
  }

  async function handleConfirmMoveEdition() {
    if (!movingBallot || !targetEditionId) return;
    const targetEd = editions.find((e) => e.id === targetEditionId);
    if (!targetEd) return;
    if (
      (movingBallot.ranking_type ?? "team") === "team" &&
      targetEd.is_players_only
    ) {
      setStatusMsg(
        `Cannot move a Team Power Ranking into Players-Only edition "${targetEd.name}".`
      );
      return;
    }

    if (conflictBallot) {
      if (!confirmOverwriteChecked) return;
      const author = Array.isArray(movingBallot.profiles)
        ? movingBallot.profiles[0]
        : movingBallot.profiles;
      const confirmedSecond = confirm(
        `FINAL WARNING: Permanently DELETE ${
          author?.username ?? "this user"
        }'s existing ${conflictBallot.status.toUpperCase()} ranking "${
          conflictBallot.title || targetEd.name
        }" in ${targetEd.name} and replace it with this ranking? This cannot be undone.`
      );
      if (!confirmedSecond) return;
    }

    setBusy(true);
    try {
      if (conflictBallot) {
        const { error: delErr } = await supabase
          .from("ballots")
          .delete()
          .eq("id", conflictBallot.id);
        if (delErr) {
          setStatusMsg(`Error removing conflicting ranking: ${delErr.message}`);
          setBusy(false);
          return;
        }
      }

      const nextTitle = moveTitle.trim() || movingBallot.title;
      const { error: updErr } = await supabase
        .from("ballots")
        .update({
          edition_id: targetEd.id,
          edition_name_snapshot: targetEd.name,
          title: nextTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", movingBallot.id);

      if (updErr) {
        setStatusMsg(`Error moving ranking: ${updErr.message}`);
      } else {
        setBallots((prev) =>
          prev
            .filter((b) => !conflictBallot || b.id !== conflictBallot.id)
            .map((b) =>
              b.id === movingBallot.id
                ? {
                    ...b,
                    edition_id: targetEd.id,
                    edition_name_snapshot: targetEd.name,
                    editions: { id: targetEd.id, name: targetEd.name },
                    title: nextTitle,
                  }
                : b
            )
        );
        setStatusMsg(
          conflictBallot
            ? `Moved ranking to "${targetEd.name}" and overwrote the conflicting ranking.`
            : `Moved ranking to "${targetEd.name}".`
        );
        setMovingBallot(null);
        setConflictBallot(null);
        setConfirmOverwriteChecked(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
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
            {filteredBallots.length}
          </span>{" "}
          of{" "}
          <span className="font-bold text-[#f0ede0]">{ballots.length}</span>{" "}
          published rankings
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
              Type
            </span>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | "team" | "player")
              }
              className="xp-inset px-2.5 py-1.5 text-xs block"
            >
              <option value="all">All Types</option>
              <option value="team">Team Power Rankings</option>
              <option value="player">Player Tier Lists</option>
            </select>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#f0c020]">
              Season
            </span>
            <select
              value={seasonFilter}
              onChange={(e) => {
                setSeasonFilter(e.target.value);
                setDivisionFilter("");
                setEditionFilter("");
              }}
              className="xp-inset px-2.5 py-1.5 text-xs block"
            >
              <option value="">All Seasons</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.leagues ? `${s.leagues.short_name}: ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#f0c020]">
              Division
            </span>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="xp-inset px-2.5 py-1.5 text-xs block"
            >
              <option value="">All Divisions</option>
              <option value="__none__">Divisionless (All Divisions)</option>
              {visibleDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#f0c020]">
              Edition
            </span>
            <select
              value={editionFilter}
              onChange={(e) => setEditionFilter(e.target.value)}
              className="xp-inset px-2.5 py-1.5 text-xs block"
            >
              <option value="">All Editions</option>
              {visibleEditions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-xs flex-1 min-w-[180px]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#f0c020]">
              Author / Title
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#a6a89e] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search author, Discord ID, or title..."
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

      {/* List */}
      <div className="xp-panel p-2.5 space-y-1.5">
        {filteredBallots.length === 0 ? (
          <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
            No published rankings match the current filters.
          </div>
        ) : (
          filteredBallots.map((b) => {
            const author = Array.isArray(b.profiles)
              ? b.profiles[0]
              : b.profiles;
            const seasonObj = b.seasons;
            const leagueObj = seasonObj?.leagues
              ? Array.isArray(seasonObj.leagues)
                ? seasonObj.leagues[0]
                : seasonObj.leagues
              : null;
            const seasonLabel = seasonObj
              ? `${leagueObj ? `${leagueObj.short_name}: ` : ""}${seasonObj.name}`
              : null;
            const divisionLabel =
              b.divisions?.name ??
              b.division_name_snapshot ??
              (b.ranking_type === "player" ? "All Divisions" : null);
            const editionLabel =
              b.editions?.name ?? b.edition_name_snapshot ?? null;

            return (
              <div
                key={b.id}
                className="xp-inset px-3 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
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
                    <Link
                      href={`/ballot/${b.id}`}
                      className="font-bold text-[#f0ede0] hover:text-[#f0c020] truncate"
                    >
                      {b.title || "Untitled Ranking"}
                    </Link>
                  </div>

                  <div className="text-[11px] text-[#a6a89e] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>
                      By{" "}
                      <span className="text-[#dcd9cc]">
                        {author?.username ?? "Unknown"}
                      </span>
                      {author?.is_banned ? (
                        <span className="text-[#ff857a] font-bold">
                          {" "}
                          (BANNED)
                        </span>
                      ) : null}
                    </span>
                    {seasonLabel && <span>• {seasonLabel}</span>}
                    {divisionLabel && <span>• {divisionLabel}</span>}
                    {editionLabel && <span>• {editionLabel}</span>}
                    {b.published_at && (
                      <span>
                        • {new Date(b.published_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {b.season_id && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void openMoveEditionModal(b)}
                      className="xp-btn text-[11px] px-2 py-1"
                      title="Move / Force-Overwrite to Different Edition"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span className="hidden md:inline">Move</span>
                    </button>
                  )}
                  <Link
                    href={`/ballot/${b.id}`}
                    className="xp-btn text-[11px] px-2 py-1"
                    title="View Ranking"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden md:inline">View</span>
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAdminDeleteBallot(b)}
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

      {/* Move / Force-Overwrite Edition Modal */}
      {movingBallot && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="xp-panel max-w-md w-full p-4 space-y-3 border-2 border-[#c89b3c]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-xs uppercase text-[#f0c020]">
                Move Ranking to Different Edition
              </h3>
              <button
                type="button"
                onClick={() => setMovingBallot(null)}
                className="text-[#a6a89e] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="xp-inset p-2.5 text-xs space-y-1">
              <div className="font-bold text-[#f0ede0]">
                {movingBallot.title || "Untitled Ranking"}
              </div>
              <div className="text-[11px] text-[#a6a89e]">
                Current Edition:{" "}
                <span className="text-[#f0ede0]">
                  {movingBallot.edition_name_snapshot || "Unknown"}
                </span>
              </div>
            </div>

            {getEligibleTargetEditions(movingBallot).length === 0 ? (
              <div className="xp-inset p-3 text-xs text-[#ff857a]">
                No other eligible editions exist in this season.
              </div>
            ) : (
              <>
                <label className="block space-y-1 text-xs">
                  <span className="text-[11px] font-bold uppercase text-[#f0c020]">
                    Target Edition
                  </span>
                  <select
                    value={targetEditionId}
                    onChange={(e) =>
                      void handleTargetEditionChange(e.target.value)
                    }
                    className="w-full xp-inset px-2.5 py-1.5 text-xs"
                  >
                    {getEligibleTargetEditions(movingBallot).map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name}
                        {ed.is_players_only ? " (Players-Only)" : ""}
                        {!ed.is_open ? " [Locked]" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="text-[11px] font-bold uppercase text-[#f0c020]">
                    Updated Title
                  </span>
                  <input
                    type="text"
                    value={moveTitle}
                    onChange={(e) => setMoveTitle(e.target.value)}
                    className="w-full xp-inset px-2.5 py-1.5 text-xs"
                  />
                </label>

                {checkingConflict && (
                  <div className="text-[11px] text-[#a6a89e]">
                    Checking for conflicting ranking in target edition...
                  </div>
                )}

                {!checkingConflict && conflictBallot && (
                  <div className="xp-inset p-2.5 border border-[#a94442] bg-[#2a1212]/60 space-y-2 text-xs">
                    <div className="font-bold text-[#ff857a]">
                      Conflict Detected in Target Edition
                    </div>
                    <p className="text-[11px] text-[#f0ede0]">
                      This user already has a{" "}
                      <span className="font-bold uppercase">
                        {conflictBallot.status}
                      </span>{" "}
                      ranking (&ldquo;{conflictBallot.title || "Untitled"}&rdquo;)
                      in the target edition. Moving this ranking will{" "}
                      <span className="font-bold text-[#ff857a]">
                        permanently delete
                      </span>{" "}
                      that existing ranking.
                    </p>
                    <label className="flex items-start gap-2 text-[11px] text-[#f0ede0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmOverwriteChecked}
                        onChange={(e) =>
                          setConfirmOverwriteChecked(e.target.checked)
                        }
                        className="mt-0.5"
                      />
                      <span>
                        I understand and want to overwrite the existing ranking.
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMovingBallot(null)}
                className="xp-btn text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  checkingConflict ||
                  !targetEditionId ||
                  (Boolean(conflictBallot) && !confirmOverwriteChecked)
                }
                onClick={() => void handleConfirmMoveEdition()}
                className={`xp-btn text-xs ${
                  conflictBallot ? "xp-btn-danger" : "xp-btn-primary"
                }`}
              >
                {conflictBallot ? "Force Overwrite & Move" : "Move Ranking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

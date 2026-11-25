"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Division, Edition, League, Season } from "@/types/database";
import { LocalTimestamp } from "@/components/LocalTimestamp";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import {
  buildMovedRankingTitle,
  deleteAdminRanking,
  executeMoveRankingEdition,
  findTargetEditionConflict,
  getEligibleTargetEditions as computeEligibleTargetEditions,
  type ConflictingRankingInfo,
} from "@/utils/adminRankingActions";
import {
  ArrowLeft,
  ArrowRightLeft,
  ExternalLink,
  History,
  RotateCcw,
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

type ConflictingBallotInfo = ConflictingRankingInfo;

interface RankingRevisionSummary {
  id: string;
  ranking_id: string;
  operation: "UPDATE" | "DELETE";
  title: string | null;
  ranking_type: string | null;
  status: string | null;
  created_at: string;
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
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisions, setRevisions] = useState<RankingRevisionSummary[]>([]);

  async function loadRevisions() {
    setRevisionsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ranking_revisions")
        .select(
          "id, ranking_id, operation, title, ranking_type, status, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        setStatusMsg(`Revisions error: ${error.message}`);
      } else {
        setRevisions((data ?? []) as RankingRevisionSummary[]);
      }
    } finally {
      setRevisionsLoading(false);
    }
  }

  async function handleRestoreRevision(rev: RankingRevisionSummary) {
    if (
      !window.confirm(
        `Restore snapshot of "${rev.title ?? rev.ranking_id}" from ${new Date(
          rev.created_at
        ).toLocaleString()}?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("restore_ranking_revision", {
        target_revision_id: rev.id,
      });
      if (error) {
        setStatusMsg(`Restore failed: ${error.message}`);
      } else {
        setStatusMsg(
          `Restored "${rev.title ?? rev.ranking_id}" from revision snapshot.`
        );
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

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
    const res = await deleteAdminRanking(supabase, ballot);
    setStatusMsg(res.statusMessage);
    if (res.ok) {
      setBallots((prev) => prev.filter((item) => item.id !== ballot.id));
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
    setCheckingConflict(true);
    const conflict = await findTargetEditionConflict(
      supabase,
      ballot,
      nextEditionId
    );
    setConflictBallot(conflict);
    setCheckingConflict(false);
  }

  function getEligibleTargetEditions(ballot: AdminLogBallot) {
    return computeEligibleTargetEditions(ballot, editions);
  }

  async function openMoveEditionModal(ballot: AdminLogBallot) {
    const seasonEds = getEligibleTargetEditions(ballot);
    const firstTarget = seasonEds[0];
    setMovingBallot(ballot);
    setTargetEditionId(firstTarget?.id ?? "");
    setMoveTitle(buildMovedRankingTitle(ballot, firstTarget));
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
    setMoveTitle(buildMovedRankingTitle(movingBallot, nextEd));
    await checkTargetEditionConflict(movingBallot, nextEditionId);
  }

  async function handleConfirmMoveEdition() {
    if (!movingBallot || !targetEditionId) return;
    const targetEd = editions.find((e) => e.id === targetEditionId);
    if (!targetEd) return;

    setBusy(true);
    try {
      const res = await executeMoveRankingEdition(supabase, {
        movingRanking: movingBallot,
        targetEdition: targetEd,
        moveTitle,
        conflictRanking: conflictBallot,
        confirmOverwrite: confirmOverwriteChecked,
      });
      if (res.statusMessage) setStatusMsg(res.statusMessage);
      if (res.ok && res.nextTitle) {
        const nextTitle = res.nextTitle;
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
        <div className="flex items-center gap-2">
          <Link href="/admin" className="xp-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Console</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              const next = !revisionsOpen;
              setRevisionsOpen(next);
              if (next) void loadRevisions();
            }}
            className={`xp-btn text-xs ${revisionsOpen ? "xp-btn-gold" : ""}`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Revision History &amp; Restore</span>
          </button>
        </div>
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

      {revisionsOpen && (
        <div className="xp-panel p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Recent Ranking Revisions &amp; Deleted Snapshots
            </h3>
            <button
              type="button"
              onClick={() => void loadRevisions()}
              disabled={revisionsLoading}
              className="xp-btn text-[11px] px-2 py-0.5"
            >
              {revisionsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {revisions.length === 0 ? (
            <p className="text-xs text-[#a6a89e] italic">
              {revisionsLoading
                ? "Loading revisions..."
                : "No revision snapshots recorded yet."}
            </p>
          ) : (
            <div className="divide-y divide-white/10 max-h-64 overflow-y-auto text-xs">
              {revisions.map((rev) => (
                <div
                  key={rev.id}
                  className="py-1.5 px-2 flex flex-wrap items-center justify-between gap-2 hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        rev.operation === "DELETE"
                          ? "bg-[#ff857a]/15 text-[#ff857a] border border-[#ff857a]/40"
                          : "bg-[#6bb8ff]/15 text-[#6bb8ff] border border-[#6bb8ff]/40"
                      }`}
                    >
                      {rev.operation}
                    </span>
                    <span className="font-bold text-[#f7f5eb] truncate">
                      {rev.title || rev.ranking_id}
                    </span>
                    <span className="text-[11px] text-[#a6a89e]">
                      ({rev.ranking_type ?? "team"} • {rev.status ?? "draft"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-[#a6a89e] tabular-nums">
                      <LocalTimestamp iso={rev.created_at} />
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRestoreRevision(rev)}
                      className="xp-btn text-[11px] px-2 py-0.5 inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                      href={
                        b.ranking_type === "player"
                          ? `/tierlist/${b.id}`
                          : `/rankings/${b.id}`
                      }
                      prefetch={false}
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
                        • <LocalTimestamp iso={b.published_at} />
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

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  GripVertical,
  Lock,
  Save,
  Send,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type {
  Division,
  DivisionTheme,
  Edition,
  Season,
  Team,
} from "@/types/database";
import { RetroWindow } from "@/components/RetroWindow";
import { RetroConfirmModal } from "@/components/RetroConfirmModal";
import { useUnsavedChangesGuard } from "@/utils/useUnsavedChangesGuard";
import { RankChangeBadge } from "@/components/RankChangeBadge";
import { CAPTAIN_ICON, getRoleMeta, normalizeRoster } from "@/utils/roles";
import { getRankColor } from "@/utils/rankColors";
import { resolveDivisionTheme } from "@/utils/themes";

interface RankedTeamItem {
  team: Team;
  commentary: string;
  previousRank: number | null;
}

interface BallotEditorProps {
  userId: string;
  initialAuthorName: string;
  discordDefaultName: string;
  seasons: Season[];
  divisions: Division[];
  themes?: DivisionTheme[];
  editions: Edition[];
  teams: Team[];
  initialSeasonSlug?: string;
  initialDivisionSlug?: string;
  initialEditionSlug?: string;
  onUnsavedChange?: (dirty: boolean) => void;
}

function SortableTeamRow({
  item,
  index,
  total,
  disabled,
  onMove,
  onCommentaryChange,
}: {
  item: RankedTeamItem;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onCommentaryChange: (teamId: string, value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.team.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };

  const currentRank = index + 1;
  const rankChange =
    item.previousRank !== null ? item.previousRank - currentRank : null;
  const rankColor = getRankColor(index, total);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: rankColor.cardBg,
        borderColor: rankColor.borderColor,
      }}
      className={`rounded-lg border p-3 sm:p-3.5 transition-shadow ${
        isDragging ? "shadow-2xl ring-2 ring-[#f0c020]" : "shadow-sm"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Mobile-only compact header matching mockup */}
        <div className="flex items-center justify-between gap-2.5 md:hidden">
          <div className="flex items-center gap-2 shrink-0">
            {!disabled && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="touch-none select-none cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded-md text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                title="Drag to reorder"
              >
                <GripVertical className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col items-center gap-1">
              <span
                style={{
                  backgroundColor: rankColor.badgeBg,
                  borderColor: rankColor.borderColor,
                  color: rankColor.badgeText,
                }}
                className="w-10 h-10 rounded-xl border font-black text-xl flex items-center justify-center shadow-sm shrink-0"
              >
                {currentRank}
              </span>
              {!disabled && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded-md bg-black/25 hover:bg-black/45 border border-white/15 text-[#f0ede0] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={index === total - 1}
                    className="p-1 rounded-md bg-black/25 hover:bg-black/45 border border-white/15 text-[#f0ede0] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            {item.team.logo_url ? (
              <img
                src={item.team.logo_url}
                alt={item.team.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[10px] font-bold text-white/40">LOGO</span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-1 min-w-0 flex-1 text-center">
            <div className="font-black text-xl text-[#f7f5eb] tracking-tight leading-tight truncate max-w-full">
              {item.team.name}
            </div>
            <RankChangeBadge
              previousRank={item.previousRank}
              rankChange={rankChange}
            />
          </div>
        </div>

        {/* Desktop-only Grabber + Rank + Change + Move */}
        <div className="hidden md:flex items-center justify-start gap-2.5 md:w-[170px] lg:w-[185px] shrink-0 md:border-r md:border-white/10 md:pr-3">
          <div className="flex items-center gap-2.5">
            {!disabled && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="touch-none select-none cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded-md text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                title="Drag to reorder"
              >
                <GripVertical className="w-6 h-6" />
              </button>
            )}
            <span
              style={{
                backgroundColor: rankColor.badgeBg,
                borderColor: rankColor.borderColor,
                color: rankColor.badgeText,
              }}
              className="w-12 h-12 rounded-xl border font-black text-2xl flex items-center justify-center shadow-sm shrink-0"
            >
              {currentRank}
            </span>
          </div>

          <div className="flex md:flex-col items-center gap-1.5">
            <RankChangeBadge
              previousRank={item.previousRank}
              rankChange={rankChange}
            />

            {!disabled && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  className="p-1 rounded-md bg-black/25 hover:bg-black/45 border border-white/15 text-[#f0ede0] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === total - 1}
                  className="p-1 rounded-md bg-black/25 hover:bg-black/45 border border-white/15 text-[#f0ede0] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop-only Team Logo + Prominent Team Name */}
        <div className="hidden md:flex items-center gap-3 md:flex-[1.1] md:min-w-[240px] min-w-0">
          <div className="w-20 h-20 shrink-0 flex items-center justify-center">
            {item.team.logo_url ? (
              <img
                src={item.team.logo_url}
                alt={item.team.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[10px] font-bold text-white/40">LOGO</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-xl sm:text-2xl text-[#f7f5eb] tracking-tight leading-tight">
              {item.team.name}
            </div>
          </div>
        </div>

        {/* 5-Player Roster (beside Team Name) */}
        <div className="md:w-[180px] lg:w-[200px] shrink-0 min-w-0">
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:block gap-x-3 gap-y-1 md:space-y-1 text-xs text-[#e5e3d8]">
            {normalizeRoster(item.team.roster, item.team.captain).map(
              (slot, pIdx) => {
                const roleMeta = getRoleMeta(slot.role);
                return (
                  <li
                    key={pIdx}
                    className="flex items-center gap-1.5 truncate font-mono"
                  >
                    <img
                      src={roleMeta.icon}
                      alt={roleMeta.label}
                      title={roleMeta.label}
                      className="w-4 h-4 object-contain shrink-0"
                    />
                    <span className="truncate">
                      {slot.name.split("#")[0].trim() || slot.name}
                    </span>
                    {slot.is_captain && (
                      <img
                        src={CAPTAIN_ICON}
                        alt="Captain"
                        title="Captain"
                        className="w-3.5 h-3.5 object-contain shrink-0"
                      />
                    )}
                  </li>
                );
              }
            )}
          </ul>
        </div>

        {/* Commentary */}
        <div className="md:flex-[1.6] min-w-0">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-white/70">
              Commentary
            </label>
            <span className="text-[10px] text-white/40 font-mono">
              {item.commentary.length}/400
            </span>
          </div>
          <textarea
            value={item.commentary}
            maxLength={400}
            disabled={disabled}
            onChange={(e) =>
              onCommentaryChange(item.team.id, e.target.value.slice(0, 400))
            }
            rows={5}
            placeholder={`Thoughts on ${item.team.name}...`}
            className="w-full rounded-md bg-black/30 border border-white/15 p-2.5 text-xs text-[#f0ede0] placeholder:text-white/35 resize-y focus:outline-none focus:border-[#f0c020] disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}

export function BallotEditor({
  userId,
  initialAuthorName,
  discordDefaultName,
  seasons,
  divisions,
  themes,
  editions,
  teams,
  initialSeasonSlug,
  initialDivisionSlug,
  initialEditionSlug,
  onUnsavedChange,
}: BallotEditorProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const activeSeasons = seasons.filter((s) => s.is_active);
  const defaultSeason = initialSeasonSlug
    ? seasons.find((s) => s.slug === initialSeasonSlug)
    : activeSeasons.length === 1
    ? activeSeasons[0]
    : undefined;

  const [seasonId, setSeasonId] = useState<string>(defaultSeason?.id ?? "");

  const seasonDivisions = useMemo(
    () => divisions.filter((d) => d.season_id === seasonId),
    [divisions, seasonId]
  );
  const seasonEditions = useMemo(
    () =>
      editions
        .filter((e) => e.season_id === seasonId && !e.is_players_only)
        .sort((a, b) => a.sort_order - b.sort_order),
    [editions, seasonId]
  );

  const currentOpenEditionId = useMemo(() => {
    const reversed = [...seasonEditions].reverse();
    return reversed.find((ed) => ed.is_open && !ed.is_archived)?.id ?? null;
  }, [seasonEditions]);

  const [divisionId, setDivisionId] = useState<string>(() => {
    if (!initialDivisionSlug) return "";
    const match = divisions.find(
      (d) => d.season_id === defaultSeason?.id && d.slug === initialDivisionSlug
    );
    return match?.id ?? "";
  });

  const [editionId, setEditionId] = useState<string>(() => {
    if (!initialEditionSlug) return "";
    const seasonEds = editions.filter(
      (e) => e.season_id === defaultSeason?.id && !e.is_players_only
    );
    const match = seasonEds.find((e) => e.slug === initialEditionSlug);
    return match?.id ?? "";
  });

  const currentDivision = seasonDivisions.find((d) => d.id === divisionId);
  const currentEdition = seasonEditions.find((e) => e.id === editionId);
  const currentSeason = seasons.find((s) => s.id === seasonId);
  const pathname = usePathname();
  const didMountUrlSyncRef = useRef(false);

  useEffect(() => {
    if (!didMountUrlSyncRef.current) {
      didMountUrlSyncRef.current = true;
      return;
    }
    if (!currentSeason) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("type");
    params.delete("variant");
    params.set("season", currentSeason.slug);
    if (currentDivision) {
      params.set("division", currentDivision.slug);
    } else {
      params.delete("division");
    }
    if (currentEdition) {
      params.set("edition", currentEdition.slug);
    } else {
      params.delete("edition");
    }
    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [currentSeason, currentDivision, currentEdition, pathname]);

  const divisionTeams = useMemo(
    () =>
      teams
        .filter((t) => t.division_id === divisionId)
        .sort((a, b) => a.default_order - b.default_order),
    [teams, divisionId]
  );

  const [rankedItems, setRankedItems] = useState<RankedTeamItem[]>([]);
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [savedAuthorName, setSavedAuthorName] = useState(initialAuthorName);
  const [authorNotes, setAuthorNotes] = useState("");
  const [showCustomAuthor, setShowCustomAuthor] = useState(false);
  const [showGeneralNotes, setShowGeneralNotes] = useState(false);
  const [existingBallotId, setExistingBallotId] = useState<string | null>(null);
  const [ballotStatus, setBallotStatus] = useState<"draft" | "published" | null>(
    null
  );
  const [loadingBallot, setLoadingBallot] = useState(false);
  const lastLoadedKeyRef = useRef<string>("");
  const popoverContainerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!showCustomAuthor && !showGeneralNotes) return;
    function handleOutside(e: MouseEvent) {
      if (
        popoverContainerRef.current &&
        !popoverContainerRef.current.contains(e.target as Node)
      ) {
        setShowCustomAuthor(false);
        setShowGeneralNotes(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowCustomAuthor(false);
        setShowGeneralNotes(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showCustomAuthor, showGeneralNotes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const active = seasons.filter((s) => s.is_active);
    if (initialSeasonSlug) {
      const matched = seasons.find((s) => s.slug === initialSeasonSlug);
      if (matched) {
        setSeasonId(matched.id);
      }
    } else {
      setSeasonId(active.length === 1 ? active[0].id : "");
    }
  }, [initialSeasonSlug, seasons]);

  useEffect(() => {
    if (divisionId !== "" && !seasonDivisions.some((d) => d.id === divisionId)) {
      setDivisionId("");
    }

    if (
      !divisionId ||
      seasonEditions.length === 0 ||
      !seasonEditions.some((e) => e.id === editionId)
    ) {
      if (!divisionId && !initialEditionSlug) {
        if (editionId !== "") setEditionId("");
      } else if (seasonEditions.length === 0) {
        if (editionId !== "") setEditionId("");
      } else if (divisionId && !seasonEditions.some((e) => e.id === editionId)) {
        const reversedEds = [...seasonEditions].reverse();
        const latestOpen = reversedEds.find((e) => e.is_open && !e.is_archived);
        const latestActive = reversedEds.find((e) => !e.is_archived);
        setEditionId((latestOpen ?? latestActive ?? reversedEds[0]).id);
      }
    }
  }, [
    seasonId,
    seasonDivisions,
    seasonEditions,
    divisionId,
    editionId,
    initialEditionSlug,
  ]);

  useEffect(() => {
    if (!seasonId || !divisionId || !editionId) {
      lastLoadedKeyRef.current = "";
      setRankedItems([]);
      setExistingBallotId(null);
      setBallotStatus(null);
      setLoadingBallot(false);
      return;
    }

    const selectionKey = `${seasonId}:${divisionId}:${editionId}`;
    if (lastLoadedKeyRef.current === selectionKey) {
      return;
    }

    let cancelled = false;

    async function loadBallotState() {
      setLoadingBallot(true);
      setBallotStatus(null);
      setExistingBallotId(null);
      setMessage(null);

      try {
        const currentEd = seasonEditions.find((e) => e.id === editionId);
        const earlierEds = currentEd
          ? [...seasonEditions]
              .filter((e) => e.sort_order < currentEd.sort_order)
              .sort((a, b) => b.sort_order - a.sort_order)
          : [];

        const prevRankMap = new Map<string, number>();
        if (earlierEds.length > 0) {
          const { data: earlierBallots } = await supabase
            .from("ballots")
            .select("id, edition_id")
            .eq("user_id", userId)
            .eq("division_id", divisionId)
            .in(
              "edition_id",
              earlierEds.map((e) => e.id)
            )
            .eq("ranking_type", "team");

          const prevBallot = earlierEds
            .map((ed) =>
              (earlierBallots ?? []).find((b) => b.edition_id === ed.id)
            )
            .find(Boolean);

          if (prevBallot) {
            const { data: prevEntries } = await supabase
              .from("ballot_entries")
              .select("team_id, rank")
              .eq("ballot_id", prevBallot.id);

            (prevEntries ?? []).forEach((entry) => {
              if (entry.team_id) {
                prevRankMap.set(entry.team_id, entry.rank);
              }
            });
          }
        }

        const { data: currentBallot } = await supabase
          .from("ballots")
          .select("*")
          .eq("user_id", userId)
          .eq("division_id", divisionId)
          .eq("edition_id", editionId)
          .eq("ranking_type", "team")
          .maybeSingle();

        if (cancelled) return;

        if (currentBallot) {
          setExistingBallotId(currentBallot.id);
          setBallotStatus(currentBallot.status);
          setAuthorNotes(currentBallot.author_notes ?? "");
          setShowGeneralNotes(false);

          const { data: entries } = await supabase
            .from("ballot_entries")
            .select("*")
            .eq("ballot_id", currentBallot.id)
            .order("rank", { ascending: true });

          if (cancelled) return;

          const entryByTeamId = new Map(
            (entries ?? [])
              .filter((e) => e.team_id)
              .map((e) => [e.team_id as string, e])
          );

          const orderedTeams = [...divisionTeams].sort((a, b) => {
            const rankA = entryByTeamId.get(a.id)?.rank ?? 999 + a.default_order;
            const rankB = entryByTeamId.get(b.id)?.rank ?? 999 + b.default_order;
            return rankA - rankB;
          });

          const loadedItems = orderedTeams.map((team) => ({
            team,
            commentary: entryByTeamId.get(team.id)?.commentary ?? "",
            previousRank: prevRankMap.get(team.id) ?? null,
          }));
          loadedSnapshotRef.current = JSON.stringify({
            order: loadedItems.map((i) => i.team.id),
            comments: loadedItems.map((i) => i.commentary),
            authorNotes: currentBallot.author_notes ?? "",
          });
          setRankedItems(loadedItems);
        } else {
          setExistingBallotId(null);
          setBallotStatus(null);
          setAuthorNotes("");
          setShowGeneralNotes(false);
          const editionUnavailable =
            Boolean(currentEd?.is_archived) || isSeasonInactive;
          if (editionUnavailable) {
            loadedSnapshotRef.current = "";
            setRankedItems([]);
          } else {
            const initialTeams =
              prevRankMap.size > 0
                ? [...divisionTeams].sort((a, b) => {
                    const ra = prevRankMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
                    const rb = prevRankMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
                    return ra - rb;
                  })
                : divisionTeams;
            const freshItems = initialTeams.map((team) => ({
              team,
              commentary: "",
              previousRank: prevRankMap.get(team.id) ?? null,
            }));
            loadedSnapshotRef.current = JSON.stringify({
              order: freshItems.map((i) => i.team.id),
              comments: freshItems.map((i) => i.commentary),
              authorNotes: "",
            });
            setRankedItems(freshItems);
          }
        }

        lastLoadedKeyRef.current = selectionKey;
      } finally {
        if (!cancelled) {
          setLoadingBallot(false);
        }
      }
    }

    loadBallotState();

    return () => {
      cancelled = true;
    };
  }, [seasonId, divisionId, editionId, userId, divisionTeams, seasonEditions, supabase]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setRankedItems((items) => {
      const oldIndex = items.findIndex((i) => i.team.id === active.id);
      const newIndex = items.findIndex((i) => i.team.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rankedItems.length) return;
    setRankedItems((items) => arrayMove(items, index, target));
  }

  function handleCommentaryChange(teamId: string, value: string) {
    setRankedItems((items) =>
      items.map((item) =>
        item.team.id === teamId ? { ...item, commentary: value } : item
      )
    );
  }

  async function saveBallot(targetStatus: "draft" | "published") {
    if (!seasonId || !divisionId || !editionId) return;
    if (isEditionArchived) {
      setMessage({
        type: "error",
        text: "This edition is archived and can no longer be edited.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const now = new Date().toISOString();
      const resolvedAuthor = authorName.trim() || discordDefaultName;
      if (resolvedAuthor !== savedAuthorName) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ username: resolvedAuthor, updated_at: now })
          .eq("id", userId);
        if (profileErr) {
          throw new Error(profileErr.message);
        }
        setAuthorName(resolvedAuthor);
        setSavedAuthorName(resolvedAuthor);
      }

      const defaultTitle = `${currentDivision?.name ?? "Division"} — ${
        currentEdition?.name ?? "Edition"
      }`;

      const currentLeague = Array.isArray(currentSeason?.leagues)
        ? currentSeason?.leagues[0]
        : currentSeason?.leagues;

      const payload = {
        user_id: userId,
        season_id: seasonId,
        division_id: divisionId,
        edition_id: editionId,
        ranking_type: "team" as const,
        title: defaultTitle,
        author_notes: authorNotes.trim(),
        status: targetStatus,
        published_at: targetStatus === "published" ? now : null,
        league_name_snapshot: currentLeague?.name ?? null,
        season_name_snapshot: currentSeason?.name ?? null,
        division_name_snapshot: currentDivision?.name ?? null,
        division_logo_snapshot: currentDivision?.logo_url ?? null,
        division_theme_snapshot: currentDivision?.theme_key ?? null,
        edition_name_snapshot: currentEdition?.name ?? null,
        updated_at: now,
      };

      let targetBallotId = existingBallotId;
      if (!targetBallotId) {
        const { data: existingRow } = await supabase
          .from("ballots")
          .select("id")
          .eq("user_id", userId)
          .eq("season_id", seasonId)
          .eq("division_id", divisionId)
          .eq("edition_id", editionId)
          .eq("ranking_type", "team")
          .maybeSingle();
        if (existingRow?.id) {
          targetBallotId = existingRow.id;
        }
      }

      const ballotQuery = targetBallotId
        ? supabase
            .from("ballots")
            .update(payload)
            .eq("id", targetBallotId)
            .select("id, status")
            .single()
        : supabase
            .from("ballots")
            .insert(payload)
            .select("id, status")
            .single();

      const { data: savedBallot, error: ballotErr } = await ballotQuery;

      if (ballotErr || !savedBallot) {
        throw new Error(ballotErr?.message ?? "Failed to save ranking.");
      }

      const { error: delErr } = await supabase
        .from("ballot_entries")
        .delete()
        .eq("ballot_id", savedBallot.id);

      if (delErr) {
        throw new Error(delErr.message);
      }

      const entriesToInsert = rankedItems.map((item, idx) => {
        const rank = idx + 1;
        const rankChange =
          item.previousRank !== null ? item.previousRank - rank : null;
        return {
          ballot_id: savedBallot.id,
          team_id: item.team.id,
          rank,
          previous_rank: item.previousRank,
          rank_change: rankChange,
          commentary: item.commentary,
          team_name_snapshot: item.team.name,
          team_logo_snapshot: item.team.logo_url,
          roster_snapshot: normalizeRoster(item.team.roster, item.team.captain),
        };
      });

      const { error: insErr } = await supabase
        .from("ballot_entries")
        .insert(entriesToInsert);

      if (insErr) {
        throw new Error(insErr.message);
      }

      setExistingBallotId(savedBallot.id);
      setBallotStatus(savedBallot.status as "draft" | "published");
      loadedSnapshotRef.current = JSON.stringify({
        order: rankedItems.map((i) => i.team.id),
        comments: rankedItems.map((i) => i.commentary),
        authorNotes,
      });
      if (targetStatus === "published") {
        fetch("/api/notify-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ballotId: savedBallot.id }),
        }).catch(() => {});
      }
      setMessage({
        type: "success",
        text:
          targetStatus === "published"
            ? "Ranking published!"
            : `Draft saved at ${new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}.`,
      });
      router.refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving ranking.",
      });
    } finally {
      setSaving(false);
    }
  }

  const isSeasonInactive = currentSeason ? !currentSeason.is_active : false;
  const isEditionArchived = Boolean(currentEdition?.is_archived);
  const isEditionLocked = currentEdition ? !currentEdition.is_open : false;
  const isEditionPlayersOnly = Boolean(currentEdition?.is_players_only);
  const isEditDisabled =
    isSeasonInactive ||
    isEditionArchived ||
    isEditionPlayersOnly ||
    (isEditionLocked && ballotStatus === "published");
  const isPublishDisabled =
    isSeasonInactive ||
    isEditionArchived ||
    isEditionLocked ||
    isEditionPlayersOnly;

  const loadedSnapshotRef = useRef<string>("");
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        order: rankedItems.map((i) => i.team.id),
        comments: rankedItems.map((i) => i.commentary),
        authorNotes,
      }),
    [rankedItems, authorNotes]
  );
  const hasUnsavedChanges = Boolean(
    !isEditDisabled &&
      seasonId &&
      divisionId &&
      editionId &&
      rankedItems.length > 0 &&
      loadedSnapshotRef.current &&
      currentSnapshot !== loadedSnapshotRef.current
  );

  useUnsavedChangesGuard(hasUnsavedChanges);

  useEffect(() => {
    onUnsavedChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChange]);

  function confirmSwitchScope(): boolean {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      "Changing Season, Division, or Edition will clear unsaved changes. Continue?"
    );
  }
  const windowTheme =
    currentDivision?.theme_key === "dragon"
      ? "dragon"
      : currentDivision
      ? "baron"
      : "scdl";
  const activeTheme = resolveDivisionTheme(currentDivision?.theme_key, themes);

  return (
    <div className="space-y-4">
      <RetroWindow
        title="Team Power Rankings Editor"
        theme={windowTheme}
        customTheme={currentDivision ? activeTheme : undefined}
        iconSrc={
          currentDivision
            ? currentDivision.logo_url ?? activeTheme.default_logo_url ?? undefined
            : undefined
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 xp-panel p-3">
          <div>
            <label
              className={`block text-[11px] font-bold mb-1 ${
                !seasonId ? "text-[#f0c020]" : "text-[#c7c5b8]"
              }`}
            >
              Season
            </label>
            <div className={!seasonId ? "select-attention" : undefined}>
              <select
                value={seasonId}
                onChange={(e) => {
                  const newId = e.target.value;
                  if (newId === seasonId) return;
                  if (!confirmSwitchScope()) return;
                  setSeasonId(newId);
                  const nextSeason = seasons.find((s) => s.id === newId);
                  if (nextSeason?.slug) {
                    router.replace(
                      `/rank?season=${encodeURIComponent(nextSeason.slug)}`
                    );
                  } else {
                    router.replace("/rank");
                  }
                }}
                className="w-full xp-inset px-2 py-1.5 text-xs font-bold"
              >
                <option value="">Select a season...</option>
                {seasons.map((s) => {
                  const league = Array.isArray(s.leagues)
                    ? s.leagues[0]
                    : s.leagues;
                  const prefix =
                    league?.short_name ||
                    (league?.slug === "scdl" ? "SCDL" : league?.name);
                  return (
                    <option key={s.id} value={s.id}>
                      {prefix ? `${prefix}: ` : ""}
                      {s.name} {!s.is_active ? "(Inactive)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] font-bold mb-1 ${
                seasonId && !divisionId ? "text-[#f0c020]" : "text-[#c7c5b8]"
              }`}
            >
              Division
            </label>
            <div
              className={
                seasonId && !divisionId ? "select-attention" : undefined
              }
            >
              <select
                value={divisionId}
                disabled={!seasonId}
                onChange={(e) => {
                  const nextDivId = e.target.value;
                  if (nextDivId === divisionId) return;
                  if (!confirmSwitchScope()) return;
                  setDivisionId(nextDivId);
                  if (nextDivId && !editionId && seasonEditions.length > 0) {
                    const reversedEds = [...seasonEditions].reverse();
                    const latestOpen = reversedEds.find(
                      (ed) => ed.is_open && !ed.is_archived
                    );
                    const latestActive = reversedEds.find(
                      (ed) => !ed.is_archived
                    );
                    setEditionId(
                      (latestOpen ?? latestActive ?? reversedEds[0]).id
                    );
                  }
                }}
                className="w-full xp-inset px-2 py-1.5 text-xs font-bold disabled:opacity-50"
              >
                <option value="">Select a division...</option>
                {seasonDivisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] font-bold mb-1 ${
                seasonId && divisionId && !editionId
                  ? "text-[#f0c020]"
                  : "text-[#c7c5b8]"
              }`}
            >
              Edition
            </label>
            <div
              className={
                seasonId && divisionId && !editionId
                  ? "select-attention"
                  : undefined
              }
            >
              <select
                value={editionId}
                disabled={!seasonId}
                onChange={(e) => {
                  const nextEdId = e.target.value;
                  if (nextEdId === editionId) return;
                  if (!confirmSwitchScope()) return;
                  setEditionId(nextEdId);
                }}
                className="w-full xp-inset px-2 py-1.5 text-xs font-bold disabled:opacity-50"
              >
                <option value="">Select an edition...</option>
                {seasonEditions.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {ed.name}
                    {ed.id === currentOpenEditionId ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div
          ref={popoverContainerRef}
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <div className="relative">
            <button
              type="button"
              disabled={isEditDisabled}
              onClick={() => {
                setShowCustomAuthor((prev) => !prev);
                setShowGeneralNotes(false);
              }}
              className="xp-btn text-xs"
            >
              + Custom Author Name{savedAuthorName ? ` (${savedAuthorName})` : ""}
            </button>

            {showCustomAuthor && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-[calc(100vw-2.5rem)] max-w-sm sm:w-80 bg-[#1a201e] border border-[#4a5650] rounded-md shadow-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-[#c7c5b8]">
                    Custom Author Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomAuthor(false)}
                    className="text-[#a6a89e] hover:text-white p-0.5"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  disabled={isEditDisabled}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={`Leave blank to reset to ${discordDefaultName}`}
                  className="w-full xp-inset px-2.5 py-1.5 text-xs"
                />
                <div className="text-[10px] text-[#a6a89e]">
                  Leave blank to reset to {discordDefaultName}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              disabled={isEditDisabled}
              onClick={() => {
                setShowGeneralNotes((prev) => !prev);
                setShowCustomAuthor(false);
              }}
              className="xp-btn text-xs"
            >
              {authorNotes.trim() ? "General Notes (Added)" : "+ Add General Notes"}
            </button>

            {showGeneralNotes && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-[calc(100vw-2.5rem)] max-w-sm sm:w-[420px] bg-[#1a201e] border border-[#4a5650] rounded-md shadow-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-[#c7c5b8]">
                    General Notes
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGeneralNotes(false)}
                    className="text-[#a6a89e] hover:text-white p-0.5"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  maxLength={125}
                  disabled={isEditDisabled}
                  value={authorNotes}
                  onChange={(e) =>
                    setAuthorNotes(e.target.value.replace(/[\r\n]+/g, " ").slice(0, 125))
                  }
                  placeholder="Short general note for this ranking..."
                  className="w-full xp-inset p-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[#c89b3c] disabled:opacity-60"
                />
                <div className="flex justify-end text-[10px] text-[#a6a89e]">
                  {authorNotes.length}/125
                </div>
              </div>
            )}
          </div>
        </div>

        {(isSeasonInactive || isEditionArchived || isEditionLocked) && (
          <div className="mb-4 p-2.5 bg-[#3d3012] border border-[#8c6b16] text-[#f7d560] text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {isSeasonInactive
                ? "This season is currently inactive. Rankings cannot be created or edited."
                : isEditionArchived
                ? "This edition is archived. Drafts and rankings can no longer be created or edited."
                : !loadingBallot && ballotStatus === "published"
                ? "This edition is locked and your ranking has already been published."
                : "This edition is locked — you can still arrange teams, write comments, and save drafts, but publishing is disabled."}
            </span>
          </div>
        )}

        {message?.type === "error" && (
          <div className="mb-4 p-2.5 text-xs border bg-[#451717] border-[#9e3535] text-[#ff857a] flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}

        <div className="mb-3 pb-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[28px]">
            {message?.type === "success" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-[#173b24] border border-[#3a804d] text-[#7cd438] rounded">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{message.text}</span>
              </span>
            ) : ballotStatus === "published" ? (
              <span className="text-xs font-bold text-[#7cd438]">
                ● Published
              </span>
            ) : ballotStatus === "draft" ? (
              <span className="text-xs text-[#a6a89e]">● Draft saved</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {existingBallotId && ballotStatus === "published" && (
              <Link
                href={`/ballot/${existingBallotId}`}
                className="xp-btn text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Published Ranking</span>
              </Link>
            )}
            <button
              type="button"
              disabled={saving || isEditDisabled || rankedItems.length === 0}
              onClick={() => {
                if (ballotStatus === "published") {
                  setUnpublishConfirmOpen(true);
                } else {
                  void saveBallot("draft");
                }
              }}
              className="xp-btn text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? "Saving..."
                  : `Save Draft${hasUnsavedChanges ? "*" : ""}${
                      ballotStatus === "published" ? " (Unpublish)" : ""
                    }`}
              </span>
            </button>
            <button
              type="button"
              disabled={saving || isPublishDisabled || rankedItems.length === 0}
              onClick={() => saveBallot("published")}
              className="xp-btn xp-btn-primary text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? "Publishing..."
                  : `${
                      ballotStatus === "published"
                        ? "Update Published Ranking"
                        : "Publish Ranking"
                    }${hasUnsavedChanges ? "*" : ""}`}
              </span>
            </button>
          </div>
        </div>

        {loadingBallot ? (
          <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
            Loading teams...
          </div>
        ) : rankedItems.length === 0 ? (
          <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
            {!seasonId || !divisionId || !editionId
              ? "Select a season, division, and edition above to start ranking."
              : isEditionArchived
              ? "This edition is archived and you have no saved ranking for it."
              : isEditionLocked
              ? "This edition is locked and you have no saved ranking for it."
              : "No teams in this division."}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rankedItems.map((i) => i.team.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2.5">
                {rankedItems.map((item, idx) => (
                  <SortableTeamRow
                    key={item.team.id}
                    item={item}
                    index={idx}
                    total={rankedItems.length}
                    disabled={isEditDisabled}
                    onMove={handleMove}
                    onCommentaryChange={handleCommentaryChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </RetroWindow>

      <RetroConfirmModal
        open={unpublishConfirmOpen}
        title="Unpublish & Save as Draft?"
        message="Saving as a draft will unpublish your currently published ranking from Browse and Consensus until you publish again. Continue?"
        confirmLabel="Save Draft (Unpublish)"
        danger
        loading={saving}
        onConfirm={() => {
          setUnpublishConfirmOpen(false);
          void saveBallot("draft");
        }}
        onCancel={() => setUnpublishConfirmOpen(false)}
      />
    </div>
  );
}

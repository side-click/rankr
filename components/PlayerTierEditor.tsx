"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Dices,
  ExternalLink,
  Lock,
  RotateCcw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type {
  Division,
  DivisionTheme,
  Edition,
  PlayerTierItem,
  PlayerTierListPayload,
  Season,
  SeasonPlayer,
  Team,
  TierPresetKey,
  TierRowData,
} from "@/types/database";
import { RetroWindow } from "@/components/RetroWindow";
import { RetroConfirmModal } from "@/components/RetroConfirmModal";
import {
  CAPTAIN_ICON,
  getRoleMeta,
  LEAGUE_ROLES,
  normalizeRoster,
  type LeagueRole,
} from "@/utils/roles";
import { resolveDivisionTheme } from "@/utils/themes";
import {
  createEmptyTierRow,
  createInitialTierPayload,
  DEFAULT_TIER_COLORS,
  getRoleSectionTitle,
  getTierVariantKey,
  TIER_PRESETS,
} from "@/utils/tierPresets";

interface PlayerTierEditorProps {
  userId: string;
  initialAuthorName: string;
  discordDefaultName: string;
  seasons: Season[];
  divisions: Division[];
  themes?: DivisionTheme[];
  editions: Edition[];
  teams: Team[];
  seasonPlayers: SeasonPlayer[];
  initialSeasonSlug?: string;
  initialDivisionSlug?: string;
  initialEditionSlug?: string;
}

interface DragPlayerMeta {
  type: "player";
  sectionRole: LeagueRole | "all";
  source: "pool" | string; // "pool" or tier.id
  player: PlayerTierItem;
}

function getTierContrastText(hex: string): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#111318" : "#ffffff";
}

function PlayerTileVisual({
  player,
  disabled,
  showRemoveButton,
  onRemove,
  isOverlay,
}: {
  player: PlayerTierItem;
  disabled?: boolean;
  showRemoveButton?: boolean;
  onRemove?: () => void;
  isOverlay?: boolean;
}) {
  const roleMeta = getRoleMeta(player.role);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs select-none transition-colors ${
        isOverlay
          ? "bg-[#222834] border-[#f0c020] text-white shadow-2xl scale-105 cursor-grabbing"
          : disabled
          ? "bg-[#191e26] border-white/10 text-[#d6d3c4]"
          : "bg-[#1a2029] hover:bg-[#232b38] border-[#3d4654] hover:border-[#c89b3c] text-[#f5f3ea] cursor-grab active:cursor-grabbing shadow-xs"
      }`}
    >
      <img
        src={roleMeta.icon}
        alt={roleMeta.label}
        title={roleMeta.label}
        className="w-3.5 h-3.5 object-contain shrink-0 pointer-events-none"
      />
      <span className="font-bold leading-none whitespace-nowrap">
        {player.name.split("#")[0].trim() || player.name}
      </span>
      {player.team_logo_url ? (
        <img
          src={player.team_logo_url}
          alt={player.team_name ?? "Team"}
          title={player.team_name ?? undefined}
          className="w-3.5 h-3.5 object-contain shrink-0 pointer-events-none"
        />
      ) : (
        player.team_name && (
          <span className="text-[10px] font-semibold text-[#9aa1ad] bg-black/35 px-1.5 py-0.5 rounded leading-none whitespace-nowrap max-w-[100px] truncate">
            {player.team_name}
          </span>
        )
      )}
      {player.is_captain && (
        <img
          src={CAPTAIN_ICON}
          alt="Captain"
          title="Team Captain"
          className="w-3 h-3 object-contain shrink-0 pointer-events-none"
        />
      )}
      {showRemoveButton && !disabled && onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 text-[#9aa1ad] hover:text-[#ff857a] transition-colors cursor-pointer"
          title="Return to player pool"
        >
          <X className="w-3 h-3" />
        </button>
      )}

    </div>
  );
}

function DraggablePlayerTile({
  player,
  sectionRole,
  source,
  disabled,
  onRemove,
}: {
  player: PlayerTierItem;
  sectionRole: LeagueRole | "all";
  source: "pool" | string;
  disabled: boolean;
  onRemove?: () => void;
}) {
  const dragId = `drag:${sectionRole}:${source}:${player.id}`;
  const dropId = `tile-drop:${sectionRole}:${source}:${player.id}`;
  const isPlaced = source !== "pool";

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: dragId,
    disabled,
    data: {
      type: "player",
      sectionRole,
      source,
      player,
    } satisfies DragPlayerMeta,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId,
    disabled: disabled || !isPlaced,
    data: {
      type: "tile-drop",
      sectionRole,
      target: source,
      playerId: player.id,
    },
  });

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  return (
    <div
      ref={setRefs}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      className={`touch-none transition-all ${
        isDragging ? "opacity-30" : "opacity-100"
      } ${isOver && isPlaced ? "ring-2 ring-[#f0c020] rounded-md" : ""}`}
    >
      <PlayerTileVisual
        player={player}
        disabled={disabled}
        showRemoveButton={isPlaced}
        onRemove={onRemove}
      />

    </div>
  );
}

function DroppablePoolArea({
  sectionRole,
  players,
  totalAvailable,
  disabled,
  showRoleFilter,
  roleFilter,
  onRoleFilterChange,
  searchQuery,
  onSearchChange,
}: {
  sectionRole: LeagueRole | "all";
  players: PlayerTierItem[];
  totalAvailable: number;
  disabled: boolean;
  showRoleFilter: boolean;
  roleFilter: LeagueRole | "all";
  onRoleFilterChange: (r: LeagueRole | "all") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `pool:${sectionRole}`,
    disabled,
    data: {
      type: "container",
      sectionRole,
      target: "pool",
    },
  });

  const displayedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return players.filter((p) => {
      if (showRoleFilter && roleFilter !== "all" && p.role !== roleFilter) {
        return false;
      }
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.team_name ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [players, showRoleFilter, roleFilter, searchQuery]);

  return (
    <div className="xp-panel p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase text-[#f0c020]">
            Unranked Player Pool
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#14171d] border border-white/15 rounded-xs text-[#d6d3c4]">
            {players.length} remaining / {totalAvailable} total
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {showRoleFilter && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onRoleFilterChange("all")}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-xs border cursor-pointer ${
                  roleFilter === "all"
                    ? "bg-[#2a2210] border-[#c89b3c] text-[#f0c020]"
                    : "bg-[#14171d] border-white/15 text-[#a6a89e] hover:text-white"
                }`}
              >
                All
              </button>
              {LEAGUE_ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onRoleFilterChange(r.key)}
                  title={r.label}
                  className={`p-1 rounded-xs border cursor-pointer ${
                    roleFilter === r.key
                      ? "bg-[#2a2210] border-[#c89b3c]"
                      : "bg-[#14171d] border-white/15 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={r.icon}
                    alt={r.label}
                    className="w-3.5 h-3.5 object-contain"
                  />
                </button>
              ))}
            </div>
          )}
          {players.length > 8 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter player..."
              className="xp-inset px-2 py-0.5 text-[11px] w-32"
            />
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`xp-inset p-2.5 min-h-[76px] max-h-60 overflow-y-auto flex flex-wrap content-start gap-1.5 transition-colors ${
          isOver ? "ring-2 ring-[#f0c020] bg-[#1e242c]" : ""
        }`}
      >
        {displayedPlayers.length === 0 ? (
          <span className="text-[11px] text-[#7e8781] italic py-2 px-1">
            {totalAvailable === 0
              ? "No players found for this season/division scope yet."
              : players.length === 0
              ? "All available players have been placed into tiers! Drag any player back here to unrank them."
              : "No players match this filter."}
          </span>
        ) : (
          displayedPlayers.map((player) => (
            <DraggablePlayerTile
              key={`${sectionRole}:pool:${player.id}`}
              player={player}
              sectionRole={sectionRole}
              source="pool"
              disabled={disabled}
            />
          ))
        )}
      </div>

    </div>
  );
}

function DroppableTierRow({
  sectionRole,
  tier,
  index,
  totalTiers,
  disabled,
  onLabelChange,
  onColorChange,
  onCommentaryChange,
  onMoveTier,
  onInsertTier,
  onDeleteTier,
  onRemovePlayer,
}: {
  sectionRole: LeagueRole | "all";
  tier: TierRowData;
  index: number;
  totalTiers: number;
  disabled: boolean;
  onLabelChange: (val: string) => void;
  onColorChange: (val: string) => void;
  onCommentaryChange: (val: string) => void;
  onMoveTier: (dir: -1 | 1) => void;
  onInsertTier: (pos: "above" | "below") => void;
  onDeleteTier: () => void;
  onRemovePlayer: (playerId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tier:${sectionRole}:${tier.id}`,
    disabled,
    data: {
      type: "container",
      sectionRole,
      target: tier.id,
    },
  });

  const [showColorPicker, setShowColorPicker] = useState(false);
  const contrastText = getTierContrastText(tier.color);

  return (
    <div
      style={{
        borderColor: `${tier.color}66`,
        background: `linear-gradient(90deg, ${tier.color}22 0%, rgba(20, 23, 31, 0.94) 55%)`,
      }}
      className="rounded-lg border shadow-md"
    >
      <div className="flex flex-col md:flex-row items-stretch">
        {/* Left: Tier Badge + Editable Label + Tier Row Controls */}
        <div
          style={{
            backgroundColor: tier.color,
            color: contrastText,
          }}
          className="md:w-[152px] shrink-0 p-2.5 flex flex-row md:flex-col items-center justify-between gap-2 border-b md:border-b-0 md:border-r border-black/30 rounded-t-lg md:rounded-t-none md:rounded-l-lg"
        >
          <div className="inline-grid items-center justify-items-center max-w-full">
            <span
              aria-hidden="true"
              className="col-start-1 row-start-1 invisible whitespace-pre px-2 py-1 font-black text-sm leading-tight min-w-[2ch]"
            >
              {tier.label || "Tier..."}
            </span>
            <input
              type="text"
              size={1}
              disabled={disabled}
              value={tier.label}
              maxLength={13}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Tier..."
              style={{ color: contrastText }}
              className="col-start-1 row-start-1 w-full min-w-0 bg-black/15 hover:bg-black/25 focus:bg-black/30 rounded px-2 py-1 text-center font-black text-sm leading-tight focus:outline-none placeholder:text-white/50 disabled:opacity-75"
            />
          </div>

          {!disabled && (
            <div className="grid grid-cols-3 gap-1 shrink-0 items-center justify-items-center relative">
              <button
                type="button"
                onClick={() => setShowColorPicker((prev) => !prev)}
                title="Change tier color"
                style={{ backgroundColor: tier.color }}
                className="w-6 h-6 rounded border-2 border-white/50 hover:border-white cursor-pointer shadow-xs"
              />
              {showColorPicker && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowColorPicker(false)}
                  />
                  <div className="absolute left-0 top-7 z-30 p-2 rounded-md bg-[#181c24] border border-white/20 shadow-2xl grid grid-cols-5 gap-1.5 w-[154px]">
                    {DEFAULT_TIER_COLORS.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => {
                          onColorChange(swatch);
                          setShowColorPicker(false);
                        }}
                        style={{ backgroundColor: swatch }}
                        className={`w-6 h-6 rounded border cursor-pointer transition-transform hover:scale-110 ${
                          tier.color.toLowerCase() === swatch.toLowerCase()
                            ? "border-white ring-1 ring-white"
                            : "border-black/50"
                        }`}
                        title={swatch}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Row 1 Col 2: Add tier above */}
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Add a new tier above "${tier.label || "this tier"}"?`
                    )
                  ) {
                    onInsertTier("above");
                  }
                }}
                className="w-6 h-6 flex items-center justify-center rounded bg-black/25 hover:bg-black/45 text-white text-[10px] font-bold cursor-pointer"
                title="Add tier above"
              >
                +↑
              </button>
              {/* Row 1 Col 3: Move tier up */}
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveTier(-1)}
                className="w-6 h-6 flex items-center justify-center rounded bg-black/25 hover:bg-black/45 text-white disabled:opacity-30 cursor-pointer"
                title="Move tier up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              {/* Row 2 Col 1: Delete tier */}
              <button
                type="button"
                disabled={totalTiers <= 1}
                onClick={() => {
                  if (
                    confirm(
                      `Delete tier "${
                        tier.label || "Untitled"
                      }"? Any players in it will return to the pool.`
                    )
                  ) {
                    onDeleteTier();
                  }
                }}
                className="w-6 h-6 flex items-center justify-center rounded bg-black/30 hover:bg-[#9e2626] text-white disabled:opacity-30 cursor-pointer"
                title="Delete tier (returns players to pool)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              {/* Row 2 Col 2: Add tier below */}
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Add a new tier below "${tier.label || "this tier"}"?`
                    )
                  ) {
                    onInsertTier("below");
                  }
                }}
                className="w-6 h-6 flex items-center justify-center rounded bg-black/25 hover:bg-black/45 text-white text-[10px] font-bold cursor-pointer"
                title="Add tier below"
              >
                +↓
              </button>
              {/* Row 2 Col 3: Move tier down */}
              <button
                type="button"
                disabled={index === totalTiers - 1}
                onClick={() => onMoveTier(1)}
                className="w-6 h-6 flex items-center justify-center rounded bg-black/25 hover:bg-black/45 text-white disabled:opacity-30 cursor-pointer"
                title="Move tier down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Droppable Player Tiles Zone */}
        <div
          ref={setNodeRef}
          className={`flex-1 min-h-[82px] p-2.5 flex flex-wrap content-start items-start gap-1.5 transition-colors ${
            isOver ? "bg-[#f0c020]/15 ring-2 ring-inset ring-[#f0c020]" : "bg-[#11141b]"
          }`}
        >
          {tier.players.length === 0 ? (
            <span className="text-[11px] text-white/30 italic py-2 px-1 select-none">
              Drag players here...
            </span>
          ) : (
            tier.players.map((pl) => (
              <DraggablePlayerTile
                key={`${sectionRole}:${tier.id}:${pl.id}`}
                player={pl}
                sectionRole={sectionRole}
                source={tier.id}
                disabled={disabled}
                onRemove={() => onRemovePlayer(pl.id)}
              />
            ))
          )}
        </div>

        {/* Right: Tier Commentary */}
        <div className="md:w-[270px] lg:w-[320px] shrink-0 p-2.5 border-t md:border-t-0 md:border-l border-white/10 bg-[#14171f]">
          {(() => {
            const maxChars = sectionRole === "all" ? 400 : 280;
            return (
              <>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">
                    Tier Commentary
                  </label>
                  <span className="text-[10px] text-white/40 font-mono">
                    {tier.commentary.length}/{maxChars}
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={maxChars}
                  disabled={disabled}
                  value={tier.commentary}
                  onChange={(e) =>
                    onCommentaryChange(e.target.value.slice(0, maxChars))
                  }
                  placeholder={`Thoughts on ${tier.label || "this tier"}...`}
                  className="w-full rounded-md bg-black/30 border border-white/15 p-2 text-xs text-[#f0ede0] placeholder:text-white/30 resize-y focus:outline-none focus:border-[#f0c020] disabled:opacity-60"
                />
              </>
            );
          })()}
        </div>
      </div>

    </div>
  );
}

export function PlayerTierEditor({
  userId,
  initialAuthorName,
  discordDefaultName,
  seasons,
  divisions,
  themes,
  editions,
  teams,
  seasonPlayers,
  initialSeasonSlug,
  initialDivisionSlug,
  initialEditionSlug,
}: PlayerTierEditorProps) {
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
        .filter((e) => e.season_id === seasonId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [editions, seasonId]
  );

  const currentOpenEditionId = useMemo(() => {
    const reversed = [...seasonEditions].reverse();
    return reversed.find((ed) => ed.is_open && !ed.is_archived)?.id ?? null;
  }, [seasonEditions]);

  // "" = unselected, "all" = division_id = null ("All Divisions" / Pre-draft / SCDL theme)
  const [divisionScope, setDivisionScope] = useState<string>(() => {
    if (!initialDivisionSlug) return "";
    if (initialDivisionSlug === "all") return "all";
    const match = divisions.find(
      (d) =>
        d.season_id === defaultSeason?.id && d.slug === initialDivisionSlug
    );
    return match?.id ?? "";
  });

  const [editionId, setEditionId] = useState<string>(() => {
    if (!initialEditionSlug) return "";
    const seasonEds = editions.filter((e) => e.season_id === defaultSeason?.id);
    const match = seasonEds.find((e) => e.slug === initialEditionSlug);
    return match?.id ?? "";
  });

  const currentDivision =
    divisionScope === "all"
      ? undefined
      : seasonDivisions.find((d) => d.id === divisionScope);
  const currentEdition = seasonEditions.find((e) => e.id === editionId);
  const currentSeason = seasons.find((s) => s.id === seasonId);

  // Sync season slug changes & validate divisionScope/editionId
  useEffect(() => {
    const active = seasons.filter((s) => s.is_active);
    if (initialSeasonSlug) {
      const matched = seasons.find((s) => s.slug === initialSeasonSlug);
      if (matched) setSeasonId(matched.id);
    } else {
      setSeasonId(active.length === 1 ? active[0].id : "");
    }
  }, [initialSeasonSlug, seasons]);

  useEffect(() => {
    if (
      divisionScope !== "" &&
      divisionScope !== "all" &&
      !seasonDivisions.some((d) => d.id === divisionScope)
    ) {
      setDivisionScope("");
      if (editionId !== "") setEditionId("");
      return;
    }

    if (!divisionScope) {
      if (editionId !== "") setEditionId("");
      return;
    }

    if (seasonEditions.length === 0) {
      if (editionId !== "") setEditionId("");
    } else if (!seasonEditions.some((e) => e.id === editionId)) {
      const reversedEds = [...seasonEditions].reverse();
      const latestOpen = reversedEds.find((e) => e.is_open && !e.is_archived);
      const latestActive = reversedEds.find((e) => !e.is_archived);
      setEditionId((latestOpen ?? latestActive ?? reversedEds[0]).id);
    }
  }, [seasonId, seasonDivisions, seasonEditions, divisionScope, editionId]);

  // Resolve available player pool for this scope
  const availablePlayers = useMemo<PlayerTierItem[]>(() => {
    if (!seasonId || !divisionScope) return [];

    // Helper: team roster lookup map by lower name for this season
    const teamRosterByName = new Map<
      string,
      {
        team_name: string;
        team_logo_url: string | null;
        division_id: string;
        role: LeagueRole;
        is_captain: boolean;
      }
    >();

    const seasonDivIds = new Set(seasonDivisions.map((d) => d.id));
    const relevantTeams =
      divisionScope === "all"
        ? teams.filter((t) => seasonDivIds.has(t.division_id))
        : teams.filter((t) => t.division_id === divisionScope);

    const teamRosterPlayers: PlayerTierItem[] = [];
    for (const team of relevantTeams) {
      const roster = normalizeRoster(team.roster, team.captain);
      for (const slot of roster) {
        const cleanName = slot.name.trim();
        if (!cleanName) continue;
        teamRosterByName.set(cleanName.toLowerCase(), {
          team_name: team.name,
          team_logo_url: team.logo_url,
          division_id: team.division_id,
          role: slot.role,
          is_captain: Boolean(slot.is_captain),
        });
        teamRosterPlayers.push({
          id: `team:${team.id}:${slot.role}:${cleanName.toLowerCase()}`,
          name: cleanName,
          role: slot.role,
          division_id: team.division_id,
          team_name: team.name,
          team_logo_url: team.logo_url,
          is_captain: Boolean(slot.is_captain),
        });
      }
    }

    if (divisionScope !== "all") {
      return teamRosterPlayers;
    }

    // Teamed edition with teams assigned: use only team rosters (never duplicate with season_players)
    if (!currentEdition?.is_players_only && teamRosterPlayers.length > 0) {
      return teamRosterPlayers;
    }

    // Division scope = "all": pre-draft season_players + post-draft team players (unless Players-Only edition when season_players exists)
    const poolFromSeason = seasonPlayers.filter(
      (sp) => sp.season_id === seasonId && sp.is_active
    );
    const merged: PlayerTierItem[] = [];
    const seenNames = new Set<string>();

    for (const sp of poolFromSeason) {
      const cleanName = sp.name.trim();
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      const teamMeta = currentEdition?.is_players_only
        ? undefined
        : teamRosterByName.get(key);

      merged.push({
        id: `sp:${sp.id}`,
        name: cleanName,
        role: sp.role,
        division_id: teamMeta?.division_id ?? sp.division_id,
        team_name: teamMeta?.team_name ?? null,
        team_logo_url: teamMeta?.team_logo_url ?? null,
        is_captain: teamMeta?.is_captain ?? sp.is_captain,
      });
    }

    if (!currentEdition?.is_players_only || poolFromSeason.length === 0) {
      for (const tp of teamRosterPlayers) {
        const key = tp.name.trim().toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        merged.push(tp);
      }
    }

    return merged;
  }, [
    seasonId,
    divisionScope,
    seasonDivisions,
    teams,
    seasonPlayers,
    currentEdition?.is_players_only,
  ]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialVariant = searchParams.get("variant");

  const [selectedPreset, setSelectedPreset] = useState<
    Exclude<TierPresetKey, "custom">
  >(() => {
    if (
      initialVariant === "draft_day_overall" ||
      initialVariant === "draft_day_split"
    ) {
      return "draft_day";
    }
    if (
      initialVariant === "standard_overall" ||
      initialVariant === "standard_split"
    ) {
      return "standard";
    }
    return currentEdition?.is_players_only ? "draft_day" : "standard";
  });
  const [selectedSplitByRole, setSelectedSplitByRole] = useState(() => {
    if (
      initialVariant === "standard_split" ||
      initialVariant === "draft_day_split"
    ) {
      return true;
    }
    if (
      initialVariant === "standard_overall" ||
      initialVariant === "draft_day_overall"
    ) {
      return false;
    }
    return false;
  });
  const activeTierVariant = getTierVariantKey(
    selectedPreset,
    selectedSplitByRole
  );

  const didMountUrlSyncRef = useRef(false);

  useEffect(() => {
    if (!didMountUrlSyncRef.current) {
      didMountUrlSyncRef.current = true;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("type", "player");
    if (currentSeason?.slug) params.set("season", currentSeason.slug);
    else params.delete("season");

    if (divisionScope === "all") {
      params.set("division", "all");
    } else if (currentDivision?.slug) {
      params.set("division", currentDivision.slug);
    } else {
      params.delete("division");
    }

    if (currentEdition?.slug) params.set("edition", currentEdition.slug);
    else params.delete("edition");

    params.set("variant", activeTierVariant);

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [
    pathname,
    currentSeason?.slug,
    divisionScope,
    currentDivision?.slug,
    currentEdition?.slug,
    activeTierVariant,
  ]);

  const [tierPayload, setTierPayload] = useState<PlayerTierListPayload>(() =>
    createInitialTierPayload(selectedPreset, selectedSplitByRole)
  );
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [savedAuthorName, setSavedAuthorName] = useState(initialAuthorName);
  const [authorNotes, setAuthorNotes] = useState("");
  const [showCustomAuthor, setShowCustomAuthor] = useState(false);
  const [showGeneralNotes, setShowGeneralNotes] = useState(false);
  const popoverContainerRef = useRef<HTMLDivElement>(null);

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
  const [existingBallotId, setExistingBallotId] = useState<string | null>(null);
  const [ballotStatus, setBallotStatus] = useState<"draft" | "published" | null>(
    null
  );
  const [loadingBallot, setLoadingBallot] = useState(false);
  const lastLoadedKeyRef = useRef<string>("");
  const lastScopeKeyRef = useRef<string>("");
  const [saving, setSaving] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{
    targetStatus: "draft" | "published";
    existingStatus: string;
    existingVariant: string | null;
  } | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [poolSearchBySection, setPoolSearchBySection] = useState<
    Record<string, string>
  >({});
  const [unifiedRoleFilter, setUnifiedRoleFilter] = useState<
    LeagueRole | "all"
  >("all");
  const [activeDragPlayer, setActiveDragPlayer] =
    useState<PlayerTierItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  // Load saved player tier ballot when (seasonId, divisionScope, editionId) or tier_variant changes
  useEffect(() => {
    if (!seasonId || !divisionScope || !editionId) {
      lastLoadedKeyRef.current = "";
      lastScopeKeyRef.current = "";
      setExistingBallotId(null);
      setBallotStatus(null);
      setLoadingBallot(false);
      return;
    }

    const scopeKey = `${seasonId}:${divisionScope}:${editionId}`;
    const selectionKey = `${scopeKey}:${activeTierVariant}`;
    if (lastLoadedKeyRef.current === selectionKey) return;

    const isScopeChange = lastScopeKeyRef.current !== scopeKey;
    let cancelled = false;

    async function loadBallotState() {
      setLoadingBallot(true);
      setMessage(null);

      try {
        let query = supabase
          .from("ballots")
          .select("*")
          .eq("user_id", userId)
          .eq("season_id", seasonId)
          .eq("edition_id", editionId)
          .eq("ranking_type", "player");

        if (divisionScope === "all") {
          query = query.is("division_id", null);
        } else {
          query = query.eq("division_id", divisionScope);
        }

        if (!isScopeChange) {
          query = query.eq("tier_variant", activeTierVariant);
        } else {
          query = query.order("updated_at", { ascending: false });
        }

        const { data: rows } = await query;
        if (cancelled) return;

        const matchingList = rows ?? [];
        let currentBallot =
          matchingList.find((b) => b.tier_variant === activeTierVariant) ?? null;

        if (isScopeChange && !currentBallot && matchingList.length > 0) {
          // Prefer published over draft, then most recently updated
          currentBallot =
            matchingList.find((b) => b.status === "published") ??
            matchingList[0];
        }

        lastScopeKeyRef.current = scopeKey;

        if (currentBallot) {
          const resolvedVariant =
            (currentBallot.tier_variant as string | null) ?? activeTierVariant;
          const resolvedPreset: Exclude<TierPresetKey, "custom"> =
            resolvedVariant === "draft_day_overall" ||
            resolvedVariant === "draft_day_split"
              ? "draft_day"
              : "standard";
          const resolvedSplit =
            resolvedVariant === "standard_split" ||
            resolvedVariant === "draft_day_split";

          if (resolvedVariant !== activeTierVariant) {
            setSelectedPreset(resolvedPreset);
            setSelectedSplitByRole(resolvedSplit);
          }

          setExistingBallotId(currentBallot.id);
          setBallotStatus(currentBallot.status);
          setAuthorNotes(currentBallot.author_notes ?? "");
          setShowGeneralNotes(false);

          const savedTierData = currentBallot.tier_data as
            | PlayerTierListPayload
            | null
            | undefined;
          if (
            savedTierData &&
            Array.isArray(savedTierData.sections) &&
            savedTierData.sections.length > 0
          ) {
            setTierPayload(savedTierData);
          } else {
            setTierPayload(
              createInitialTierPayload(resolvedPreset, resolvedSplit)
            );
          }

          lastLoadedKeyRef.current = `${scopeKey}:${resolvedVariant}`;
        } else {
          setExistingBallotId(null);
          setBallotStatus(null);
          setAuthorNotes("");
          setShowGeneralNotes(false);
          setTierPayload(
            createInitialTierPayload(selectedPreset, selectedSplitByRole)
          );
          lastLoadedKeyRef.current = selectionKey;
        }
      } finally {
        if (!cancelled) setLoadingBallot(false);
      }
    }

    void loadBallotState();

    return () => {
      cancelled = true;
    };
  }, [
    seasonId,
    divisionScope,
    editionId,
    activeTierVariant,
    selectedPreset,
    selectedSplitByRole,
    seasonEditions,
    supabase,
    userId,
  ]);

  // Compute placed keys (by id and lowercase name) so unplaced pool stays synced
  const placedNamesLower = useMemo(() => {
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const sec of tierPayload.sections) {
      for (const tier of sec.tiers) {
        for (const p of tier.players) {
          ids.add(p.id);
          names.add(p.name.trim().toLowerCase());
        }
      }
    }
    return { ids, names };
  }, [tierPayload]);

  const totalPlacedPlayers = useMemo(
    () =>
      tierPayload.sections.reduce(
        (acc, sec) =>
          acc + sec.tiers.reduce((s, t) => s + t.players.length, 0),
        0
      ),
    [tierPayload]
  );

  const hasTierWork = useMemo(() => {
    if (totalPlacedPlayers > 0) return true;
    if (authorNotes.trim().length > 0) return true;
    return tierPayload.sections.some((sec) =>
      sec.tiers.some((t) => Boolean(t.commentary?.trim()))
    );
  }, [totalPlacedPlayers, authorNotes, tierPayload]);

  function confirmSwitchScope(): boolean {
    if (!hasTierWork) return true;
    return window.confirm(
      "Changing this will clear any unsaved or unpublished tier assignments and commentary. Continue?"
    );
  }

  function getPoolPlayersForSection(sectionRole: LeagueRole | "all") {
    return availablePlayers.filter((p) => {
      if (sectionRole !== "all" && p.role !== sectionRole) return false;
      if (placedNamesLower.ids.has(p.id)) return false;
      if (placedNamesLower.names.has(p.name.trim().toLowerCase())) return false;
      return true;
    });
  }

  function getTotalAvailableForSection(sectionRole: LeagueRole | "all") {
    return sectionRole === "all"
      ? availablePlayers.length
      : availablePlayers.filter((p) => p.role === sectionRole).length;
  }

  // Tier Manipulation Handlers
  const isSpecificDivision = Boolean(
    divisionScope && divisionScope !== "all"
  );
  const isAfterFirstEdition = Boolean(
    editionId &&
      seasonEditions.length > 0 &&
      editionId !== seasonEditions[0].id
  );
  const isDraftDayDisallowed = isSpecificDivision || isAfterFirstEdition;

  useEffect(() => {
    if (isDraftDayDisallowed && selectedPreset === "draft_day") {
      setSelectedPreset("standard");
    }
  }, [isDraftDayDisallowed, selectedPreset]);

  function handleApplyPreset(presetKey: Exclude<TierPresetKey, "custom">) {
    if (presetKey === "draft_day" && isDraftDayDisallowed) return;
    if (presetKey === selectedPreset) return;
    if (!confirmSwitchScope()) return;
    setSelectedPreset(presetKey);
  }

  function handleToggleSplitMode(nextSplit: boolean) {
    if (nextSplit === selectedSplitByRole) return;
    if (!confirmSwitchScope()) return;
    setSelectedSplitByRole(nextSplit);
  }

  function handleResetPlacements() {
    if (
      totalPlacedPlayers > 0 &&
      !window.confirm(
        `Return all ${totalPlacedPlayers} placed players back to the unranked pool?`
      )
    ) {
      return;
    }
    setTierPayload((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => ({
        ...sec,
        tiers: sec.tiers.map((t) => ({ ...t, players: [] })),
      })),
    }));
  }

  function updateSectionTier(
    sectionRole: LeagueRole | "all",
    tierId: string,
    updater: (tier: TierRowData) => TierRowData
  ) {
    setTierPayload((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.role !== sectionRole
          ? sec
          : {
              ...sec,
              tiers: sec.tiers.map((t) => (t.id === tierId ? updater(t) : t)),
            }
      ),
    }));
  }

  function handleMoveTierRow(
    sectionRole: LeagueRole | "all",
    index: number,
    dir: -1 | 1
  ) {
    setTierPayload((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.role !== sectionRole) return sec;
        const target = index + dir;
        if (target < 0 || target >= sec.tiers.length) return sec;
        const next = [...sec.tiers];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        return { ...sec, tiers: next };
      }),
    }));
  }

  function handleInsertTierRow(
    sectionRole: LeagueRole | "all",
    index: number,
    pos: "above" | "below"
  ) {
    setTierPayload((prev) => ({
      ...prev,
      preset: "custom",
      sections: prev.sections.map((sec) => {
        if (sec.role !== sectionRole) return sec;
        const insertAt = pos === "above" ? index : index + 1;
        const next = [...sec.tiers];
        next.splice(
          insertAt,
          0,
          createEmptyTierRow("New Tier", sec.tiers.length)
        );
        return { ...sec, tiers: next };
      }),
    }));
  }

  function handleDeleteTierRow(
    sectionRole: LeagueRole | "all",
    tierId: string
  ) {
    setTierPayload((prev) => ({
      ...prev,
      preset: "custom",
      sections: prev.sections.map((sec) => {
        if (sec.role !== sectionRole || sec.tiers.length <= 1) return sec;
        return {
          ...sec,
          tiers: sec.tiers.filter((t) => t.id !== tierId),
        };
      }),
    }));
  }

  function handleRemovePlayerFromTier(
    sectionRole: LeagueRole | "all",
    tierId: string,
    playerId: string
  ) {
    updateSectionTier(sectionRole, tierId, (tier) => ({
      ...tier,
      players: tier.players.filter((p) => p.id !== playerId),
    }));
  }

  // Same-section collision detection prioritizing specific placed tiles over container
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeRole = args.active.data.current?.sectionRole;
    const sameSection = args.droppableContainers.filter(
      (c) => c.data.current?.sectionRole === activeRole
    );
    const pointerHits = pointerWithin({
      ...args,
      droppableContainers: sameSection,
    });
    const tileHit = pointerHits.find((h) =>
      String(h.id).startsWith("tile-drop:")
    );
    if (tileHit) return [tileHit];
    if (pointerHits.length > 0) return pointerHits;
    return closestCorners({ ...args, droppableContainers: sameSection });
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const meta = event.active.data.current as DragPlayerMeta | undefined;
    if (meta?.player) {
      setActiveDragPlayer(meta.player);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragPlayer(null);
    const { active, over } = event;
    if (!over) return;

    const meta = active.data.current as DragPlayerMeta | undefined;
    const overData = over.data.current as
      | {
          type?: string;
          sectionRole?: LeagueRole | "all";
          target?: string;
          playerId?: string;
        }
      | undefined;

    if (!meta || !overData) return;
    if (meta.sectionRole !== overData.sectionRole) return;

    const sectionRole = meta.sectionRole;
    const draggedPlayer = meta.player;
    const targetBucket = overData.target; // "pool" or tier.id
    const targetPlayerId = overData.playerId;

    if (!targetBucket) return;
    if (meta.source === "pool" && targetBucket === "pool") return;

    setTierPayload((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.role !== sectionRole) return sec;

        // First strip draggedPlayer from wherever it currently is in this section
        const strippedTiers = sec.tiers.map((t) => ({
          ...t,
          players: t.players.filter((p) => p.id !== draggedPlayer.id),
        }));

        if (targetBucket === "pool") {
          return { ...sec, tiers: strippedTiers };
        }

        // Insert into targetBucket tier (at targetPlayerId index if hovering over a placed tile, else end)
        const nextTiers = strippedTiers.map((t) => {
          if (t.id !== targetBucket) return t;
          const nextPlayers = [...t.players];
          if (targetPlayerId) {
            const idx = nextPlayers.findIndex((p) => p.id === targetPlayerId);
            if (idx !== -1) {
              nextPlayers.splice(idx, 0, draggedPlayer);
              return { ...t, players: nextPlayers };
            }
          }
          nextPlayers.push(draggedPlayer);
          return { ...t, players: nextPlayers };
        });

        return { ...sec, tiers: nextTiers };
      }),
    }));
  }

  function handleRandomizeTiers() {
    setTierPayload((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.tiers.length === 0) return sec;
        const pool = getPoolPlayersForSection(sec.role);
        const seenIds = new Set<string>();
        const allSectionPlayers: TierRowData["players"] = [];
        for (const player of [...sec.tiers.flatMap((t) => t.players), ...pool]) {
          if (seenIds.has(player.id)) continue;
          seenIds.add(player.id);
          allSectionPlayers.push(player);
        }
        if (allSectionPlayers.length === 0) return sec;

        const shuffled = [...allSectionPlayers];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const buckets: TierRowData["players"][] = sec.tiers.map(() => []);
        shuffled.forEach((player) => {
          const randIdx = Math.floor(Math.random() * sec.tiers.length);
          buckets[randIdx].push(player);
        });
        return {
          ...sec,
          tiers: sec.tiers.map((t, idx) => ({
            ...t,
            players: buckets[idx],
          })),
        };
      }),
    }));
  }

  function formatVariantLabel(variant: string | null | undefined): string {
    switch (variant) {
      case "standard_overall":
        return "Standard Tiers • Overall";
      case "standard_split":
        return "Standard Tiers • Split Roles";
      case "draft_day_overall":
        return "Draft Day Tiers • Overall";
      case "draft_day_split":
        return "Draft Day Tiers • Split Roles";
      default:
        return "another configuration";
    }
  }

  async function savePlayerTierList(
    targetStatus: "draft" | "published",
    skipOverwriteConfirm = false
  ) {
    if (!seasonId || !divisionScope || !editionId) {
      setMessage({
        type: "error",
        text: "Select a season, player pool, and edition first.",
      });
      return;
    }

    if (totalPlacedPlayers === 0) {
      setMessage({
        type: "error",
        text: "Drag at least one player into a tier before saving.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const dbDivisionId = divisionScope === "all" ? null : divisionScope;

      if (!skipOverwriteConfirm && !existingBallotId) {
        let checkQuery = supabase
          .from("ballots")
          .select("id, status, tier_variant")
          .eq("user_id", userId)
          .eq("season_id", seasonId)
          .eq("edition_id", editionId)
          .eq("ranking_type", "player");

        if (dbDivisionId) {
          checkQuery = checkQuery.eq("division_id", dbDivisionId);
        } else {
          checkQuery = checkQuery.is("division_id", null);
        }

        const { data: existingRows } = await checkQuery;
        const otherVariantRow = (existingRows ?? []).find(
          (row) => row.tier_variant !== activeTierVariant
        );

        if (otherVariantRow) {
          setOverwriteConfirm({
            targetStatus,
            existingStatus: otherVariantRow.status,
            existingVariant: otherVariantRow.tier_variant,
          });
          setSaving(false);
          return;
        }
      }
      const now = new Date().toISOString();
      const resolvedAuthor = authorName.trim() || discordDefaultName;

      if (resolvedAuthor !== savedAuthorName) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ username: resolvedAuthor })
          .eq("id", userId);
        if (profileErr) throw new Error(profileErr.message);
        setAuthorName(resolvedAuthor);
        setSavedAuthorName(resolvedAuthor);
      }

      const currentLeague = Array.isArray(currentSeason?.leagues)
        ? currentSeason?.leagues[0]
        : currentSeason?.leagues;

      const scopeTitle =
        divisionScope === "all"
          ? `${
              currentLeague?.short_name ||
              currentLeague?.name ||
              currentSeason?.name ||
              "League"
            } Player Tier List`
          : `${currentDivision?.name ?? "Division"} Player Tier List`;

      const defaultTitle = `${scopeTitle} — ${
        currentEdition?.name ?? "Edition"
      }`;

      const payload = {
        user_id: userId,
        season_id: seasonId,
        division_id: dbDivisionId,
        edition_id: editionId,
        ranking_type: "player" as const,
        tier_variant: activeTierVariant,
        tier_data: tierPayload,
        title: defaultTitle,
        author_notes: authorNotes.trim(),
        status: targetStatus,
        published_at: targetStatus === "published" ? now : null,
        league_name_snapshot: currentLeague?.name ?? null,
        season_name_snapshot: currentSeason?.name ?? null,
        division_name_snapshot:
          divisionScope === "all" ? null : currentDivision?.name ?? null,
        division_logo_snapshot:
          divisionScope === "all" ? null : currentDivision?.logo_url ?? null,
        division_theme_snapshot:
          divisionScope === "all"
            ? "scdl"
            : currentDivision?.theme_key ?? null,
        edition_name_snapshot: currentEdition?.name ?? null,
        updated_at: now,
      };

      let targetBallotId = existingBallotId;
      if (!targetBallotId) {
        let lookup = supabase
          .from("ballots")
          .select("id")
          .eq("user_id", userId)
          .eq("season_id", seasonId)
          .eq("edition_id", editionId)
          .eq("ranking_type", "player");

        if (dbDivisionId) {
          lookup = lookup.eq("division_id", dbDivisionId);
        } else {
          lookup = lookup.is("division_id", null);
        }

        const { data: existingRow } = await lookup.maybeSingle();
        if (existingRow?.id) targetBallotId = existingRow.id;
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
        throw new Error(ballotErr?.message ?? "Failed to save tier list.");
      }

      setExistingBallotId(savedBallot.id);
      setBallotStatus(savedBallot.status as "draft" | "published");

      if (targetStatus === "published") {
        // Keep only one published player tier list per user/season/division/edition;
        // revert any other published variant for this scope back to a saved draft.
        let unpubQuery = supabase
          .from("ballots")
          .update({ status: "draft", published_at: null })
          .eq("user_id", userId)
          .eq("season_id", seasonId)
          .eq("edition_id", editionId)
          .eq("ranking_type", "player")
          .eq("status", "published")
          .neq("id", savedBallot.id);
        if (dbDivisionId) {
          unpubQuery = unpubQuery.eq("division_id", dbDivisionId);
        } else {
          unpubQuery = unpubQuery.is("division_id", null);
        }
        await unpubQuery;

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
            ? "Player Tier List published!"
            : `Draft saved at ${new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}.`,
      });
      router.refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving tier list.",
      });
    } finally {
      setSaving(false);
    }
  }

  const isSeasonInactive = currentSeason ? !currentSeason.is_active : false;
  const isEditionArchived = Boolean(currentEdition?.is_archived);
  const isEditionLocked = currentEdition ? !currentEdition.is_open : false;
  const isEditDisabled =
    isSeasonInactive ||
    isEditionArchived ||
    (isEditionLocked && ballotStatus === "published");
  const isPublishDisabled =
    isSeasonInactive || isEditionArchived || isEditionLocked;

  const isDivisionless = divisionScope === "all" || !currentDivision;
  const windowTheme = isDivisionless
    ? "scdl"
    : currentDivision.theme_key === "dragon"
    ? "dragon"
    : "baron";
  const activeTheme = !isDivisionless
    ? resolveDivisionTheme(currentDivision.theme_key, themes)
    : undefined;

  return (
    <div className="space-y-4">
      <RetroWindow
        title="Player Tier List Editor"
        theme={windowTheme}
        customTheme={activeTheme}
        iconSrc={
          !isDivisionless
            ? currentDivision.logo_url ??
              activeTheme?.default_logo_url ??
              undefined
            : undefined
        }
      >
        {/* Season / Division Scope / Edition Selectors */}
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
                      `/rank?type=player&season=${encodeURIComponent(
                        nextSeason.slug
                      )}`
                    );
                  } else {
                    router.replace("/rank?type=player");
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
                seasonId && !divisionScope ? "text-[#f0c020]" : "text-[#c7c5b8]"
              }`}
            >
              Player Pool
            </label>
            <div
              className={
                seasonId && !divisionScope ? "select-attention" : undefined
              }
            >
              <select
                value={divisionScope}
                disabled={!seasonId}
                onChange={(e) => {
                  const nextScope = e.target.value;
                  if (nextScope === divisionScope) return;
                  if (!confirmSwitchScope()) return;
                  setDivisionScope(nextScope);
                  if (nextScope && nextScope !== "all") {
                    setSelectedPreset("standard");
                  }
                  if (!nextScope) {
                    setEditionId("");
                  } else if (!editionId && seasonEditions.length > 0) {
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
                <option value="">Select a player pool...</option>
                <option value="all">
                  All Divisions
                </option>
                {seasonDivisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} Only
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] font-bold mb-1 ${
                seasonId && divisionScope && !editionId
                  ? "text-[#f0c020]"
                  : "text-[#c7c5b8]"
              }`}
            >
              Edition
            </label>
            <div
              className={
                seasonId && divisionScope && !editionId
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
                  const nextEd = seasonEditions.find((ed) => ed.id === nextEdId);
                  const isNextFirstEdition =
                    seasonEditions.length > 0 &&
                    nextEdId === seasonEditions[0].id;
                  setSelectedPreset(
                    nextEd?.is_players_only &&
                      !isSpecificDivision &&
                      isNextFirstEdition
                      ? "draft_day"
                      : "standard"
                  );
                  setSelectedSplitByRole(false);
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

        {/* Author + Notes + Reset (Row 1) and Tier Presets + Split Mode (Row 2) */}
        <div className="mb-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              ref={popoverContainerRef}
              className="flex flex-wrap items-center gap-2"
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
                  + Custom Author Name
                  {savedAuthorName ? ` (${savedAuthorName})` : ""}
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
                  {authorNotes.trim()
                    ? "General Notes (Added)"
                    : "+ Add General Notes"}
                </button>

                {showGeneralNotes && (
                  <div className="absolute left-0 top-full mt-1.5 z-30 w-[calc(100vw-2.5rem)] max-w-sm sm:w-96 bg-[#1a201e] border border-[#4a5650] rounded-md shadow-2xl p-3 space-y-2">
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
                        setAuthorNotes(
                          e.target.value.replace(/[\r\n]+/g, " ").slice(0, 125)
                        )
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

            {!isEditDisabled && seasonId && editionId && (
              <div className="flex flex-wrap items-center gap-2">
                {totalPlacedPlayers > 0 && (
                  <button
                    type="button"
                    onClick={handleResetPlacements}
                    className="xp-btn text-[11px] order-2 sm:order-1"
                    title="Move all placed players back to pool"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset All Players</span>
                  </button>
                )}

              </div>
            )}
          </div>

          {!isEditDisabled && seasonId && editionId && (
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
              <div className="xp-inset p-1 flex items-center gap-1">
                {TIER_PRESETS.map((preset) => {
                  const isPresetDisabled =
                    preset.key === "draft_day" && isDraftDayDisallowed;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      disabled={isPresetDisabled}
                      onClick={() => handleApplyPreset(preset.key)}
                      title={
                        isPresetDisabled
                          ? isSpecificDivision
                            ? "Draft Day Tiers are only available for All Divisions (pre-draft pool)"
                            : "Draft Day Tiers are only available for the first edition of a season"
                          : preset.description
                      }
                      className={`px-2 py-1 text-[11px] font-bold rounded-xs transition-colors ${
                        isPresetDisabled
                          ? "text-[#7a7d76] opacity-50 cursor-not-allowed"
                          : selectedPreset === preset.key
                          ? "bg-[#2a2210] border border-[#c89b3c] text-[#f0c020] cursor-pointer"
                          : "text-[#c7c5b8] hover:text-white cursor-pointer"
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>

              <div className="xp-inset p-1 flex items-center gap-1 sm:w-[156px]">
                <button
                  type="button"
                  onClick={() => handleToggleSplitMode(false)}
                  className={`flex-1 text-center px-2 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-colors whitespace-nowrap ${
                    !selectedSplitByRole
                      ? "bg-[#173b24] border border-[#3a804d] text-[#7cd438]"
                      : "text-[#c7c5b8] hover:text-white"
                  }`}
                >
                  Overall
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSplitMode(true)}
                  className={`flex-1 text-center px-2 py-1 text-[11px] font-bold rounded-xs cursor-pointer transition-colors whitespace-nowrap ${
                    selectedSplitByRole
                      ? "bg-[#173b24] border border-[#3a804d] text-[#7cd438]"
                      : "text-[#c7c5b8] hover:text-white"
                  }`}
                >
                  Split Roles
                </button>
              </div>
            </div>
          )}
        </div>

        {(isSeasonInactive || isEditionArchived || isEditionLocked) && (
          <div className="mb-4 p-2.5 bg-[#3d3012] border border-[#8c6b16] text-[#f7d560] text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {isSeasonInactive
                ? "This season is currently inactive. Tier lists cannot be created or edited."
                : isEditionArchived
                ? "This edition is archived. Drafts and tier lists can no longer be created or edited."
                : ballotStatus === "published"
                ? "This edition is locked and your tier list has already been published."
                : "This edition is locked — publishing is disabled."}
            </span>
          </div>
        )}

        {message?.type === "error" && (
          <div className="mb-4 p-2.5 text-xs border bg-[#451717] border-[#9e3535] text-[#ff857a] flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}

        {/* Action Bar */}
        <div className="mb-4 pb-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[28px]">
            {message?.type === "success" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-[#173b24] border border-[#3a804d] text-[#7cd438] rounded">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{message.text}</span>
              </span>
            ) : ballotStatus === "published" ? (
              <span className="text-xs font-bold text-[#7cd438]">
                ● Published ({totalPlacedPlayers} players tiered)
              </span>
            ) : ballotStatus === "draft" ? (
              <span className="text-xs text-[#a6a89e]">
                ● Draft saved ({totalPlacedPlayers} players tiered)
              </span>
            ) : (
              <span className="text-xs text-[#a6a89e]">
                {totalPlacedPlayers} of {availablePlayers.length} players tiered
                (partial tiers allowed)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {existingBallotId && ballotStatus === "published" && (
              <Link
                href={`/ballot/${existingBallotId}`}
                className="xp-btn text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Published Tier List</span>
              </Link>
            )}
            <button
              type="button"
              disabled={saving || isEditDisabled || totalPlacedPlayers === 0}
              onClick={() => {
                if (ballotStatus === "published") {
                  setUnpublishConfirmOpen(true);
                } else {
                  void savePlayerTierList("draft");
                }
              }}
              className="xp-btn text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? "Saving..."
                  : `Save Draft${hasTierWork ? "*" : ""}${
                      ballotStatus === "published" ? " (Unpublish)" : ""
                    }`}
              </span>
            </button>
            <button
              type="button"
              disabled={saving || isPublishDisabled || totalPlacedPlayers === 0}
              onClick={() => void savePlayerTierList("published")}
              className="xp-btn xp-btn-primary text-xs sm:w-[156px] justify-center"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? "Publishing..."
                  : `${
                      ballotStatus === "published"
                        ? "Update Tier List"
                        : "Publish Tier List"
                    }${hasTierWork ? "*" : ""}`}
              </span>
            </button>
          </div>
        </div>

        {loadingBallot ? (
          <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
            Loading players &amp; saved tiers...
          </div>
        ) : !seasonId || !divisionScope || !editionId ? (
          <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
            Select a season, player pool, and edition above to start building
            your Player Tier List.
          </div>
        ) : availablePlayers.length === 0 && totalPlacedPlayers === 0 ? (
          <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
            No players found for this season/division scope yet. An admin can
            add the season pool under Admin Console → Setup Players, or populate
            team rosters.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-6">
              {tierPayload.sections.map((section) => {
                const roleMeta =
                  section.role !== "all" ? getRoleMeta(section.role) : null;
                const poolPlayers = getPoolPlayersForSection(section.role);
                const totalForSec = getTotalAvailableForSection(section.role);

                return (
                  <div
                    key={section.role}
                    className="space-y-3 rounded-lg border border-white/10 bg-[#0d1016]/60 p-3"
                  >
                    {roleMeta && (
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <img
                            src={roleMeta.icon}
                            alt={roleMeta.label}
                            className="w-5 h-5 object-contain"
                          />
                          <h2 className="font-bold text-sm uppercase tracking-wide text-[#f0c020]">
                            {getRoleSectionTitle(section.role)}
                          </h2>
                        </div>
                        <span className="text-[11px] text-[#a6a89e] font-bold">
                          {totalForSec - poolPlayers.length} / {totalForSec}{" "}
                          tiered
                        </span>
                      </div>
                    )}

                    {/* Pool directly above this section's tiers */}
                    <DroppablePoolArea
                      sectionRole={section.role}
                      players={poolPlayers}
                      totalAvailable={totalForSec}
                      disabled={isEditDisabled}
                      showRoleFilter={section.role === "all"}
                      roleFilter={unifiedRoleFilter}
                      onRoleFilterChange={setUnifiedRoleFilter}
                      searchQuery={poolSearchBySection[section.role] ?? ""}
                      onSearchChange={(q) =>
                        setPoolSearchBySection((prev) => ({
                          ...prev,
                          [section.role]: q,
                        }))
                      }
                    />

                    {/* Tier Rows */}
                    <div className="space-y-2.5">
                      {section.tiers.map((tier, idx) => (
                        <DroppableTierRow
                          key={tier.id}
                          sectionRole={section.role}
                          tier={tier}
                          index={idx}
                          totalTiers={section.tiers.length}
                          disabled={isEditDisabled}
                          onLabelChange={(val) =>
                            updateSectionTier(section.role, tier.id, (t) => ({
                              ...t,
                              label: val,
                            }))
                          }
                          onColorChange={(val) =>
                            updateSectionTier(section.role, tier.id, (t) => ({
                              ...t,
                              color: val,
                            }))
                          }
                          onCommentaryChange={(val) =>
                            updateSectionTier(section.role, tier.id, (t) => ({
                              ...t,
                              commentary: val,
                            }))
                          }
                          onMoveTier={(dir) =>
                            handleMoveTierRow(section.role, idx, dir)
                          }
                          onInsertTier={(pos) =>
                            handleInsertTierRow(section.role, idx, pos)
                          }
                          onDeleteTier={() =>
                            handleDeleteTierRow(section.role, tier.id)
                          }
                          onRemovePlayer={(playerId) =>
                            handleRemovePlayerFromTier(
                              section.role,
                              tier.id,
                              playerId
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeDragPlayer ? (
                <PlayerTileVisual player={activeDragPlayer} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </RetroWindow>

      {overwriteConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            onClick={() => !saving && setOverwriteConfirm(null)}
          >
            <div
              className="w-full max-w-md xp-window overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="xp-titlebar px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f0c020]" />
                  <span>Overwrite Existing Tier List?</span>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOverwriteConfirm(null)}
                  className="text-white/80 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4 bg-[#1a1c23] text-xs text-[#d6d3c4]">
                <p className="leading-relaxed">
                  You already have a{" "}
                  <strong className="text-[#f0ede0]">
                    {overwriteConfirm.existingStatus}
                  </strong>{" "}
                  Player Tier List for this edition under{" "}
                  <strong className="text-[#f0c020]">
                    {formatVariantLabel(overwriteConfirm.existingVariant)}
                  </strong>
                  .
                </p>
                <p className="leading-relaxed text-[#ff9f96]">
                  {overwriteConfirm.targetStatus === "published"
                    ? "Publishing"
                    : "Saving a draft"}{" "}
                  with{" "}
                  <strong className="text-[#f0ede0]">
                    {formatVariantLabel(activeTierVariant)}
                  </strong>{" "}
                  will permanently overwrite that existing{" "}
                  {overwriteConfirm.existingStatus} tier list and cannot be
                  undone.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setOverwriteConfirm(null)}
                    className="xp-btn text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const nextTarget = overwriteConfirm.targetStatus;
                      setOverwriteConfirm(null);
                      void savePlayerTierList(nextTarget, true);
                    }}
                    className="xp-btn xp-btn-danger text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {overwriteConfirm.targetStatus === "published"
                        ? "Overwrite & Publish"
                        : "Overwrite & Save Draft"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      <RetroConfirmModal
        open={unpublishConfirmOpen}
        title="Unpublish & Save as Draft?"
        message="Saving as a draft will unpublish your currently published tier list from Browse and Consensus until you publish again. Continue?"
        confirmLabel="Save Draft (Unpublish)"
        danger
        loading={saving}
        onConfirm={() => {
          setUnpublishConfirmOpen(false);
          void savePlayerTierList("draft");
        }}
        onCancel={() => setUnpublishConfirmOpen(false)}
      />
    </div>
  );
}

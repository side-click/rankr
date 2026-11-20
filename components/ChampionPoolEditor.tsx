"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { toPng } from "html-to-image";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Dices,
  Download,
  Eye,
  EyeClosed,
  EyeOff,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type {
  ChampionPoolPayload,
  ChampionPoolTierItem,
  ChampionRoleSection,
  ChampionTierRowData,
  EncryptedChampionPoolRecord,
  TierPresetKey,
} from "@/types/database";
import type {
  ChampionCatalogItem,
  ChampionCatalogResponse,
} from "@/utils/championData";
import type { ChampionMatchupsResponse } from "@/utils/lolalyticsMatchups";
import {
  clearStoredPassphrase,
  decryptPoolPayload,
  encryptPoolPayload,
  getStoredPassphrase,
  storePassphrase,
} from "@/utils/cryptoPool";
import { getRoleMeta, LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import {
  DEFAULT_TIER_COLORS,
  TIER_PRESETS,
} from "@/utils/tierPresets";
import { RetroWindow } from "@/components/RetroWindow";

interface ChampionPoolEditorProps {
  userId: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  discordDefaultName?: string;
}

interface DragChampMeta {
  source: "pool" | string; // "pool" or tier.id
  champion: ChampionPoolTierItem;
}

function makeTierId(prefix = "ctier"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createRoleSection(
  role: LeagueRole,
  presetKey: Exclude<TierPresetKey, "custom"> = "standard"
): ChampionRoleSection {
  const def =
    TIER_PRESETS.find((p) => p.key === presetKey) ?? TIER_PRESETS[0];
  return {
    role,
    preset: presetKey,
    tiers: def.tiers.map((t) => ({
      id: makeTierId(),
      label: t.label,
      color: t.color,
      commentary: "",
      champions: [],
    })),
  };
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

function ChampionTileVisual({
  champion,
  iconUrl,
  showRemoveButton,
  onRemove,
  isOverlay,
}: {
  champion: ChampionPoolTierItem;
  iconUrl: string;
  showRemoveButton?: boolean;
  onRemove?: () => void;
  isOverlay?: boolean;
}) {
  return (
    <div
      className={`group relative flex flex-col items-center w-[66px] h-[84px] p-1.5 rounded border select-none transition-colors ${
        isOverlay
          ? "bg-[#222834] border-[#f0c020] text-white shadow-2xl scale-105 cursor-grabbing"
          : champion.isBlindable
          ? "bg-[#14221a] border-[#2f6343] text-[#f0ede0] hover:border-[#7cd438] cursor-grab"
          : "bg-[#1a1f29] border-white/15 text-[#f0ede0] hover:border-[#f0c020]/60 cursor-grab"
      }`}
    >
      {showRemoveButton && onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Remove ${champion.name}`}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#2a1414] border border-[#ff857a]/60 text-[#ff857a] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-[#5c1a1a] cursor-pointer z-10"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
      <img
        src={iconUrl}
        alt={champion.name}
        width={48}
        height={48}
        draggable={false}
        className="w-12 h-12 rounded border border-black/60 object-cover bg-[#0f131a]"
      />
      <span className="mt-1 text-[10px] font-bold leading-tight text-center line-clamp-2 w-full">
        {champion.name}
      </span>
    </div>
  );
}

function DraggablePlacedChampion({
  tierId,
  champion,
  iconUrl,
  onRemove,
  onHoverStart,
  onHoverEnd,
}: {
  tierId: string;
  champion: ChampionPoolTierItem;
  iconUrl: string;
  onRemove: () => void;
  onHoverStart?: (champion: ChampionPoolTierItem, rect: DOMRect) => void;
  onHoverEnd?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `placed:${tierId}:${champion.championId}`,
    data: {
      source: tierId,
      champion,
    } satisfies DragChampMeta,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `tile-drop:${tierId}:${champion.championId}`,
    data: {
      kind: "tile",
      tierId,
      championId: champion.championId,
      isBlindable: Boolean(champion.isBlindable),
    },
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      onMouseEnter={(e) => {
        if (!champion.isBlindable && onHoverStart) {
          onHoverStart(champion, e.currentTarget.getBoundingClientRect());
        }
      }}
      onMouseLeave={() => {
        if (onHoverEnd) onHoverEnd();
      }}
      className={`touch-none transition-all ${isDragging ? "opacity-30" : ""} ${
        isOver ? "ring-2 ring-[#f0c020] rounded-md" : ""
      }`}
    >
      <ChampionTileVisual
        champion={champion}
        iconUrl={iconUrl}
        showRemoveButton
        onRemove={onRemove}
      />
    </div>
  );
}

function DraggablePoolChampion({
  champion,
}: {
  champion: ChampionCatalogItem;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${champion.id}`,
    data: {
      source: "pool",
      champion: { championId: champion.id, name: champion.name },
    } satisfies DragChampMeta,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`touch-none ${isDragging ? "opacity-30" : ""}`}
    >
      <ChampionTileVisual
        champion={{ championId: champion.id, name: champion.name }}
        iconUrl={champion.iconUrl}
      />
    </div>
  );
}

function DroppableTierRow({
  tier,
  index,
  totalTiers,
  iconMap,
  onLabelChange,
  onColorChange,
  onCommentaryChange,
  onInsertTier,
  onMoveTier,
  onDeleteTier,
  onRemoveChampion,
  onHoverStart,
  onHoverEnd,
}: {
  tier: ChampionTierRowData;
  index: number;
  totalTiers: number;
  iconMap: Map<string, string>;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onCommentaryChange: (text: string) => void;
  onInsertTier: (pos: "above" | "below") => void;
  onMoveTier: (dir: -1 | 1) => void;
  onDeleteTier: () => void;
  onRemoveChampion: (championId: string) => void;
  onHoverStart: (champion: ChampionPoolTierItem, rect: DOMRect) => void;
  onHoverEnd: () => void;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const { setNodeRef: setBlindRef, isOver: isOverBlind } = useDroppable({
    id: `tier-blind:${tier.id}`,
    data: {
      kind: "tier",
      tierId: tier.id,
      isBlindable: true,
    },
  });

  const { setNodeRef: setGeneralRef, isOver: isOverGeneral } = useDroppable({
    id: `tier-general:${tier.id}`,
    data: {
      kind: "tier",
      tierId: tier.id,
      isBlindable: false,
    },
  });

  const contrastColor = getTierContrastText(tier.color);
  const blindableChamps = tier.champions.filter((c) => Boolean(c.isBlindable));
  const generalChamps = tier.champions.filter((c) => !c.isBlindable);

  return (
    <div className="rounded border border-white/15 bg-[#12151c] overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Tier Label & Controls (matches PlayerTierEditor) */}
        <div
          className="md:w-[152px] sm:w-36 shrink-0 p-2.5 flex flex-row sm:flex-col items-center justify-between gap-2 border-b sm:border-b-0 sm:border-r border-black/30"
          style={{ backgroundColor: tier.color, color: contrastColor }}
        >
          <div className="inline-grid items-center justify-items-center max-w-full">
            <span
              aria-hidden="true"
              className="col-start-1 row-start-1 invisible whitespace-pre-wrap break-words px-2 py-1 font-black text-sm leading-tight text-center min-w-[2ch] max-w-[132px]"
            >
              {(tier.label || "Tier...") + "\u200b"}
            </span>
            <textarea
              rows={1}
              cols={1}
              value={tier.label}
              onChange={(e) =>
                onLabelChange(e.target.value.replace(/\r?\n/g, " "))
              }
              maxLength={40}
              placeholder="Tier..."
              aria-label="Tier label"
              style={{ color: contrastColor }}
              className="col-start-1 row-start-1 w-full h-full min-w-0 resize-none overflow-hidden bg-black/15 hover:bg-black/25 focus:bg-black/30 rounded px-2 py-1 text-center font-black text-sm leading-tight focus:outline-none placeholder:text-white/50"
            />
          </div>

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
              onClick={() => onInsertTier("above")}
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
              onClick={onDeleteTier}
              className="w-6 h-6 flex items-center justify-center rounded bg-black/30 hover:bg-[#9e2626] text-white disabled:opacity-30 cursor-pointer"
              title="Delete tier"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            {/* Row 2 Col 2: Add tier below */}
            <button
              type="button"
              onClick={() => onInsertTier("below")}
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
        </div>

        {/* Droppable Blindable (Front) + General (Main) Zones */}
        <div className="flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row flex-1">
            {/* Isolated Blindable Section at Front of Tier */}
            <div
              ref={setBlindRef}
              className={`md:min-w-[168px] md:max-w-[320px] shrink-0 p-2 border-b md:border-b-0 md:border-r border-[#2f6343]/80 transition-colors flex flex-col ${
                isOverBlind
                  ? "bg-[#2f6343]/25 ring-1 ring-inset ring-[#7cd438]/50"
                  : "bg-[#0f1a14]/70"
              }`}
            >
              <div className="flex items-center gap-1 mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#9ec497]">
                <EyeClosed className="w-3 h-3" />
                <span>Blindable ({blindableChamps.length})</span>
              </div>
              <div className="flex flex-wrap gap-2 items-start min-h-[76px]">
                {blindableChamps.map((champ) => (
                  <DraggablePlacedChampion
                    key={champ.championId}
                    tierId={tier.id}
                    champion={champ}
                    iconUrl={iconMap.get(champ.championId) ?? ""}
                    onRemove={() => onRemoveChampion(champ.championId)}
                  />
                ))}
              </div>
            </div>

            {/* General Section */}
            <div
              ref={setGeneralRef}
              className={`flex-1 min-h-[96px] p-2 transition-colors flex flex-col ${
                isOverGeneral
                  ? "bg-[#f0c020]/10 ring-1 ring-inset ring-[#f0c020]/50"
                  : ""
              }`}
            >
              <div className="flex items-center gap-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e93a0]">
                <span>General ({generalChamps.length})</span>
              </div>
              <div className="flex flex-wrap gap-2 items-start min-h-[76px]">
                {generalChamps.map((champ) => (
                  <DraggablePlacedChampion
                    key={champ.championId}
                    tierId={tier.id}
                    champion={champ}
                    iconUrl={iconMap.get(champ.championId) ?? ""}
                    onRemove={() => onRemoveChampion(champ.championId)}
                    onHoverStart={onHoverStart}
                    onHoverEnd={onHoverEnd}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="px-2.5 pb-2 pt-1">
            <input
              type="text"
              value={tier.commentary}
              onChange={(e) => onCommentaryChange(e.target.value)}
              placeholder="Optional tier notes (e.g., comfort, situational, counterpicks)..."
              maxLength={180}
              className="w-full bg-black/25 border border-white/10 rounded px-2.5 py-1 text-[11px] text-[#d6d3c4] placeholder:text-[#666b75] focus:outline-none focus:border-[#f0c020]/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableUnplacedPool({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pool:unplaced",
    data: {
      kind: "pool",
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`xp-inset rounded p-3 transition-colors ${
        isOver ? "ring-1 ring-[#f0c020]/60 bg-[#191d26]" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function ChampionPoolEditor({
  userId,
  authorName,
  authorAvatarUrl,
  discordDefaultName = "",
}: ChampionPoolEditorProps) {
  const supabase = useMemo(() => createClient(), []);

  // Catalog state
  const [catalog, setCatalog] = useState<ChampionCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Encrypted record & lock state
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [existingRecord, setExistingRecord] =
    useState<EncryptedChampionPoolRecord | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [activePassphrase, setActivePassphrase] = useState("");

  // Unlock / Create passphrase form state
  const [passInput, setPassInput] = useState("");
  const [passConfirmInput, setPassConfirmInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberBrowser, setRememberBrowser] = useState(true);
  const [startingRole, setStartingRole] = useState<LeagueRole>("mid");
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Change passphrase modal state
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [newPassInput, setNewPassInput] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");

  // Pool editor state
  const [pool, setPool] = useState<ChampionPoolPayload>({
    version: 1,
    title: "",
    roles: {},
  });
  const [activeRole, setActiveRole] = useState<LeagueRole>("mid");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Custom Author & Custom Title popovers
  const [customAuthorInput, setCustomAuthorInput] = useState(
    authorName ?? discordDefaultName
  );
  const [savedAuthorName, setSavedAuthorName] = useState(
    authorName ?? discordDefaultName
  );
  const [showCustomAuthor, setShowCustomAuthor] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);

  // Picker filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllOffMeta, setShowAllOffMeta] = useState(false);

  // Drag state
  const [activeDragChamp, setActiveDragChamp] =
    useState<ChampionPoolTierItem | null>(null);
  const [mounted, setMounted] = useState(false);

  // PNG export state
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [showAuthorInExport, setShowAuthorInExport] = useState(true);

  // Matchup hover popover state (General section champions)
  const [hoveredChamp, setHoveredChamp] = useState<{
    champion: ChampionPoolTierItem;
    rect: { top: number; bottom: number; left: number; width: number };
  } | null>(null);
  const [matchupCache, setMatchupCache] = useState<
    Record<string, ChampionMatchupsResponse>
  >({});
  const [matchupLoadingKey, setMatchupLoadingKey] = useState<string | null>(null);
  const [matchupErrorKey, setMatchupErrorKey] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load champion catalog + existing encrypted record
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoadingRecord(true);
      try {
        const [catRes, dbRes] = await Promise.all([
          fetch("/api/champions").then(async (r) => {
            if (!r.ok) throw new Error(`Catalog error (${r.status})`);
            return (await r.json()) as ChampionCatalogResponse;
          }),
          supabase
            .from("champion_pools")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        setCatalog(catRes);

        if (dbRes.error) {
          setAuthError(dbRes.error.message);
        } else if (dbRes.data) {
          const rec = dbRes.data as EncryptedChampionPoolRecord;
          setExistingRecord(rec);

          // Try auto-unlock if passphrase is remembered in browser storage
          const stored = getStoredPassphrase(userId);
          if (stored.passphrase) {
            try {
              const decrypted = await decryptPoolPayload(
                rec,
                stored.passphrase
              );
              if (cancelled) return;
              setPool(decrypted);
              setActivePassphrase(stored.passphrase);
              setRememberBrowser(stored.remembered);
              const populatedRoles = LEAGUE_ROLES.map((r) => r.key).filter(
                (r) => {
                  const sec = decrypted.roles[r];
                  return (
                    sec &&
                    sec.tiers.some((t) => t.champions.length > 0)
                  );
                }
              );
              if (populatedRoles.length > 0) {
                setActiveRole(populatedRoles[0]);
              }
              setUnlocked(true);
            } catch {
              clearStoredPassphrase(userId);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCatalogError(
            err instanceof Error
              ? err.message
              : "Failed to load champion catalog."
          );
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const iconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catalog?.champions ?? []) {
      map.set(c.id, c.iconUrl);
    }
    return map;
  }, [catalog]);

  const activeSection: ChampionRoleSection = useMemo(() => {
    return pool.roles[activeRole] ?? createRoleSection(activeRole, "standard");
  }, [pool.roles, activeRole]);

  const placedIdsInActiveRole = useMemo(() => {
    const set = new Set<string>();
    for (const tier of activeSection.tiers) {
      for (const c of tier.champions) {
        set.add(c.championId);
      }
    }
    return set;
  }, [activeSection]);

  const unplacedChampions = useMemo(() => {
    const all = catalog?.champions ?? [];
    const q = searchQuery.trim().toLowerCase();

    const filtered = all.filter((c) => {
      if (placedIdsInActiveRole.has(c.id)) return false;
      if (!showAllOffMeta && !c.roles.includes(activeRole)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [
    catalog,
    placedIdsInActiveRole,
    showAllOffMeta,
    activeRole,
    searchQuery,
  ]);

  function updateActiveRoleTiers(
    updater: (tiers: ChampionTierRowData[]) => ChampionTierRowData[],
    nextPreset?: TierPresetKey
  ) {
    setPool((prev) => {
      const currentSection =
        prev.roles[activeRole] ?? createRoleSection(activeRole, "standard");
      return {
        ...prev,
        roles: {
          ...prev.roles,
          [activeRole]: {
            ...currentSection,
            preset: nextPreset ?? currentSection.preset,
            tiers: updater(currentSection.tiers),
          },
        },
      };
    });
    setDirty(true);
    setSaveMessage(null);
  }

  async function handleCreatePoolSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (passInput.length < 4) {
      setAuthError("Passphrase must be at least 4 characters.");
      return;
    }
    if (passInput !== passConfirmInput) {
      setAuthError("Passphrases do not match.");
      return;
    }

    const initialPayload: ChampionPoolPayload = {
      version: 1,
      title: "My Champion Pool",
      roles: {
        [startingRole]: createRoleSection(startingRole, "standard"),
      },
    };

    try {
      setSaving(true);
      const encrypted = await encryptPoolPayload(initialPayload, passInput);
      const { data, error } = await supabase
        .from("champion_pools")
        .upsert(
          {
            user_id: userId,
            ...encrypted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("*")
        .single();

      if (error) throw error;

      storePassphrase(userId, passInput, rememberBrowser);
      setExistingRecord(data as EncryptedChampionPoolRecord);
      setPool(initialPayload);
      setActiveRole(startingRole);
      setActivePassphrase(passInput);
      setPassInput("");
      setPassConfirmInput("");
      setDirty(false);
      setUnlocked(true);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Failed to create encrypted pool."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!existingRecord) return;
    setAuthError(null);

    try {
      const decrypted = await decryptPoolPayload(existingRecord, passInput);
      storePassphrase(userId, passInput, rememberBrowser);
      setPool(decrypted);
      setActivePassphrase(passInput);
      setPassInput("");
      const populatedRoles = LEAGUE_ROLES.map((r) => r.key).filter((r) => {
        const sec = decrypted.roles[r];
        return sec && sec.tiers.some((t) => t.champions.length > 0);
      });
      if (populatedRoles.length > 0) {
        setActiveRole(populatedRoles[0]);
      }
      setDirty(false);
      setUnlocked(true);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Incorrect passphrase."
      );
    }
  }

  async function handleResetEncryptedPool() {
    setAuthError(null);
    try {
      const { error } = await supabase
        .from("champion_pools")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
      clearStoredPassphrase(userId);
      setExistingRecord(null);
      setActivePassphrase("");
      setUnlocked(false);
      setConfirmResetOpen(false);
      setPool({ version: 1, title: "My Champion Pool", roles: {} });
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Failed to delete encrypted pool."
      );
    }
  }

  function handleLockPool() {
    clearStoredPassphrase(userId);
    setActivePassphrase("");
    setUnlocked(false);
    setPool({ version: 1, title: "My Champion Pool", roles: {} });
    setDirty(false);
  }

  async function savePoolWithPassphrase(passToUse: string) {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const resolvedAuthor =
        customAuthorInput.trim() || discordDefaultName || savedAuthorName;
      if (resolvedAuthor && resolvedAuthor !== savedAuthorName) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ username: resolvedAuthor })
          .eq("id", userId);
        if (profileErr) throw new Error(profileErr.message);
        setCustomAuthorInput(resolvedAuthor);
        setSavedAuthorName(resolvedAuthor);
      }

      const encrypted = await encryptPoolPayload(pool, passToUse);
      const { data, error } = await supabase
        .from("champion_pools")
        .upsert(
          {
            user_id: userId,
            ...encrypted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("*")
        .single();

      if (error) throw error;
      setExistingRecord(data as EncryptedChampionPoolRecord);
      setDirty(false);
      setSaveMessage("Encrypted & saved privately");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save champion pool."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassphrase(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (newPassInput.length < 4) {
      setSaveError("New passphrase must be at least 4 characters.");
      return;
    }
    if (newPassInput !== newPassConfirm) {
      setSaveError("New passphrases do not match.");
      return;
    }
    setActivePassphrase(newPassInput);
    storePassphrase(userId, newPassInput, rememberBrowser);
    await savePoolWithPassphrase(newPassInput);
    setNewPassInput("");
    setNewPassConfirm("");
    setChangePassOpen(false);
  }

  // DnD collision detection prioritizing specific champion tiles over tier containers
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args);
    const tileHit = pointerHits.find((h) =>
      String(h.id).startsWith("tile-drop:")
    );
    if (tileHit) return [tileHit];
    if (pointerHits.length > 0) return pointerHits;
    return closestCorners(args);
  }, []);

  const handleChampHoverStart = useCallback(
    (champion: ChampionPoolTierItem, rect: DOMRect) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      const cacheKey = `${champion.championId}:${activeRole}`;
      setHoveredChamp({
        champion,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        },
      });

      if (matchupCache[cacheKey]) return;

      hoverTimerRef.current = setTimeout(async () => {
        setMatchupLoadingKey(cacheKey);
        setMatchupErrorKey(null);
        try {
          const res = await fetch(
            `/api/champions/matchups?championId=${encodeURIComponent(
              champion.championId
            )}&role=${encodeURIComponent(activeRole)}`
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as ChampionMatchupsResponse;
          setMatchupCache((prev) => ({ ...prev, [cacheKey]: data }));
        } catch {
          setMatchupErrorKey(cacheKey);
        } finally {
          setMatchupLoadingKey((curr) => (curr === cacheKey ? null : curr));
        }
      }, 150);
    },
    [activeRole, matchupCache]
  );

  const handleChampHoverEnd = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredChamp(null);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    handleChampHoverEnd();
    const meta = event.active.data.current as DragChampMeta | undefined;
    if (meta?.champion) {
      setActiveDragChamp(meta.champion);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragChamp(null);
    const { active, over } = event;
    if (!over) return;

    const meta = active.data.current as DragChampMeta | undefined;
    const overData = over.data.current as
      | {
          kind: "tier" | "tile" | "pool";
          tierId?: string;
          championId?: string;
          isBlindable?: boolean;
        }
      | undefined;

    if (!meta?.champion || !overData) return;
    const dragged = meta.champion;

    if (overData.kind === "pool") {
      if (meta.source === "pool") return;
      updateActiveRoleTiers((tiers) =>
        tiers.map((t) => ({
          ...t,
          champions: t.champions.filter(
            (c) => c.championId !== dragged.championId
          ),
        }))
      );
      return;
    }

    const targetTierId = overData.tierId;
    if (!targetTierId) return;

    const nextBlindable =
      typeof overData.isBlindable === "boolean"
        ? overData.isBlindable
        : Boolean(dragged.isBlindable);

    const updatedDragged: ChampionPoolTierItem = {
      ...dragged,
      isBlindable: nextBlindable,
    };

    updateActiveRoleTiers((tiers) => {
      // Remove from source tier (if coming from a tier)
      const cleaned = tiers.map((t) => ({
        ...t,
        champions: t.champions.filter(
          (c) => c.championId !== dragged.championId
        ),
      }));

      return cleaned.map((t) => {
        if (t.id !== targetTierId) return t;
        const list = [...t.champions];
        if (overData.kind === "tile" && overData.championId) {
          const idx = list.findIndex(
            (c) => c.championId === overData.championId
          );
          if (idx >= 0) {
            list.splice(idx, 0, updatedDragged);
            return { ...t, champions: list };
          }
        }
        list.push(updatedDragged);
        return { ...t, champions: list };
      });
    });
  }

  function handleRandomizeRoleTest() {
    const roleChamps = (catalog?.champions ?? []).filter((c) =>
      c.roles.includes(activeRole)
    );
    if (roleChamps.length === 0) return;

    const shuffled = [...roleChamps].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, Math.min(14, shuffled.length));

    updateActiveRoleTiers((tiers) => {
      if (tiers.length === 0) return tiers;
      const buckets: ChampionPoolTierItem[][] = tiers.map(() => []);
      sample.forEach((c) => {
        const tierIdx = Math.floor(Math.random() * tiers.length);
        buckets[tierIdx].push({
          championId: c.id,
          name: c.name,
          isBlindable: Math.random() < 0.3,
        });
      });
      return tiers.map((t, idx) => ({
        ...t,
        champions: buckets[idx],
      }));
    });
  }

  async function handleExportRolePng() {
    if (!exportCardRef.current) return;
    setExportingPng(true);
    try {
      const dataUrl = await toPng(exportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0e1117",
      });
      const link = document.createElement("a");
      const safeTitle = effectiveTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      link.download = `${safeTitle}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to export PNG."
      );
    } finally {
      setExportingPng(false);
    }
  }

  const activeRoleMeta = getRoleMeta(activeRole);
  const roleLaneLabel =
    activeRole === "top"
      ? "Top Lane"
      : activeRole === "mid"
      ? "Mid Lane"
      : activeRole === "bot"
      ? "Bot Lane"
      : activeRoleMeta.label;
  const defaultRoleTitle = `${roleLaneLabel} Pool`;
  const customTitleValue =
    pool.title.trim() && pool.title.trim() !== "My Champion Pool"
      ? pool.title.trim()
      : "";
  const effectiveTitle = customTitleValue || defaultRoleTitle;
  const displayAuthorName =
    customAuthorInput.trim() || discordDefaultName || savedAuthorName;

  if (loadingRecord) {
    return (
      <RetroWindow title="Champion Pool Editor" theme="scdl">
        <div className="py-12 text-center text-xs text-[#a6a89e]">
          Loading encrypted champion pool...
        </div>
      </RetroWindow>
    );
  }

  if (catalogError) {
    return (
      <RetroWindow title="Champion Pool Editor" theme="scdl">
        <div className="p-6 text-center text-xs text-[#ff857a]">
          {catalogError}
        </div>
      </RetroWindow>
    );
  }

  if (!unlocked) {
    return (
      <RetroWindow title="Champion Pool Editor" theme="scdl">
        <div className="max-w-md mx-auto py-6 px-3 space-y-5">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#221d12] border border-[#f0c020]/50">
            <Lock className="w-5 h-5 text-[#f0c020] shrink-0 mt-0.5" />
            <div className="text-xs text-[#d6d3c4] space-y-1">
              <p className="font-bold text-[#f0c020]">
                Privacy Notice
              </p>
              <p className="text-[11px] leading-relaxed text-[#d6d3c4]">
                Your champion pools are stored locally (encrypted) in your
                browser. They are never published, and require your passphrase
                to unlock and view (no, the web admin can&apos;t see them
                either). Forgotten passphrases cannot be recovered.
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-2.5 rounded bg-[#2e1414] border border-[#ff857a]/40 text-xs text-[#ff857a]">
              {authError}
            </div>
          )}

          {existingRecord ? (
            <form onSubmit={handleUnlockSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#f0ede0] mb-1">
                  Enter Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Your champion pool passphrase..."
                    autoFocus
                    className="w-full bg-[#0f131a] border border-white/15 rounded px-3 py-2 pr-9 text-xs text-white focus:outline-none focus:border-[#f0c020]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2.5 top-2 text-[#a6a89e] hover:text-white cursor-pointer"
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#c7c9be] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberBrowser}
                  onChange={(e) => setRememberBrowser(e.target.checked)}
                  className="accent-[#f0c020]"
                />
                Remember passphrase on this browser
              </label>

              <button
                type="submit"
                className="w-full xp-btn xp-btn-primary py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                Unlock Champion Pool Editor
              </button>

              <div className="pt-3 border-t border-white/10 text-center">
                {!confirmResetOpen ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(true)}
                    className="text-[11px] text-[#a6a89e] hover:text-[#ff857a] underline cursor-pointer"
                  >
                    Forgot passphrase?
                  </button>
                ) : (
                  <div className="p-3 rounded bg-[#2a1414] border border-[#ff857a]/40 space-y-2">
                    <p className="text-[11px] text-[#ffcbc6]">
                      Resetting permanently deletes your saved pool.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetEncryptedPool}
                        className="px-3 py-1 rounded bg-[#8f2626] text-white text-xs font-bold cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetOpen(false)}
                        className="px-3 py-1 rounded bg-white/10 text-xs text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreatePoolSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#f0ede0] mb-1.5">
                  Select a Role (you can add more later)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {LEAGUE_ROLES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setStartingRole(r.key)}
                      className={`p-2 rounded border flex flex-col items-center gap-1 text-[11px] font-bold transition cursor-pointer ${
                        startingRole === r.key
                          ? "bg-[#221d12] border-[#f0c020] text-[#f0c020]"
                          : "bg-[#141820] border-white/10 text-[#a6a89e] hover:border-white/25"
                      }`}
                    >
                      <img src={r.icon} alt={r.label} className="w-5 h-5" />
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#f0ede0] mb-1">
                  Set Local Encryption Passphrase
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="At least 4 characters..."
                    className="w-full bg-[#0f131a] border border-white/15 rounded px-3 py-2 pr-9 text-xs text-white focus:outline-none focus:border-[#f0c020]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2.5 top-2 text-[#a6a89e] hover:text-white cursor-pointer"
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#f0ede0] mb-1">
                  Confirm Passphrase
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  value={passConfirmInput}
                  onChange={(e) => setPassConfirmInput(e.target.value)}
                  placeholder="Re-enter passphrase..."
                  className="w-full bg-[#0f131a] border border-white/15 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f0c020]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#c7c9be] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberBrowser}
                  onChange={(e) => setRememberBrowser(e.target.checked)}
                  className="accent-[#f0c020]"
                />
                Remember passphrase on this browser
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full xp-btn xp-btn-primary py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                {saving ? "Encrypting..." : "Unlock Champion Pool Editor"}
              </button>
            </form>
          )}
        </div>
      </RetroWindow>
    );
  }

  return (
    <RetroWindow title="Champion Pool Editor" theme="scdl">
      <div className="space-y-4">
        {/* Top Toolbar */}
        <div className="xp-inset rounded p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCustomAuthor((prev) => !prev);
                  setShowCustomTitle(false);
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
                      className="text-[#a6a89e] hover:text-white p-0.5 cursor-pointer"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customAuthorInput}
                    onChange={(e) => {
                      setCustomAuthorInput(e.target.value);
                      setDirty(true);
                      setSaveMessage(null);
                    }}
                    placeholder={
                      discordDefaultName
                        ? `Leave blank to reset to ${discordDefaultName}`
                        : "Enter author name..."
                    }
                    className="w-full xp-inset px-2.5 py-1.5 text-xs"
                  />
                  {discordDefaultName && (
                    <div className="text-[10px] text-[#a6a89e]">
                      Leave blank to reset to {discordDefaultName}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCustomTitle((prev) => !prev);
                  setShowCustomAuthor(false);
                }}
                className="xp-btn text-xs"
              >
                {customTitleValue
                  ? `Custom Title (${customTitleValue})`
                  : "+ Custom Title"}
              </button>

              {showCustomTitle && (
                <div className="absolute left-0 top-full mt-1.5 z-30 w-[calc(100vw-2.5rem)] max-w-sm sm:w-80 bg-[#1a201e] border border-[#4a5650] rounded-md shadow-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-[#c7c5b8]">
                      Custom Title
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCustomTitle(false)}
                      className="text-[#a6a89e] hover:text-white p-0.5 cursor-pointer"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customTitleValue}
                    onChange={(e) => {
                      setPool((prev) => ({ ...prev, title: e.target.value }));
                      setDirty(true);
                      setSaveMessage(null);
                    }}
                    maxLength={60}
                    placeholder={`Leave blank for "${defaultRoleTitle}"`}
                    className="w-full xp-inset px-2.5 py-1.5 text-xs"
                  />
                  <div className="text-[10px] text-[#a6a89e]">
                    Leave blank for default &quot;{defaultRoleTitle}&quot;
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => savePoolWithPassphrase(activePassphrase)}
              disabled={saving}
              className="xp-btn xp-btn-primary px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving
                ? "Encrypting..."
                : dirty
                ? "Save Changes*"
                : "Save Pool"}
            </button>

            <button
              type="button"
              onClick={handleExportRolePng}
              disabled={exportingPng}
              className="xp-btn xp-btn-gold text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingPng ? "Exporting..." : "Export PNG"}
            </button>

            {authorName && (
              <button
                type="button"
                onClick={() => setShowAuthorInExport((v) => !v)}
                title={
                  showAuthorInExport
                    ? "Hide Discord name on exported PNG"
                    : "Show Discord name on exported PNG"
                }
                className="xp-btn text-xs"
              >
                {showAuthorInExport ? (
                  <Eye className="w-3.5 h-3.5 text-[#f0c020]" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-[#a6a89e]" />
                )}
                <span>{showAuthorInExport ? "Name Shown" : "Name Hidden"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setChangePassOpen((v) => !v)}
              title="Change passphrase"
              className="xp-btn text-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleLockPool}
              title="Lock pool"
              className="xp-btn text-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock
            </button>
          </div>
        </div>

        {saveMessage && (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-[#11241a] border border-[#2f6343] text-xs text-[#7cd438]">
            <CheckCircle2 className="w-4 h-4" />
            {saveMessage}
          </div>
        )}

        {saveError && (
          <div className="px-3 py-2 rounded bg-[#2e1414] border border-[#ff857a]/40 text-xs text-[#ff857a]">
            {saveError}
          </div>
        )}

        {changePassOpen && (
          <form
            onSubmit={handleChangePassphrase}
            className="p-3 rounded-lg bg-[#161b24] border border-[#f0c020]/30 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-[11px] font-bold text-[#c7c9be] mb-1">
                New Passphrase
              </label>
              <input
                type="password"
                value={newPassInput}
                onChange={(e) => setNewPassInput(e.target.value)}
                className="bg-[#0f131a] border border-white/15 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#c7c9be] mb-1">
                Confirm New Passphrase
              </label>
              <input
                type="password"
                value={newPassConfirm}
                onChange={(e) => setNewPassConfirm(e.target.value)}
                className="bg-[#0f131a] border border-white/15 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              className="xp-btn xp-btn-primary px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              Update &amp; Re-encrypt
            </button>
            <button
              type="button"
              onClick={() => setChangePassOpen(false)}
              className="xp-btn text-xs"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Role Selector Tabs (one role at a time) */}
        <div className="grid grid-cols-5 gap-2">
          {LEAGUE_ROLES.map((r) => {
            const sec = pool.roles[r.key];
            const count = sec
              ? sec.tiers.reduce((sum, t) => sum + t.champions.length, 0)
              : 0;
            const isActive = activeRole === r.key;

            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setActiveRole(r.key)}
                className={`p-2 rounded-lg border-2 flex items-center justify-center sm:justify-between gap-2 transition cursor-pointer ${
                  isActive
                    ? "bg-[#221d12] border-[#f0c020] text-[#f0c020]"
                    : "bg-[#15181f] border-white/10 text-[#c7c9be] hover:border-white/25"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src={r.icon} alt={r.label} className="w-5 h-5" />
                  <span className="font-black text-xs hidden sm:inline">
                    {r.label}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    count > 0
                      ? "bg-[#1b3827] text-[#7cd438]"
                      : "bg-black/30 text-[#7c808b]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tier Actions for Active Role */}
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleRandomizeRoleTest}
            title="Randomly place champions from this role into tiers for testing"
            className="xp-btn text-xs"
          >
            <Dices className="w-3.5 h-3.5 text-[#f0c020]" />
            Randomize Test
          </button>
          <button
            type="button"
            onClick={() =>
              updateActiveRoleTiers(() =>
                createRoleSection(activeRole, "standard").tiers
              )
            }
            className="xp-btn xp-btn-danger text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear {activeRoleMeta.label}
          </button>
        </div>

        {/* Drag-and-Drop Tier Board + Unplaced Champion Picker */}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2.5">
            {activeSection.tiers.map((tier, idx) => (
              <DroppableTierRow
                key={tier.id}
                tier={tier}
                index={idx}
                totalTiers={activeSection.tiers.length}
                iconMap={iconMap}
                onLabelChange={(label) =>
                  updateActiveRoleTiers((tiers) =>
                    tiers.map((t) => (t.id === tier.id ? { ...t, label } : t))
                  )
                }
                onColorChange={(color) =>
                  updateActiveRoleTiers((tiers) =>
                    tiers.map((t) => (t.id === tier.id ? { ...t, color } : t))
                  )
                }
                onCommentaryChange={(commentary) =>
                  updateActiveRoleTiers((tiers) =>
                    tiers.map((t) =>
                      t.id === tier.id ? { ...t, commentary } : t
                    )
                  )
                }
                onInsertTier={(pos) =>
                  updateActiveRoleTiers((tiers) => {
                    const insertAt = pos === "above" ? idx : idx + 1;
                    const newTier: ChampionTierRowData = {
                      id: makeTierId(),
                      label: "New Tier",
                      color:
                        DEFAULT_TIER_COLORS[
                          tiers.length % DEFAULT_TIER_COLORS.length
                        ],
                      commentary: "",
                      champions: [],
                    };
                    const copy = [...tiers];
                    copy.splice(insertAt, 0, newTier);
                    return copy;
                  })
                }
                onMoveTier={(dir) =>
                  updateActiveRoleTiers((tiers) => {
                    const nextIdx = idx + dir;
                    if (nextIdx < 0 || nextIdx >= tiers.length) return tiers;
                    const copy = [...tiers];
                    const [moved] = copy.splice(idx, 1);
                    copy.splice(nextIdx, 0, moved);
                    return copy;
                  })
                }
                onDeleteTier={() =>
                  updateActiveRoleTiers((tiers) => {
                    if (tiers.length <= 1) return tiers;
                    return tiers.filter((t) => t.id !== tier.id);
                  })
                }
                onRemoveChampion={(championId) =>
                  updateActiveRoleTiers((tiers) =>
                    tiers.map((t) =>
                      t.id === tier.id
                        ? {
                            ...t,
                            champions: t.champions.filter(
                              (c) => c.championId !== championId
                            ),
                          }
                        : t
                    )
                  )
                }
                onHoverStart={handleChampHoverStart}
                onHoverEnd={handleChampHoverEnd}
              />
            ))}
          </div>

          {/* Unplaced Champion Pool */}
          <DroppableUnplacedPool>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <img
                  src={activeRoleMeta.icon}
                  alt={activeRoleMeta.label}
                  className="w-4 h-4"
                />
                <span className="text-xs font-black text-[#f0ede0]">
                  {activeRoleMeta.label} Champions ({unplacedChampions.length})
                </span>
                {catalog?.ratesPatch && (
                  <span className="text-[10px] text-[#7c808b]">
                    Role data: Patch {catalog.ratesPatch}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#7c808b] absolute left-2.5 top-1.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search champion..."
                    className="bg-[#0a0d12] border border-white/15 rounded pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-[#666b75] focus:outline-none focus:border-[#f0c020]"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-[#c7c9be] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllOffMeta}
                    onChange={(e) => setShowAllOffMeta(e.target.checked)}
                    className="accent-[#f0c020]"
                  />
                  Show all champions
                </label>
              </div>
            </div>

            <div className="max-h-[340px] overflow-y-auto pr-1 flex flex-wrap gap-2">
              {unplacedChampions.length === 0 ? (
                <div className="w-full py-6 text-center text-xs text-[#7c808b]">
                  No matching champions available.
                </div>
              ) : (
                unplacedChampions.map((champ) => (
                  <DraggablePoolChampion
                    key={champ.id}
                    champion={champ}
                  />
                ))
              )}
            </div>
          </DroppableUnplacedPool>

          {mounted &&
            createPortal(
              <DragOverlay>
                {activeDragChamp ? (
                  <ChampionTileVisual
                    champion={activeDragChamp}
                    iconUrl={iconMap.get(activeDragChamp.championId) ?? ""}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>,
              document.body
            )}

          {mounted &&
            hoveredChamp &&
            !activeDragChamp &&
            createPortal(
              (() => {
                const cacheKey = `${hoveredChamp.champion.championId}:${activeRole}`;
                const data = matchupCache[cacheKey];
                const isLoading = matchupLoadingKey === cacheKey;
                const isError = matchupErrorKey === cacheKey;

                const popoverWidth = 236;
                const left = Math.min(
                  Math.max(12, hoveredChamp.rect.left + hoveredChamp.rect.width / 2 - popoverWidth / 2),
                  typeof window !== "undefined" ? window.innerWidth - popoverWidth - 12 : 900
                );
                const showBelow = hoveredChamp.rect.top < 310;
                const top = showBelow
                  ? hoveredChamp.rect.bottom + 8
                  : hoveredChamp.rect.top - 8;

                return (
                  <div
                    style={{
                      position: "fixed",
                      left,
                      top,
                      width: popoverWidth,
                      transform: showBelow ? "none" : "translateY(-100%)",
                    }}
                    className="pointer-events-none z-50 rounded-lg border border-[#f0c020]/50 bg-[#0d1016]/95 backdrop-blur-md shadow-2xl p-3 text-xs text-[#f0ede0] space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={iconMap.get(hoveredChamp.champion.championId) ?? ""}
                          alt={hoveredChamp.champion.name}
                          className="w-6 h-6 rounded border border-white/20"
                        />
                        <span className="font-black text-[#f0c020]">
                          {hoveredChamp.champion.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#8e93a0]">
                        {activeRoleMeta.label} (Plat+)
                      </span>
                    </div>

                    {isLoading && !data ? (
                      <div className="py-3 text-center text-[11px] text-[#a6a89e]">
                        Loading Lolalytics matchups...
                      </div>
                    ) : isError && !data ? (
                      <div className="py-2 text-center text-[11px] text-[#ff857a]">
                        Could not load Lolalytics matchup data.
                      </div>
                    ) : data ? (
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#7cd438] mb-1">
                            Counters (&gt;51% WR)
                          </p>
                          {data.counters.length === 0 ? (
                            <p className="text-[11px] text-[#7c808b] italic">
                              No &gt;51% matchups found
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {data.counters.map((m) => (
                                <div
                                  key={m.championId}
                                  className="flex items-center justify-between text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <img
                                      src={m.iconUrl}
                                      alt={m.name}
                                      className="w-4 h-4 rounded shrink-0"
                                    />
                                    <span className="truncate font-semibold">
                                      {m.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-black text-[#7cd438]">
                                      {m.winRate.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] text-[#7c808b] w-10 text-right">
                                      {m.games.toLocaleString()}g
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-white/10">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#ff857a] mb-1">
                            Countered By (&lt;49% WR)
                          </p>
                          {data.counteredBy.length === 0 ? (
                            <p className="text-[11px] text-[#7c808b] italic">
                              No &lt;49% matchups found
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {data.counteredBy.map((m) => (
                                <div
                                  key={m.championId}
                                  className="flex items-center justify-between text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <img
                                      src={m.iconUrl}
                                      alt={m.name}
                                      className="w-4 h-4 rounded shrink-0"
                                    />
                                    <span className="truncate font-semibold">
                                      {m.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-black text-[#ff857a]">
                                      {m.winRate.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] text-[#7c808b] w-10 text-right">
                                      {m.games.toLocaleString()}g
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })(),
              document.body
            )}
        </DndContext>

        {/* Off-screen Single-Role PNG Export Card */}
        <div className="fixed -left-[9999px] top-0 pointer-events-none">
          <div
            ref={exportCardRef}
            className="w-[920px] p-6 bg-[#0e1117] text-[#f0ede0] border border-[#f0c020]/40 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={activeRoleMeta.icon}
                  alt={activeRoleMeta.label}
                  className="w-8 h-8"
                />
                <div>
                  <h2 className="text-xl font-black text-[#f0c020]">
                    {effectiveTitle}
                  </h2>
                  <p className="text-xs text-[#a6a89e] font-bold uppercase tracking-wider">
                    {roleLaneLabel}
                  </p>
                </div>
              </div>
              {showAuthorInExport && displayAuthorName && (
                <div className="flex items-center gap-3 bg-black/45 px-4 py-2 rounded-lg border border-white/20 shrink-0">
                  {authorAvatarUrl && (
                    <img
                      src={authorAvatarUrl}
                      alt={displayAuthorName}
                      crossOrigin="anonymous"
                      className="w-10 h-10 rounded-md object-cover border border-white/50"
                    />
                  )}
                  <div className="text-lg font-extrabold text-white tracking-wide">
                    {displayAuthorName}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {activeSection.tiers.map((tier) => {
                const contrast = getTierContrastText(tier.color);
                const blindChamps = tier.champions.filter((c) => c.isBlindable);
                const genChamps = tier.champions.filter((c) => !c.isBlindable);

                return (
                  <div
                    key={tier.id}
                    className="flex rounded-lg border border-white/10 bg-[#141820] overflow-hidden"
                  >
                    <div
                      className="w-28 shrink-0 p-3 flex items-center justify-center text-center font-black text-sm"
                      style={{ backgroundColor: tier.color, color: contrast }}
                    >
                      {tier.label}
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex-1 flex items-stretch">
                        {blindChamps.length > 0 && (
                          <div className="p-2.5 bg-[#0f1a14] border-r border-[#2f6343]/80 flex flex-col gap-1.5 shrink-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-[#9ec497]">
                              Blindable
                            </span>
                            <div className="flex flex-wrap gap-2 items-center">
                              {blindChamps.map((c) => (
                                <div
                                  key={c.championId}
                                  className="flex flex-col items-center w-[64px] h-[80px] p-1 rounded bg-[#14221a] border border-[#2f6343]"
                                >
                                  <img
                                    src={iconMap.get(c.championId) ?? ""}
                                    alt={c.name}
                                    width={44}
                                    height={44}
                                    crossOrigin="anonymous"
                                    className="w-11 h-11 rounded object-cover"
                                  />
                                  <span className="mt-1 text-[10px] font-bold text-center leading-tight line-clamp-2">
                                    {c.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 p-2.5 flex flex-wrap gap-2 items-center">
                          {tier.champions.length === 0 ? (
                            <span className="text-xs text-[#5d626d] italic">
                              Empty
                            </span>
                          ) : genChamps.length === 0 ? null : (
                            genChamps.map((c) => (
                              <div
                                key={c.championId}
                                className="flex flex-col items-center w-[64px] h-[80px] p-1 rounded bg-[#1b202b] border border-white/10"
                              >
                                <img
                                  src={iconMap.get(c.championId) ?? ""}
                                  alt={c.name}
                                  width={44}
                                  height={44}
                                  crossOrigin="anonymous"
                                  className="w-11 h-11 rounded object-cover"
                                />
                                <span className="mt-1 text-[10px] font-bold text-center leading-tight line-clamp-2">
                                  {c.name}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      {tier.commentary.trim() && (
                        <div className="px-3 py-1.5 border-t border-white/10 bg-black/20 text-[11px] text-[#d6d3c4]">
                          {tier.commentary.trim()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </RetroWindow>
  );
}

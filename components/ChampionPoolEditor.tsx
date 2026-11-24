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
import { exportElementToPng } from "@/utils/exportImage";
import {
  ArrowDown,
  ArrowUp,
  Check,
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
  Settings,
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
import { getTierContrastText } from "@/utils/formatters";
import {
  DEFAULT_TIER_COLORS,
  TIER_PRESETS,
} from "@/utils/tierPresets";
import { RetroWindow } from "@/components/RetroWindow";
import { RetroConfirmModal } from "@/components/RetroConfirmModal";
import { useUnsavedChangesGuard } from "@/utils/useUnsavedChangesGuard";

interface ChampionPoolEditorProps {
  userId: string | null;
  authorName?: string;
  authorAvatarUrl?: string | null;
  discordDefaultName?: string;
  onUnsavedChange?: (dirty: boolean) => void;
}

const ANON_POOL_STORAGE_KEY = "rankr_anon_champ_pool_v1";

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

function ChampionTileVisual({
  champion,
  iconUrl,
  showRemoveButton,
  onRemove,
  isOverlay,
  iconsOnly,
}: {
  champion: ChampionPoolTierItem;
  iconUrl: string;
  showRemoveButton?: boolean;
  onRemove?: () => void;
  isOverlay?: boolean;
  iconsOnly?: boolean;
}) {
  const nameSizeClass =
    champion.name.length > 13
      ? "text-[8px] tracking-tighter"
      : champion.name.length > 11
      ? "text-[9px]"
      : "text-[10px]";

  return (
    <div
      className={`group relative flex flex-col items-center w-[76px] h-[78px] ${
        iconsOnly ? "p-0" : "p-1.5"
      } rounded border select-none transition-colors ${
        champion.isBlindable
          ? "bg-[#14221a] border-[#2f6343] text-[#f0ede0] hover:border-[#7cd438]"
          : "bg-[#1a1f29] border-white/15 text-[#f0ede0] hover:border-[#f0c020]/60"
      } ${isOverlay ? "shadow-2xl cursor-grabbing" : "cursor-grab"}`}
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
        width={iconsOnly ? 76 : 48}
        height={iconsOnly ? 78 : 48}
        draggable={false}
        className={
          iconsOnly
            ? "w-full h-full rounded-[3px] object-cover bg-[#0f131a]"
            : "w-12 h-12 rounded border border-black/60 object-cover bg-[#0f131a]"
        }
      />
      {!iconsOnly && (
        <span
          className={`mt-1 ${nameSizeClass} font-bold leading-tight text-center whitespace-nowrap truncate w-full`}
        >
          {champion.name}
        </span>
      )}
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
  iconsOnly,
}: {
  tierId: string;
  champion: ChampionPoolTierItem;
  iconUrl: string;
  onRemove: () => void;
  onHoverStart?: (champion: ChampionPoolTierItem, rect: DOMRect) => void;
  onHoverEnd?: () => void;
  iconsOnly?: boolean;
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
        if (onHoverStart) {
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
        iconsOnly={iconsOnly}
      />
    </div>
  );
}

function GapDropSlot({
  tierId,
  isBlindable,
  insertIndex,
  isHighlighted,
}: {
  tierId: string;
  isBlindable: boolean;
  insertIndex: number;
  isHighlighted?: boolean;
}) {
  const gapId = `gap-drop:${tierId}:${isBlindable ? "blind" : "gen"}:${insertIndex}`;
  const { setNodeRef, isOver } = useDroppable({
    id: gapId,
    data: {
      kind: "gap",
      tierId,
      isBlindable,
      insertIndex,
    },
  });

  const active = isOver || Boolean(isHighlighted);

  return (
    <div
      ref={setNodeRef}
      className="relative z-20 w-3 h-[78px] -mx-1 flex items-center justify-center shrink-0 pointer-events-auto"
    >
      <div
        className={`h-[84px] rounded-full transition-all ${
          active ? "w-1.5 bg-[#f0c020] shadow-[0_0_12px_#f0c020]" : "w-0"
        }`}
      />
    </div>
  );
}

function DraggablePoolChampion({
  champion,
  iconsOnly,
}: {
  champion: ChampionCatalogItem;
  iconsOnly?: boolean;
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
        iconsOnly={iconsOnly}
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
  activeGapId,
  iconsOnly,
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
  activeGapId: string | null;
  iconsOnly?: boolean;
}) {
  const [showControls, setShowControls] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showControls) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        headerRef.current &&
        !headerRef.current.contains(e.target as Node)
      ) {
        setShowControls(false);
        setShowColorPicker(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showControls]);

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
  const labelLen = (tier.label || "").trim().length;
  const labelSizeClass = !showControls
    ? labelLen <= 4
      ? "text-4xl"
      : labelLen <= 18
      ? "text-2xl"
      : "text-base"
    : labelLen <= 4
    ? "text-2xl"
    : labelLen <= 18
    ? "text-lg"
    : "text-sm";
  const blindableChamps = tier.champions.filter((c) => Boolean(c.isBlindable));
  const generalChamps = tier.champions.filter((c) => !c.isBlindable);

  return (
    <div className="rounded border border-white/15 bg-[#12151c]">
      <div className="flex flex-col sm:flex-row">
        {/* Tier Label & Controls (matches PlayerTierEditor) */}
        <div
          ref={headerRef}
          className={`relative md:w-[152px] sm:w-36 shrink-0 p-2.5 pl-7 sm:pl-2.5 flex flex-row sm:flex-col items-center ${
            showControls ? "justify-between" : "justify-center"
          } gap-2 border-b sm:border-b-0 sm:border-r border-black/30 rounded-t sm:rounded-tr-none sm:rounded-l`}
          style={{ backgroundColor: tier.color, color: contrastColor }}
        >
          <div className="flex-1 flex items-center justify-center w-full min-w-0">
            <div className="inline-grid items-center justify-items-center max-w-full">
              <span
                aria-hidden="true"
                className={`col-start-1 row-start-1 invisible whitespace-pre-wrap break-words px-2 py-1 font-black ${labelSizeClass} leading-tight text-center min-w-[2ch] max-w-[132px]`}
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
                className={`col-start-1 row-start-1 w-full h-full min-w-0 resize-none overflow-hidden bg-transparent focus:bg-black/30 focus:ring-1 focus:ring-white/30 rounded px-2 py-1 text-center font-black ${labelSizeClass} leading-tight focus:outline-none placeholder:text-white/50 transition-colors`}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowControls((prev) => {
                if (prev) setShowColorPicker(false);
                return !prev;
              });
            }}
            title={showControls ? "Hide tier controls" : "Tier settings"}
            aria-label={showControls ? "Hide tier controls" : "Show tier controls"}
            aria-expanded={showControls}
            style={{ color: contrastColor }}
            className={`absolute bottom-1.5 left-1.5 z-10 w-5 h-5 flex items-center justify-center rounded transition-opacity cursor-pointer ${
              showControls
                ? "opacity-90 bg-black/25"
                : "opacity-40 hover:opacity-90"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {showControls && (
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
          )}
        </div>

        {/* Droppable Blindable (Front) + General (Main) Zones */}
        <div className="flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row flex-1">
            {/* Isolated Blindable Section at Front of Tier */}
            <div
              ref={setBlindRef}
              className={`md:min-w-[168px] shrink-0 p-2 border-b md:border-b-0 md:border-r-2 border-[#3f8559] transition-colors flex flex-col ${
                isOverBlind
                  ? "bg-[#2f6343]/25 ring-1 ring-inset ring-[#7cd438]/50"
                  : "bg-[#0f1a14]/70"
              }`}
            >
              <div className="flex items-center gap-1 mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#9ec497]">
                <EyeClosed className="w-3 h-3" />
                <span>Blindable ({blindableChamps.length})</span>
              </div>
              <div
                className="grid gap-y-2 gap-x-0.5 items-start min-h-[80px] w-fit"
                style={
                  blindableChamps.length > 0
                    ? {
                        gridTemplateColumns: `repeat(${Math.min(
                          blindableChamps.length,
                          4
                        )}, max-content)`,
                      }
                    : undefined
                }
              >
                {blindableChamps.map((champ, cIdx) => (
                  <div key={champ.championId} className="flex items-center">
                    <GapDropSlot
                      tierId={tier.id}
                      isBlindable={true}
                      insertIndex={cIdx}
                    />
                    <DraggablePlacedChampion
                      tierId={tier.id}
                      champion={champ}
                      iconUrl={iconMap.get(champ.championId) ?? ""}
                      onRemove={() => onRemoveChampion(champ.championId)}
                      onHoverStart={onHoverStart}
                      onHoverEnd={onHoverEnd}
                      iconsOnly={iconsOnly}
                    />
                  </div>
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
              <div className="h-[14px] mb-1.5" aria-hidden="true" />
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-y-2 gap-x-0.5 items-start min-h-[80px] w-fit">
                {generalChamps.map((champ, cIdx) => (
                  <div key={champ.championId} className="flex items-center">
                    <GapDropSlot
                      tierId={tier.id}
                      isBlindable={false}
                      insertIndex={cIdx}
                      isHighlighted={
                        activeGapId === `gap-drop:${tier.id}:gen:${cIdx}`
                      }
                    />
                    <DraggablePlacedChampion
                      tierId={tier.id}
                      champion={champ}
                      iconUrl={iconMap.get(champ.championId) ?? ""}
                      onRemove={() => onRemoveChampion(champ.championId)}
                      onHoverStart={onHoverStart}
                      onHoverEnd={onHoverEnd}
                      iconsOnly={iconsOnly}
                    />
                    {cIdx === generalChamps.length - 1 && (
                      <GapDropSlot
                        tierId={tier.id}
                        isBlindable={false}
                        insertIndex={generalChamps.length}
                        isHighlighted={
                          activeGapId ===
                          `gap-drop:${tier.id}:gen:${generalChamps.length}`
                        }
                      />
                    )}
                  </div>
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
  onUnsavedChange,
}: ChampionPoolEditorProps) {
  const supabase = useMemo(() => createClient(), []);
  const storageUserKey = userId ?? "anon";

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
  const [stayUnlocked, setStayUnlocked] = useState(false);
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
  const [savedRolesJson, setSavedRolesJson] = useState<
    Partial<Record<LeagueRole, string>>
  >({});
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
  const [showGeneralNotes, setShowGeneralNotes] = useState(false);

  // Picker filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllOffMeta, setShowAllOffMeta] = useState(false);

  // Drag state
  const [activeDragChamp, setActiveDragChamp] =
    useState<ChampionPoolTierItem | null>(null);
  const [activeGapId, setActiveGapId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // PNG export state
  const exportCardRef = useRef<HTMLDivElement | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const [showAuthorInExport, setShowAuthorInExport] = useState(true);
  const [hideNames, setHideNames] = useState(true);

  // Retro confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

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

  useUnsavedChangesGuard(dirty && unlocked);

  useEffect(() => {
    onUnsavedChange?.(dirty && unlocked);
  }, [dirty, unlocked, onUnsavedChange]);

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
          userId
            ? supabase
                .from("champion_pools")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({
                data: (() => {
                  try {
                    const raw = window.localStorage.getItem(ANON_POOL_STORAGE_KEY);
                    return raw ? (JSON.parse(raw) as EncryptedChampionPoolRecord) : null;
                  } catch {
                    return null;
                  }
                })(),
                error: null,
              }),
        ]);

        if (cancelled) return;
        setCatalog(catRes);

        if (dbRes.error) {
          setAuthError(dbRes.error.message);
        } else if (dbRes.data) {
          const rec = dbRes.data as EncryptedChampionPoolRecord;
          setExistingRecord(rec);

          const stored = getStoredPassphrase(storageUserKey);
          if (stored.passphrase && stored.remembered) {
            try {
              const decrypted = await decryptPoolPayload(
                rec,
                stored.passphrase
              );
              if (cancelled) return;
              setPool(decrypted);
              setSavedRolesJson(
                Object.fromEntries(
                  LEAGUE_ROLES.map((r) => [
                    r.key,
                    JSON.stringify(decrypted.roles[r.key] ?? null),
                  ])
                )
              );
              setActivePassphrase(stored.passphrase);
              setStayUnlocked(true);
              const populatedRoles = LEAGUE_ROLES.map((r) => r.key).filter(
                (r) => {
                  const sec = decrypted.roles[r];
                  return sec && sec.tiers.some((t) => t.champions.length > 0);
                }
              );
              if (populatedRoles.length > 0) {
                setActiveRole(populatedRoles[0]);
              }
              setUnlocked(true);
            } catch {
              clearStoredPassphrase(storageUserKey);
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
  }, [supabase, userId, storageUserKey]);

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
      const nowIso = new Date().toISOString();
      let savedRec: EncryptedChampionPoolRecord;

      if (userId) {
        const { data, error } = await supabase
          .from("champion_pools")
          .upsert(
            {
              user_id: userId,
              ...encrypted,
              updated_at: nowIso,
            },
            { onConflict: "user_id" }
          )
          .select("*")
          .single();

        if (error) throw error;
        savedRec = data as EncryptedChampionPoolRecord;
      } else {
        savedRec = {
          id: "anon",
          user_id: "anon",
          ...encrypted,
          created_at: nowIso,
          updated_at: nowIso,
        };
        window.localStorage.setItem(
          ANON_POOL_STORAGE_KEY,
          JSON.stringify(savedRec)
        );
      }

      if (stayUnlocked) {
        storePassphrase(storageUserKey, passInput, true);
      } else {
        clearStoredPassphrase(storageUserKey);
      }
      setExistingRecord(savedRec);
      setPool(initialPayload);
      setSavedRolesJson(
        Object.fromEntries(
          LEAGUE_ROLES.map((r) => [
            r.key,
            JSON.stringify(initialPayload.roles[r.key] ?? null),
          ])
        )
      );
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
      if (stayUnlocked) {
        storePassphrase(storageUserKey, passInput, true);
      } else {
        clearStoredPassphrase(storageUserKey);
      }
      setPool(decrypted);
      setSavedRolesJson(
        Object.fromEntries(
          LEAGUE_ROLES.map((r) => [
            r.key,
            JSON.stringify(decrypted.roles[r.key] ?? null),
          ])
        )
      );
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
      if (userId) {
        const { error } = await supabase
          .from("champion_pools")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        window.localStorage.removeItem(ANON_POOL_STORAGE_KEY);
      }
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

  function performLockPool() {
    clearStoredPassphrase(storageUserKey);
    setActivePassphrase("");
    setUnlocked(false);
    setStayUnlocked(false);
    setPool({ version: 1, title: "", roles: {} });
    setDirty(false);
  }

  function handleLockPool() {
    if (dirty) {
      setConfirmModal({
        title: "Unsaved Changes",
        message:
          "You have unsaved changes. Lock anyway and discard unsaved edits?",
        confirmLabel: "Lock & Discard",
        danger: true,
        onConfirm: () => {
          setConfirmModal(null);
          performLockPool();
        },
      });
      return;
    }
    performLockPool();
  }

  async function savePoolWithPassphrase(passToUse: string) {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const resolvedAuthor =
        customAuthorInput.trim() || discordDefaultName || savedAuthorName;
      if (userId && resolvedAuthor && resolvedAuthor !== savedAuthorName) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ username: resolvedAuthor })
          .eq("id", userId);
        if (profileErr) throw new Error(profileErr.message);
        setCustomAuthorInput(resolvedAuthor);
        setSavedAuthorName(resolvedAuthor);
      }

      const encrypted = await encryptPoolPayload(pool, passToUse);
      const nowIso = new Date().toISOString();
      let savedRec: EncryptedChampionPoolRecord;

      if (userId) {
        const { data, error } = await supabase
          .from("champion_pools")
          .upsert(
            {
              user_id: userId,
              ...encrypted,
              updated_at: nowIso,
            },
            { onConflict: "user_id" }
          )
          .select("*")
          .single();

        if (error) throw error;
        savedRec = data as EncryptedChampionPoolRecord;
      } else {
        savedRec = {
          id: "anon",
          user_id: "anon",
          ...encrypted,
          created_at: existingRecord?.created_at ?? nowIso,
          updated_at: nowIso,
        };
        window.localStorage.setItem(
          ANON_POOL_STORAGE_KEY,
          JSON.stringify(savedRec)
        );
      }
      if (stayUnlocked) {
        storePassphrase(storageUserKey, passInput, true);
      } else {
        clearStoredPassphrase(storageUserKey);
      }
      setExistingRecord(savedRec);
      setSavedRolesJson(
        Object.fromEntries(
          LEAGUE_ROLES.map((r) => [
            r.key,
            JSON.stringify(pool.roles[r.key] ?? null),
          ])
        )
      );
      setDirty(false);
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      setSaveMessage(`All pools saved at ${timeStr}`);
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
    await savePoolWithPassphrase(newPassInput);
    setNewPassInput("");
    setNewPassConfirm("");
    setChangePassOpen(false);
  }

  // DnD collision detection: resolve both gaps and left/right tile halves to gap-drop targets
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const pointerHits = pointerWithin(args);
      const gapHit = pointerHits.find((h) =>
        String(h.id).startsWith("gap-drop:")
      );
      if (gapHit) return [gapHit];

      const tileHit = pointerHits.find((h) =>
        String(h.id).startsWith("tile-drop:")
      );
      if (tileHit && args.pointerCoordinates) {
        const container = args.droppableContainers.find(
          (c) => c.id === tileHit.id
        );
        const rect = container?.rect.current;
        const data = container?.data.current as
          | { tierId?: string; championId?: string; isBlindable?: boolean }
          | undefined;
        if (rect && data?.tierId && data?.championId) {
          const sec = pool.roles[activeRole];
          const tier = sec?.tiers.find((t) => t.id === data.tierId);
          const subList = tier
            ? tier.champions.filter(
                (c) => Boolean(c.isBlindable) === Boolean(data.isBlindable)
              )
            : [];
          const tileIdx = subList.findIndex(
            (c) => c.championId === data.championId
          );
          if (tileIdx >= 0) {
            const isRightHalf =
              args.pointerCoordinates.x >= rect.left + rect.width / 2;
            const targetInsertIdx = isRightHalf ? tileIdx + 1 : tileIdx;
            const targetGapId = `gap-drop:${data.tierId}:${
              data.isBlindable ? "blind" : "gen"
            }:${targetInsertIdx}`;
            const gapContainer = args.droppableContainers.find(
              (c) => c.id === targetGapId
            );
            if (gapContainer) {
              return [{ id: gapContainer.id, data: { droppableContainer: gapContainer } }];
            }
          }
        }
        return [tileHit];
      }

      if (pointerHits.length > 0) return pointerHits;
      return closestCorners(args);
    },
    [pool.roles, activeRole]
  );

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

  useEffect(() => {
    if (!hoveredChamp) return;
    const clear = () => handleChampHoverEnd();
    window.addEventListener("scroll", clear, true);
    window.addEventListener("pointerdown", clear, true);
    return () => {
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("pointerdown", clear, true);
    };
  }, [hoveredChamp, handleChampHoverEnd]);

  function handleDragStart(event: DragStartEvent) {
    handleChampHoverEnd();
    const meta = event.active.data.current as DragChampMeta | undefined;
    if (meta?.champion) {
      setActiveDragChamp(meta.champion);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragChamp(null);
    setActiveGapId(null);
    const { active, over } = event;
    if (!over) return;

    const meta = active.data.current as DragChampMeta | undefined;
    const overData = over.data.current as
      | {
          kind: "tier" | "tile" | "gap" | "pool";
          tierId?: string;
          championId?: string;
          isBlindable?: boolean;
          insertIndex?: number;
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
      const sourceTier = tiers.find((t) => t.id === meta.source);
      const sourceSubList = sourceTier
        ? sourceTier.champions.filter(
            (c) => Boolean(c.isBlindable) === Boolean(dragged.isBlindable)
          )
        : [];
      const sourceSubIdx = sourceSubList.findIndex(
        (c) => c.championId === dragged.championId
      );
      const sameSubSection =
        meta.source === targetTierId &&
        Boolean(dragged.isBlindable) === nextBlindable;

      // Remove from source tier
      const cleaned = tiers.map((t) => ({
        ...t,
        champions: t.champions.filter(
          (c) => c.championId !== dragged.championId
        ),
      }));

      return cleaned.map((t) => {
        if (t.id !== targetTierId) return t;
        const blindList = t.champions.filter((c) => Boolean(c.isBlindable));
        const genList = t.champions.filter((c) => !c.isBlindable);
        const targetList = nextBlindable ? blindList : genList;

        if (overData.kind === "gap" && typeof overData.insertIndex === "number") {
          let insertAt = overData.insertIndex;
          if (sameSubSection && sourceSubIdx >= 0 && sourceSubIdx < insertAt) {
            insertAt = Math.max(0, insertAt - 1);
          }
          targetList.splice(insertAt, 0, updatedDragged);
        } else if (overData.kind === "tile" && overData.championId) {
          const idx = targetList.findIndex(
            (c) => c.championId === overData.championId
          );
          if (idx >= 0) {
            const origTargetIdx =
              sameSubSection && sourceSubIdx >= 0 && idx >= sourceSubIdx
                ? idx + 1
                : idx;
            targetList.splice(origTargetIdx, 0, updatedDragged);
          } else {
            targetList.push(updatedDragged);
          }
        } else {
          targetList.push(updatedDragged);
        }

        return {
          ...t,
          champions: [...blindList, ...genList],
        };
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
      const dataUrl = await exportElementToPng(exportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
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
    customAuthorInput.trim() ||
    discordDefaultName ||
    savedAuthorName ||
    authorName ||
    "Anonymous";

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
                      Resetting permanently deletes your saved pools.
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
        {/* Row 1: Name Shown + Custom Author + Custom Title (left) | Change Passphrase + Lock (top-right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAuthorInExport((v) => !v);
                setShowCustomAuthor(false);
              }}
              title={
                showAuthorInExport
                  ? "Hide author name on exported PNG"
                  : "Show author name on exported PNG"
              }
              className="xp-btn text-xs"
            >
              {showAuthorInExport ? (
                <EyeOff className="w-3.5 h-3.5 text-[#a6a89e]" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-[#f0c020]" />
              )}
              <span>
                {showAuthorInExport ? "Hide Author Name" : "Show Author Name"}
              </span>
            </button>

            {showAuthorInExport && (
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
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCustomTitle((prev) => !prev);
                  setShowCustomAuthor(false);
                  setShowGeneralNotes(false);
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

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowGeneralNotes((prev) => !prev);
                  setShowCustomAuthor(false);
                  setShowCustomTitle(false);
                }}
                className="xp-btn text-xs"
              >
                {(pool.generalNotes ?? "").trim()
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
                      className="text-[#a6a89e] hover:text-white p-0.5 cursor-pointer"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={pool.generalNotes ?? ""}
                    onChange={(e) => {
                      setPool((prev) => ({
                        ...prev,
                        generalNotes: e.target.value,
                      }));
                      setDirty(true);
                      setSaveMessage(null);
                    }}
                    maxLength={125}
                    placeholder="Short general note for this champion pool..."
                    className="w-full xp-inset px-2.5 py-1.5 text-xs resize-none"
                  />
                  <div className="text-[10px] text-[#a6a89e] text-right">
                    {(pool.generalNotes ?? "").length}/125
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChangePassOpen((v) => !v)}
              title="Change passphrase"
              className="xp-btn text-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

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

        {/* Row 2: Role Selector (compact, right-justified) */}
        <div className="flex justify-end">
          <div className="w-full max-w-[420px] grid grid-cols-5 gap-1.5">
            {LEAGUE_ROLES.map((r) => {
              const sec = pool.roles[r.key];
              const isRoleDirty =
                JSON.stringify(sec ?? null) !==
                (savedRolesJson[r.key] ?? "null");
              const isActive = activeRole === r.key;

              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setActiveRole(r.key)}
                  title={isRoleDirty ? `${r.label} (unsaved changes)` : r.label}
                  className={`relative p-2 rounded border flex flex-col items-center gap-1 text-[11px] font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-[#221d12] border-[#f0c020] text-[#f0c020]"
                      : "bg-[#141820] border-white/10 text-[#a6a89e] hover:border-white/25"
                  }`}
                >
                  {isRoleDirty && (
                    <span className="absolute top-0.5 right-1 text-sm leading-none text-[#f0c020]">
                      *
                    </span>
                  )}
                  <img src={r.icon} alt={r.label} className="w-5 h-5" />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {saveError && (
          <div className="px-3 py-2 rounded bg-[#2e1414] border border-[#ff857a]/40 text-xs text-[#ff857a]">
            {saveError}
          </div>
        )}

        {/* Row 3: Save status (left) + Tier & Save/Export Actions (right-justified) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10 text-xs">
          <div>
            {saveMessage && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#11241a] border border-[#2f6343] text-xs text-[#7cd438]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmModal({
                title: `Reset ${activeRoleMeta.label} Pool`,
                message: "All champions in this role's tiers will be removed.",
                confirmLabel: `Reset ${activeRoleMeta.label} Pool`,
                danger: true,
                onConfirm: () => {
                  setConfirmModal(null);
                  updateActiveRoleTiers(() =>
                    createRoleSection(activeRole, "standard").tiers
                  );
                },
              });
            }}
            className="xp-btn xp-btn-danger text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset {activeRoleMeta.label} Pool
          </button>
          <button
            type="button"
            onClick={() => savePoolWithPassphrase(activePassphrase)}
            disabled={saving}
            className="xp-btn xp-btn-primary text-xs min-w-[126px] whitespace-nowrap justify-center"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Encrypting..." : `Save Pools${dirty ? "*" : ""}`}
          </button>
          <button
            type="button"
            onClick={() => setHideNames((v) => !v)}
            title="Toggle champion names on tiles and exported PNG"
            className="xp-btn text-xs w-[158px] whitespace-nowrap justify-center"
          >
            <span>{hideNames ? "Show Champion Names" : "Hide Champion Names"}</span>
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
          </div>
        </div>

        {/* Drag-and-Drop Tier Board + Unplaced Champion Picker */}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={(e) => {
            const id = e.over ? String(e.over.id) : "";
            setActiveGapId(id.startsWith("gap-drop:") ? id : null);
          }}
          onDragCancel={() => {
            setActiveDragChamp(null);
            setActiveGapId(null);
          }}
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
                onDeleteTier={() => {
                  setConfirmModal({
                    title: "Delete Tier",
                    message: `Delete tier "${
                      tier.label || "Untitled"
                    }"? Any champions in it will be removed.`,
                    confirmLabel: "Delete Tier",
                    danger: true,
                    onConfirm: () => {
                      setConfirmModal(null);
                      updateActiveRoleTiers((tiers) => {
                        if (tiers.length <= 1) return tiers;
                        return tiers.filter((t) => t.id !== tier.id);
                      });
                    },
                  });
                }}
                onRemoveChampion={(championId) => {
                  handleChampHoverEnd();
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
                  );
                }}
                onHoverStart={handleChampHoverStart}
                onHoverEnd={handleChampHoverEnd}
                activeGapId={activeGapId}
                iconsOnly={hideNames}
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
                <span
                  onDoubleClick={() => {
                    if (unplacedChampions.length === 0) return;
                    updateActiveRoleTiers((prev) => {
                      if (prev.length === 0) return prev;
                      const next = prev.map((t) => ({
                        ...t,
                        champions: [...t.champions],
                      }));
                      for (const champ of unplacedChampions) {
                        const tierIdx = Math.floor(Math.random() * next.length);
                        const isBlindable = Math.random() < 0.35;
                        next[tierIdx].champions.push({
                          championId: champ.id,
                          name: champ.name,
                          isBlindable,
                        });
                      }
                      return next;
                    });
                  }}
                  className="text-xs font-bold uppercase tracking-wider text-[#f0c020] select-none"
                >
                  {activeRoleMeta.label} Champions
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-[#c7c9be] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllOffMeta}
                    onChange={(e) => setShowAllOffMeta(e.target.checked)}
                    className="accent-[#f0c020]"
                  />
                  Show all champions
                </label>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name..."
                  className="xp-inset px-2.5 py-1 text-xs w-40"
                />
              </div>
            </div>

            <div className="xp-inset p-2.5 grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
              {unplacedChampions.length === 0 ? (
                <div className="col-span-full w-full py-6 text-center text-xs text-[#7c808b]">
                  No matching champions available.
                </div>
              ) : (
                unplacedChampions.map((champ) => (
                  <DraggablePoolChampion
                    key={champ.id}
                    champion={champ}
                    iconsOnly={hideNames}
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
                    iconsOnly={hideNames}
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
            className="min-w-[640px] max-w-[1080px] w-fit p-2.5"
          >
            <div
              style={{ borderRadius: "44px", borderColor: "#5c6662" }}
              className="w-full p-6 bg-[#0e1117] text-[#f0ede0] border-[6px] overflow-hidden space-y-4"
            >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={activeRoleMeta.icon}
                  alt={activeRoleMeta.label}
                  className="w-8 h-8"
                />
                <div>
                  <h2 className="wow-heading text-3xl font-bold text-[#f0c020] tracking-wide">
                    {effectiveTitle}
                  </h2>
                  {(pool.generalNotes ?? "").trim() && (
                    <p className="text-xs text-[#d6d3c4] mt-0.5 max-w-xl">
                      {(pool.generalNotes ?? "").trim()}
                    </p>
                  )}
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
                const tLen = (tier.label || "").trim().length;
                const exportLabelSize =
                  tLen <= 6 ? "text-3xl" : tLen <= 18 ? "text-2xl" : "text-sm";

                return (
                  <div
                    key={tier.id}
                    className="flex rounded-lg border border-white/10 bg-[#141820] overflow-hidden"
                  >
                    <div
                      className={`w-32 shrink-0 p-3 flex items-center justify-center text-center font-black leading-tight break-words ${exportLabelSize}`}
                      style={{ backgroundColor: tier.color, color: contrast }}
                    >
                      {tier.label}
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex-1 flex items-stretch">
                        {blindChamps.length > 0 && (
                          <div className="p-2.5 bg-[#0f1a14] border-r-2 border-[#3f8559] flex flex-col gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#9ec497] leading-none h-3">
                              <EyeClosed className="w-3 h-3" />
                              <span>Blindable</span>
                            </span>
                            <div
                              className="grid gap-2 items-start"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(
                                  blindChamps.length,
                                  4
                                )}, max-content)`,
                              }}
                            >
                              {blindChamps.map((c) =>
                                hideNames ? (
                                  <div
                                    key={c.championId}
                                    className="w-[76px] h-[78px] rounded overflow-hidden border border-[#2f6343] bg-[#14221a]"
                                  >
                                    <img
                                      src={iconMap.get(c.championId) ?? ""}
                                      alt={c.name}
                                      width={76}
                                      height={78}
                                      crossOrigin="anonymous"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    key={c.championId}
                                    className="flex flex-col items-center w-[76px] h-[78px] p-1.5 rounded bg-[#14221a] border border-[#2f6343]"
                                  >
                                    <img
                                      src={iconMap.get(c.championId) ?? ""}
                                      alt={c.name}
                                      width={48}
                                      height={48}
                                      crossOrigin="anonymous"
                                      className="w-12 h-12 rounded object-cover"
                                    />
                                    <span
                                      className={`mt-1 ${
                                        c.name.length > 13
                                          ? "text-[8px] tracking-tighter"
                                          : c.name.length > 11
                                          ? "text-[9px]"
                                          : "text-[10px]"
                                      } font-bold text-center leading-tight whitespace-nowrap truncate w-full`}
                                    >
                                      {c.name}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 p-2.5 flex flex-col gap-1.5">
                          {blindChamps.length > 0 && (
                            <span className="h-3" aria-hidden="true" />
                          )}
                          <div
                            className="grid gap-2 items-start"
                            style={
                              genChamps.length > 0
                                ? {
                                    gridTemplateColumns: `repeat(${Math.min(
                                      genChamps.length,
                                      6
                                    )}, max-content)`,
                                  }
                                : undefined
                            }
                          >
                            {tier.champions.length === 0 ? (
                              <span className="text-xs text-[#5d626d] italic">
                                Empty
                              </span>
                            ) : genChamps.length === 0 ? null : (
                              genChamps.map((c) =>
                                hideNames ? (
                                  <div
                                    key={c.championId}
                                    className="w-[76px] h-[78px] rounded overflow-hidden border border-white/15 bg-[#1b202b]"
                                  >
                                    <img
                                      src={iconMap.get(c.championId) ?? ""}
                                      alt={c.name}
                                      width={76}
                                      height={78}
                                      crossOrigin="anonymous"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    key={c.championId}
                                    className="flex flex-col items-center w-[76px] h-[78px] p-1.5 rounded bg-[#1b202b] border border-white/10"
                                  >
                                    <img
                                      src={iconMap.get(c.championId) ?? ""}
                                      alt={c.name}
                                      width={48}
                                      height={48}
                                      crossOrigin="anonymous"
                                      className="w-12 h-12 rounded object-cover"
                                    />
                                    <span
                                      className={`mt-1 ${
                                        c.name.length > 13
                                          ? "text-[8px] tracking-tighter"
                                          : c.name.length > 11
                                          ? "text-[9px]"
                                          : "text-[10px]"
                                      } font-bold text-center leading-tight whitespace-nowrap truncate w-full`}
                                    >
                                      {c.name}
                                    </span>
                                  </div>
                                )
                              )
                            )}
                          </div>
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
      </div>

      <RetroConfirmModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title ?? "Confirm"}
        message={confirmModal?.message ?? ""}
        confirmLabel={confirmModal?.confirmLabel ?? "Confirm"}
        danger={confirmModal?.danger}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />
    </RetroWindow>
  );
}

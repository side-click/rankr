"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toPng } from "html-to-image";
import {
  Check,
  Copy,
  Download,
  Edit3,
  ImagePlus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type {
  Ballot,
  BallotOverlay,
  DivisionTheme,
  PlayerTierListPayload,
} from "@/types/database";
import { RetroWindow } from "@/components/RetroWindow";
import {
  CAPTAIN_ICON,
  getRoleMeta,
  LEAGUE_ROLES,
  type LeagueRole,
} from "@/utils/roles";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import { getRoleSectionTitle } from "@/utils/tierPresets";

interface PlayerTierShareViewProps {
  ballot: Ballot;
  themes?: DivisionTheme[];
  isOwner: boolean;
  isAdmin?: boolean;
}

const BASE_TIER_COMMENT_HEIGHT_PX = 145;

function AutoFitTierComment({ text }: { text: string | null | undefined }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = 14;
      const minSize = 11;
      el.style.fontSize = `${size}px`;
      el.style.lineHeight = "1.45";

      const rowHeight = el.parentElement?.parentElement?.clientHeight ?? 0;
      const maxHeight = Math.max(
        BASE_TIER_COMMENT_HEIGHT_PX,
        rowHeight > 0 ? rowHeight - 24 : 0
      );

      while (el.scrollHeight > maxHeight && size > minSize) {
        size = Math.max(minSize, size - 0.5);
        el.style.fontSize = `${size}px`;
        el.style.lineHeight = size <= 12 ? "1.28" : size <= 13 ? "1.35" : "1.4";
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    if (el.parentElement?.parentElement) {
      observer.observe(el.parentElement.parentElement);
    }
    return () => observer.disconnect();
  }, [text]);

  if (!text?.trim()) {
    return (
      <div className="text-sm text-[#f0ede0] text-center min-w-0">
        <span className="italic text-white/40">—</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full text-sm leading-relaxed text-[#f0ede0] text-center whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0"
    >
      {text}
    </div>
  );
}

const SCDL_GREEN_THEME: DivisionTheme = {
  key: "scdl",
  name: "SCDL Green",
  primary_color: "#1b5e36",
  secondary_color: "#0f2e1f",
  accent_text_color: "#f0c020",
  default_logo_url: null,
};

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

export function PlayerTierShareView({
  ballot,
  themes,
  isOwner,
  isAdmin = false,
}: PlayerTierShareViewProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role");
  const validRoleKeys = new Set<string>(LEAGUE_ROLES.map((r) => r.key));
  const [roleFilter, setRoleFilter] = useState<LeagueRole | "all">(
    initialRoleParam && validRoleKeys.has(initialRoleParam)
      ? (initialRoleParam as LeagueRole)
      : "all"
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (roleFilter === "all") {
      params.delete("role");
    } else {
      params.set("role", roleFilter);
    }
    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    const currentUrl = `${pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [roleFilter, pathname, searchParams]);

  const initialOverlays: BallotOverlay[] = Array.isArray(ballot.overlays)
    ? ballot.overlays
    : [];
  const [overlays, setOverlays] = useState<BallotOverlay[]>(initialOverlays);
  const [savedOverlays, setSavedOverlays] =
    useState<BallotOverlay[]>(initialOverlays);
  const [editingOverlays, setEditingOverlays] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);
  const [savingOverlays, setSavingOverlays] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const profile = Array.isArray(ballot.profiles)
    ? ballot.profiles[0]
    : ballot.profiles;
  const season = Array.isArray(ballot.seasons)
    ? ballot.seasons[0]
    : ballot.seasons;
  const division = Array.isArray(ballot.divisions)
    ? ballot.divisions[0]
    : ballot.divisions;
  const edition = Array.isArray(ballot.editions)
    ? ballot.editions[0]
    : ballot.editions;

  const seasonLeague = (
    season as {
      leagues?:
        | { name?: string; logo_url?: string | null }
        | { name?: string; logo_url?: string | null }[];
    } | null
  )?.leagues;
  const league = Array.isArray(seasonLeague) ? seasonLeague[0] : seasonLeague;

  const leagueName =
    league?.name ?? ballot.league_name_snapshot ?? "Player Tier List";
  const leagueLogo = league?.logo_url ?? null;
  const seasonName =
    season?.name ?? ballot.season_name_snapshot ?? "Season";
  const divisionName =
    division?.name ?? ballot.division_name_snapshot ?? null;
  const editionName =
    edition?.name ?? ballot.edition_name_snapshot ?? "Edition";

  const isDivisionless = !ballot.division_id && !divisionName;
  const divisionThemeKey = isDivisionless
    ? "scdl"
    : division?.theme_key ?? ballot.division_theme_snapshot ?? "baron";

  const resolvedTheme = isDivisionless
    ? SCDL_GREEN_THEME
    : resolveDivisionTheme(divisionThemeKey, themes);

  const divisionLogo = isDivisionless
    ? null
    : division?.logo_url ??
      ballot.division_logo_snapshot ??
      resolvedTheme.default_logo_url ??
      null;

  const tierData: PlayerTierListPayload = useMemo(() => {
    const raw = ballot.tier_data;
    if (raw && Array.isArray(raw.sections)) {
      return raw;
    }
    return { preset: "standard", splitByRole: false, sections: [] };
  }, [ballot.tier_data]);

  const visibleSections = useMemo(() => {
    if (!tierData.splitByRole || roleFilter === "all") {
      return tierData.sections;
    }
    return tierData.sections.filter((sec) => sec.role === roleFilter);
  }, [tierData, roleFilter]);

  const hasAnyCommentary = useMemo(
    () =>
      tierData.sections.some((sec) =>
        sec.tiers.some((t) => Boolean(t.commentary?.trim()))
      ),
    [tierData]
  );

  const isMultiRoleCompact =
    tierData.splitByRole && roleFilter === "all" && visibleSections.length > 1;

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleExportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1060,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const safeName = `${season?.slug ?? "rankr"}-${
        division?.slug ?? "all-divisions"
      }-${edition?.slug ?? "ed"}-players-${
        roleFilter !== "all" ? `${roleFilter}-` : ""
      }${profile?.username ?? "tierlist"}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  async function handleAdminDelete() {
    if (
      !confirm(
        "Are you sure you want to permanently delete this published player tier list?"
      )
    ) {
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ballots")
      .delete()
      .eq("id", ballot.id);
    if (error) {
      alert(`Failed to delete tier list: ${error.message}`);
      setDeleting(false);
      return;
    }
    router.push("/browse");
    router.refresh();
  }

  async function handleUploadOverlay(file: File) {
    setOverlayError(null);
    if (!file.type.startsWith("image/")) {
      setOverlayError("Only image or GIF files are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setOverlayError("File size must be 5 MB or smaller.");
      return;
    }

    setUploadingOverlay(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${ballot.user_id}/${ballot.id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("ballot-overlays")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setOverlayError(`Upload failed: ${uploadErr.message}`);
      setUploadingOverlay(false);
      return;
    }

    const { data: pub } = supabase.storage
      .from("ballot-overlays")
      .getPublicUrl(path);

    const newItem: BallotOverlay = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: pub.publicUrl,
      x: 38,
      y: 25,
      width: 18,
    };
    setOverlays((prev) => [...prev, newItem]);
    setEditingOverlays(true);
    setUploadingOverlay(false);
  }

  async function handleSaveOverlays() {
    setOverlayError(null);
    setSavingOverlays(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ballots")
      .update({
        overlays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ballot.id);

    if (error) {
      setOverlayError(`Failed to save overlays: ${error.message}`);
      setSavingOverlays(false);
      return;
    }

    if (overlays.length > 0 && isOwner) {
      fetch("/api/notify-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ballotId: ballot.id }),
      }).catch(() => {});
    }

    setSavedOverlays(overlays);
    setEditingOverlays(false);
    setSavingOverlays(false);
    router.refresh();
  }

  function startDragOverlay(
    e: React.PointerEvent<HTMLDivElement>,
    overlayId: string
  ) {
    if (!editingOverlays || !cardRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = cardRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const current = overlays.find((o) => o.id === overlayId);
    if (!current) return;
    const originX = current.x;
    const originY = current.y;

    function onMove(ev: PointerEvent) {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startY) / rect.height) * 100;
      const nextX = Math.min(95, Math.max(-5, originX + dxPct));
      const nextY = Math.min(95, Math.max(-5, originY + dyPct));
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === overlayId
            ? { ...o, x: Number(nextX.toFixed(2)), y: Number(nextY.toFixed(2)) }
            : o
        )
      );
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResizeOverlay(
    e: React.PointerEvent<HTMLButtonElement>,
    overlayId: string
  ) {
    if (!editingOverlays || !cardRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = cardRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const current = overlays.find((o) => o.id === overlayId);
    if (!current) return;
    const originWidth = current.width;

    function onMove(ev: PointerEvent) {
      const dwPct = ((ev.clientX - startX) / rect.width) * 100;
      const nextW = Math.min(80, Math.max(5, originWidth + dwPct));
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === overlayId ? { ...o, width: Number(nextW.toFixed(2)) } : o
        )
      );
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const canEditOverlays = (isOwner && Boolean(edition?.is_open)) || isAdmin;

  const editParams = new URLSearchParams();
  editParams.set("type", "player");
  if (season?.slug) editParams.set("season", season.slug);
  editParams.set("division", division?.slug ?? "all");
  if (edition?.slug) editParams.set("edition", edition.slug);

  return (
    <div className="space-y-4">
      <RetroWindow title="Published Player Tier List" theme="scdl">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
          <div className="text-xs text-[#a6a89e]">
            {ballot.status === "published" && ballot.published_at
              ? `Published ${new Date(ballot.published_at).toLocaleDateString()}`
              : "Draft Preview"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && edition?.is_open && (
              <Link href={`/rank?${editParams.toString()}`} className="xp-btn text-xs">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Tier List</span>
              </Link>
            )}
            {canEditOverlays && !editingOverlays && (
              overlays.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setOverlayError(null);
                    setEditingOverlays(true);
                  }}
                  className="xp-btn text-xs"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Edit Overlays</span>
                </button>
              ) : (
                <label className="xp-btn text-xs cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>
                    {uploadingOverlay ? "Uploading..." : "Add Image / GIF"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadingOverlay}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadOverlay(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="xp-btn text-xs"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#7cd438]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied!" : "Copy Link"}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPng}
              disabled={exporting}
              className="xp-btn xp-btn-gold text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? "Exporting..." : "Export PNG"}</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleAdminDelete}
                disabled={deleting}
                className="xp-btn xp-btn-danger text-xs"
                title="Admin: Delete this published player tier list"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? "Deleting..." : "Admin Delete"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Role View Filter Tabs (when Split by 5 Roles) */}
        {tierData.splitByRole && tierData.sections.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 xp-panel p-2.5">
            <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
              View Role Filter:
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`xp-btn text-[11px] px-2.5 py-1 ${
                  roleFilter === "all" ? "xp-btn-primary" : ""
                }`}
              >
                All Roles ({tierData.sections.length})
              </button>
              {tierData.sections.map((sec) => {
                if (sec.role === "all") return null;
                const roleMeta = getRoleMeta(sec.role);
                return (
                  <button
                    key={sec.role}
                    type="button"
                    onClick={() => setRoleFilter(sec.role as LeagueRole)}
                    className={`xp-btn text-[11px] px-2.5 py-1 ${
                      roleFilter === sec.role ? "xp-btn-primary" : ""
                    }`}
                  >
                    <img
                      src={roleMeta.icon}
                      alt={roleMeta.label}
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>{getRoleSectionTitle(sec.role)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {overlayError && !editingOverlays && (
          <div className="mb-4 xp-panel p-2.5 text-xs text-[#ff857a] font-bold border border-[#9e3535]">
            {overlayError}
          </div>
        )}

        {editingOverlays && (
          <div className="mb-4 xp-panel p-3 flex flex-wrap items-center justify-between gap-2 border border-[#c89b3c]/50">
            <div className="text-xs text-[#e8e6b8]">
              <span className="font-bold text-[#f0c020]">Overlay Mode:</span>{" "}
              Upload PNG/JPG/WebP/GIF (max 5 MB), drag to position, and use the
              bottom-right corner to resize.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="xp-btn text-xs cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>
                  {uploadingOverlay ? "Uploading..." : "Add Image / GIF"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingOverlay}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadOverlay(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {overlays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOverlays([])}
                  className="xp-btn xp-btn-danger text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
              <button
                type="button"
                disabled={savingOverlays}
                onClick={() => {
                  setOverlays(savedOverlays);
                  setEditingOverlays(false);
                  setOverlayError(null);
                }}
                className="xp-btn text-xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                disabled={savingOverlays}
                onClick={handleSaveOverlays}
                className="xp-btn xp-btn-primary text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingOverlays ? "Saving..." : "Save Overlays"}</span>
              </button>
            </div>
            {overlayError && (
              <div className="w-full text-xs text-[#ff857a] font-bold">
                {overlayError}
              </div>
            )}
          </div>
        )}

        <div className="lg:hidden text-[11px] text-[#a6a89e] mb-1.5">
          Swipe horizontally to view full graphic →
        </div>

        <div className="overflow-x-auto pb-1">
          <div
            ref={cardRef}
            style={
              exporting
                ? { borderRadius: "44px", boxShadow: "none" }
                : undefined
            }
            className={`relative w-[1060px] mx-auto bg-[#141918] border-2 border-[#39443f] overflow-hidden ${
              exporting ? "" : "shadow-lg"
            }`}
          >
            {/* Header Banner */}
            <div
              style={{
                background: getThemeGradients(resolvedTheme).bannerGradient,
              }}
              className={`border-b border-[#39443f] text-white flex flex-row items-center justify-between gap-4 ${
                exporting ? "px-11 py-6" : "px-5 py-5"
              }`}
            >
              <div className="flex items-center gap-4 text-left">
                {leagueLogo && (
                  <img
                    src={leagueLogo}
                    alt={leagueName}
                    crossOrigin="anonymous"
                    className="w-20 h-16 object-contain drop-shadow shrink-0"
                  />
                )}
                {divisionLogo && (
                  <img
                    src={divisionLogo}
                    alt={divisionName ?? "Division"}
                    crossOrigin="anonymous"
                    className="w-16 h-16 object-contain drop-shadow shrink-0"
                  />
                )}
                <div>
                  <div className="text-sm uppercase tracking-wider font-bold text-[#f0c020]">
                    {leagueName} ({seasonName})
                  </div>
                  <h1 className="wow-heading text-3xl font-extrabold text-white leading-tight">
                    {editionName}
                  </h1>
                  <div className="text-base font-bold text-white/90 leading-snug">
                    {divisionName
                      ? `${divisionName} Player Tier List`
                      : "Player Tier List"}
                    {tierData.splitByRole && roleFilter !== "all"
                      ? ` (${getRoleMeta(roleFilter).label} Only)`
                      : ""}
                  </div>
                  {ballot.author_notes && (
                    <p className="mt-1 text-sm text-[#e8e6b8]/95 leading-snug max-w-2xl line-clamp-1">
                      {ballot.author_notes}
                    </p>
                  )}
                </div>
              </div>

              {profile?.username ? (
                <Link
                  href={`/browse?author=${encodeURIComponent(profile.username)}`}
                  title={`View all published rankings by ${profile.username}`}
                  className="flex items-center gap-3 bg-black/45 hover:bg-black/65 px-4 py-2 rounded-lg border border-white/20 hover:border-[#f0c020]/70 transition-colors shrink-0"
                >
                  {profile.avatar_url && (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username}
                      crossOrigin="anonymous"
                      className="w-10 h-10 rounded-md object-cover border border-white/50"
                    />
                  )}
                  <div className="text-lg font-extrabold text-white tracking-wide">
                    {profile.username}
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 bg-black/45 px-4 py-2 rounded-lg border border-white/20 shrink-0">
                  <div className="text-lg font-extrabold text-white tracking-wide">
                    Voter
                  </div>
                </div>
              )}
            </div>

            {/* Tier List Body */}
            <div
              className={`grid ${
                hasAnyCommentary
                  ? "grid-cols-[148px_1fr_430px]"
                  : "grid-cols-[148px_1fr]"
              } gap-x-3 bg-[#121615] border-b border-[#39443f] text-[11px] font-bold uppercase text-[#c89b3c] ${
                exporting ? "px-7 py-2" : "px-3 py-1.5"
              }`}
            >
              <div className="text-center">Tier</div>
              <div className={isMultiRoleCompact ? "px-2.5" : "px-3"}>
                Players
              </div>
              {hasAnyCommentary && <div className="text-center">Comments</div>}
            </div>

            <div
              className={`divide-y divide-[#39443f] ${
                exporting ? "pb-3" : ""
              }`}
            >
              {visibleSections.map((section, secIdx) => {
                const roleMeta =
                  section.role !== "all" ? getRoleMeta(section.role) : null;

                return (
                  <div key={`${section.role}-${secIdx}`}>
                    {/* Role Header Strip when split by roles */}
                    {roleMeta && (
                      <div
                        className={`bg-[#101514] border-b border-white/10 grid ${
                          hasAnyCommentary
                            ? "grid-cols-[148px_1fr_430px]"
                            : "grid-cols-[148px_1fr]"
                        } gap-x-3 items-center ${
                          exporting ? "px-7 py-2" : "px-3 py-2"
                        }`}
                      >
                        <div />
                        <div
                          className={`flex items-center gap-2.5 min-w-0 ${
                            isMultiRoleCompact ? "px-2.5" : "px-3"
                          }`}
                        >
                          <img
                            src={roleMeta.icon}
                            alt={roleMeta.label}
                            crossOrigin="anonymous"
                            className="w-5 h-5 object-contain shrink-0"
                          />
                          <span className="font-extrabold text-sm uppercase tracking-wider text-[#f0c020]">
                            {getRoleSectionTitle(section.role)}
                          </span>
                        </div>
                        {hasAnyCommentary && <div />}
                      </div>
                    )}

                    {/* Rows */}
                    <div className="divide-y divide-white/10">
                      {section.tiers.map((tier) => {
                        const contrastText = getTierContrastText(tier.color);
                        const isShortTierLabel = tier.label.trim().length <= 3;
                        return (
                          <div
                            key={tier.id}
                            style={{
                              background: `linear-gradient(90deg, ${tier.color}42 0%, ${tier.color}24 100%)`,
                            }}
                            className={`grid ${
                              hasAnyCommentary
                                ? "grid-cols-[148px_1fr_430px]"
                                : "grid-cols-[148px_1fr]"
                            } gap-x-3 items-center ${
                              isMultiRoleCompact ? "min-h-[82px]" : "min-h-[104px]"
                            } ${
                              exporting
                                ? "px-7 py-3"
                                : isMultiRoleCompact
                                ? "px-3 py-2"
                                : "px-3 py-2.5"
                            }`}
                          >
                            {/* Tier Label Cell */}
                            <div className="flex items-center justify-center">
                              <span
                                style={{
                                  backgroundColor: `${tier.color}cc`,
                                  borderColor: tier.color,
                                  color: contrastText,
                                }}
                                className={`w-fit max-w-full rounded-xl border font-black text-center flex items-center justify-center shadow-sm leading-tight whitespace-nowrap ${
                                  isShortTierLabel
                                    ? "min-w-[54px] px-3.5 py-2 text-xl min-h-[52px]"
                                    : "min-w-[54px] px-4 py-2 text-[15px] min-h-[48px]"
                                }`}
                              >
                                {tier.label}
                              </span>
                            </div>

                            {/* Players Cell */}
                            <div
                              className={`min-w-0 ${
                                isMultiRoleCompact ? "px-2.5 py-1.5" : "px-3 py-2"
                              }`}
                            >
                              {tier.players.length === 0 ? (
                                <span className="text-[11px] italic text-white/25">
                                  —
                                </span>
                              ) : !tierData.splitByRole ? (
                                <div className="space-y-1.5 w-full">
                                  {LEAGUE_ROLES.map((r) => {
                                    const rolePlayers = tier.players.filter(
                                      (pl) => pl.role === r.key
                                    );
                                    if (rolePlayers.length === 0) return null;
                                    return (
                                      <div
                                        key={r.key}
                                        className="flex items-start gap-2"
                                      >
                                        <img
                                          src={r.icon}
                                          alt={r.label}
                                          title={r.label}
                                          crossOrigin="anonymous"
                                          className="w-5 h-5 object-contain shrink-0 mt-0.5"
                                        />
                                        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                                          {rolePlayers.map((pl) => (
                                            <div
                                              key={pl.id}
                                              className="inline-flex items-center gap-1.5 rounded border border-[#3a4350] bg-[#1f252e] text-[#f5f3ea] px-2 py-1 text-xs"
                                            >
                                              <span className="font-bold leading-none whitespace-nowrap">
                                                {pl.name.split("#")[0].trim() ||
                                                  pl.name}
                                              </span>
                                              {pl.team_logo_url ? (
                                                <img
                                                  src={pl.team_logo_url}
                                                  alt={pl.team_name ?? "Team"}
                                                  title={
                                                    pl.team_name ?? undefined
                                                  }
                                                  crossOrigin="anonymous"
                                                  className="w-4 h-4 object-contain shrink-0"
                                                />
                                              ) : (
                                                pl.team_name && (
                                                  <span className="text-[10px] font-semibold text-[#a0a7b4] bg-black/35 px-1 py-0.5 rounded leading-none">
                                                    {pl.team_name}
                                                  </span>
                                                )
                                              )}
                                              {pl.is_captain && (
                                                <img
                                                  src={CAPTAIN_ICON}
                                                  alt="Captain"
                                                  crossOrigin="anonymous"
                                                  className="w-3.5 h-3.5 object-contain shrink-0"
                                                />
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center content-center gap-1.5">
                                  {tier.players.map((pl) => (
                                    <div
                                      key={pl.id}
                                      className="inline-flex items-center gap-1.5 rounded border border-[#3a4350] bg-[#1f252e] text-[#f5f3ea] px-2 py-1 text-xs"
                                    >
                                      <span className="font-bold leading-none whitespace-nowrap">
                                        {pl.name.split("#")[0].trim() ||
                                          pl.name}
                                      </span>
                                      {pl.team_logo_url ? (
                                        <img
                                          src={pl.team_logo_url}
                                          alt={pl.team_name ?? "Team"}
                                          title={pl.team_name ?? undefined}
                                          crossOrigin="anonymous"
                                          className="w-4 h-4 object-contain shrink-0"
                                        />
                                      ) : (
                                        pl.team_name && (
                                          <span className="text-[10px] font-semibold text-[#a0a7b4] bg-black/35 px-1 py-0.5 rounded leading-none">
                                            {pl.team_name}
                                          </span>
                                        )
                                      )}
                                      {pl.is_captain && (
                                        <img
                                          src={CAPTAIN_ICON}
                                          alt="Captain"
                                          crossOrigin="anonymous"
                                          className="w-3.5 h-3.5 object-contain shrink-0"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Comments Cell */}
                            {hasAnyCommentary && (
                              <div className="flex items-center justify-center px-2 py-1 min-w-0">
                                <AutoFitTierComment text={tier.commentary} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Saved Overlays */}
            {overlays.length > 0 && (
              <div className="absolute inset-0 z-20 pointer-events-none select-none">
                {overlays.map((ov) => (
                  <div
                    key={ov.id}
                    onPointerDown={(e) => startDragOverlay(e, ov.id)}
                    style={{
                      left: `${ov.x}%`,
                      top: `${ov.y}%`,
                      width: `${ov.width}%`,
                    }}
                    className={`absolute ${
                      editingOverlays
                        ? "pointer-events-auto cursor-grab active:cursor-grabbing ring-2 ring-[#f0c020] bg-black/15 rounded-sm"
                        : "pointer-events-none"
                    }`}
                  >
                    <img
                      src={ov.url}
                      alt="Overlay"
                      crossOrigin="anonymous"
                      draggable={false}
                      className="w-full h-auto block"
                    />
                    {editingOverlays && (
                      <>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            setOverlays((prev) =>
                              prev.filter((item) => item.id !== ov.id)
                            )
                          }
                          className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#b82525] hover:bg-[#d93636] text-white border border-white/60 flex items-center justify-center shadow cursor-pointer"
                          title="Remove overlay"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => startResizeOverlay(e, ov.id)}
                          className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-xs bg-[#f0c020] border border-black/70 cursor-nwse-resize shadow"
                          title="Drag to resize"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

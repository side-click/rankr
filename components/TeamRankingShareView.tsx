"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Ranking,
  RankingEntry,
  RankingOverlay,
  DivisionTheme,
} from "@/types/database";
import { RetroWindow } from "@/components/RetroWindow";
import { RetroConfirmModal } from "@/components/RetroConfirmModal";
import { RankChangeBadge } from "@/components/RankChangeBadge";
import { ScaledGraphicFrame } from "@/components/ScaledGraphicFrame";
import { CAPTAIN_ICON, getRoleMeta, normalizeRoster } from "@/utils/roles";
import { getRankColor } from "@/utils/rankColors";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";

interface TeamRankingShareViewProps {
  ballot: Ranking;
  entries: RankingEntry[];
  themes?: DivisionTheme[];
  isOwner: boolean;
  isAdmin?: boolean;
}

const MAX_COMMENT_HEIGHT_PX = 90;

function AutoFitComment({ text }: { text: string | null | undefined }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = 14;
      const minSize = 10;
      el.style.fontSize = `${size}px`;
      el.style.lineHeight = "1.45";

      while (el.scrollHeight > MAX_COMMENT_HEIGHT_PX && size > minSize) {
        size = Math.max(minSize, size - 0.5);
        el.style.fontSize = `${size}px`;
        el.style.lineHeight = size <= 11.5 ? "1.2" : size <= 12.5 ? "1.3" : "1.4";
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (!text) {
    return (
      <div className="text-sm text-[#f0ede0] text-center min-w-0">
        <span className="italic text-white/40">—</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="text-sm leading-relaxed text-[#f0ede0] text-center whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-h-[90px] overflow-hidden"
    >
      {text}
    </div>
  );
}

export function TeamRankingShareView({
  ballot,
  entries,
  themes,
  isOwner,
  isAdmin = false,
}: TeamRankingShareViewProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const initialOverlays: RankingOverlay[] = Array.isArray(ballot.overlays)
    ? ballot.overlays
    : [];
  const [overlays, setOverlays] = useState<RankingOverlay[]>(initialOverlays);
  const [savedOverlays, setSavedOverlays] =
    useState<RankingOverlay[]>(initialOverlays);
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
    league?.name ?? ballot.league_name_snapshot ?? "Power Rankings";
  const leagueLogo = league?.logo_url ?? null;
  const seasonName =
    season?.name ?? ballot.season_name_snapshot ?? "Season";
  const divisionName =
    division?.name ?? ballot.division_name_snapshot ?? "Division";
  const divisionTheme =
    division?.theme_key ?? ballot.division_theme_snapshot ?? "baron";
  const resolvedTheme = resolveDivisionTheme(divisionTheme, themes);
  const divisionLogo =
    division?.logo_url ??
    ballot.division_logo_snapshot ??
    resolvedTheme.default_logo_url ??
    null;
  const editionName =
    edition?.name ?? ballot.edition_name_snapshot ?? "Edition";

  const theme = divisionTheme === "dragon" ? "dragon" : "baron";
  const displayTitle =
    ballot.title || `${divisionName} Power Rankings — ${editionName}`;

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleExportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      // Wait for React to commit the rounded-corner PNG export layout
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const exportHeight = Math.ceil(cardRef.current.offsetHeight);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: exportHeight,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const safeName = `${season?.slug ?? "rankr"}-${
        division?.slug ?? "div"
      }-${edition?.slug ?? "ed"}-${profile?.username ?? "ranking"}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  function handleAdminDelete() {
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }

  async function confirmAdminDelete() {
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("rankings")
      .delete()
      .eq("id", ballot.id);
    if (error) {
      setDeleteError(`Failed to delete ranking: ${error.message}`);
      setDeleting(false);
      return;
    }
    setDeleteConfirmOpen(false);
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
      .from("ranking-overlays")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setOverlayError(`Upload failed: ${uploadErr.message}`);
      setUploadingOverlay(false);
      return;
    }

    const { data: pub } = supabase.storage
      .from("ranking-overlays")
      .getPublicUrl(path);

    const newItem: RankingOverlay = {
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
      .from("rankings")
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

    if (overlays.length > 0) {
      fetch("/api/notify-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ballotId: ballot.id }),
      }).catch(() => {});
    }

    setSavedOverlays(overlays);
    setEditingOverlays(false);
    setSavingOverlays(false);
    if (overlays.length > 0 && isOwner) {
      fetch("/api/notify-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ballotId: ballot.id }),
      }).catch(() => {});
    }
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

  const isEditionEditable = Boolean(edition?.is_open && !edition?.is_archived);
  const canEditOverlays = (isOwner && isEditionEditable) || isAdmin;

  const headerAccentBg =
    theme === "dragon"
      ? "from-[#6b1a1c] via-[#3b1c4a] to-[#1e1024]"
      : "from-[#4a1c6b] via-[#2d1645] to-[#0e1726]";

  return (
    <div className="space-y-4">
      <RetroWindow
        title="Published Ranking"
        theme="scdl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
          <div className="text-xs text-[#a6a89e]">
            {ballot.status === "published" && ballot.published_at
              ? `Published ${new Date(ballot.published_at).toLocaleDateString(
                  "en-US",
                  { timeZone: "America/New_York" }
                )}`
              : "Draft Preview"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && isEditionEditable && (
              <Link
                href={`/create?season=${season?.slug}&division=${division?.slug}&edition=${edition?.slug}`}
                className="xp-btn text-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Ranking</span>
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
                title="Admin: Delete this published ranking"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? "Deleting..." : "Admin Delete"}</span>
              </button>
            )}
          </div>
        </div>

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

        <ScaledGraphicFrame designWidth={1080}>
          <div ref={cardRef} className="w-[1080px] p-2.5">
            <div
              style={{
                borderRadius: "44px",
                borderColor:
                  !ballot.division_id &&
                  (!divisionName || divisionName === "All Divisions")
                    ? "#5c6662"
                    : resolvedTheme.primary_color,
                ...(exporting ? { boxShadow: "none" } : {}),
              }}
              className={`relative w-full bg-[#181e1c] border-[6px] overflow-hidden ${
                exporting ? "" : "shadow-lg"
              }`}
            >
            <div
              style={{
                background: getThemeGradients(resolvedTheme).bannerGradient,
              }}
              className="border-b-2 border-[#4d5652] text-white flex flex-row items-center justify-between gap-4 px-11 py-6"
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
                    alt={divisionName}
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
                    {divisionName} Team Power Rankings
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


          <div
            className="grid grid-cols-[68px_88px_1.2fr_0.85fr_2.05fr] gap-x-3 bg-[#121615] border-b border-[#39443f] text-[11px] font-bold uppercase text-[#c89b3c] px-10 py-2"
          >
            <div className="text-center">Rank</div>
            <div className="text-center">Change</div>
            <div className="pl-[92px]">Team</div>
            <div />
            <div className="text-center">Comments</div>
          </div>

          <div className="divide-y divide-white/10">
            {entries.map((entry, idx) => {
              const rankColor = getRankColor(idx, entries.length);
              const isLast = idx === entries.length - 1;
              return (
                <div
                  key={entry.id}
                  style={{ background: rankColor.cardBg }}
                  className={`grid grid-cols-[68px_88px_1.2fr_0.85fr_2.05fr] gap-x-3 items-center px-10 ${
                    isLast ? "pt-3.5 pb-6" : "py-3.5"
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <span
                      style={{
                        backgroundColor: rankColor.badgeBg,
                        borderColor: rankColor.borderColor,
                        color: rankColor.badgeText,
                      }}
                      className="w-11 h-11 rounded-xl border font-black text-xl flex items-center justify-center shadow-sm"
                    >
                      {entry.rank}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <RankChangeBadge
                      previousRank={entry.previous_rank}
                      rankChange={entry.rank_change}
                    />
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    {ballot.season_id && ballot.division_id && entry.team_id ? (
                      <Link
                        href={`/stats/team/${encodeURIComponent(entry.team_id)}`}
                        className="group flex items-center gap-3 min-w-0"
                        title={`View ${entry.team_name_snapshot} stats`}
                      >
                        <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                          {entry.team_logo_snapshot ? (
                            <img
                              src={entry.team_logo_snapshot}
                              alt={entry.team_name_snapshot}
                              crossOrigin="anonymous"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-white/40">LOGO</span>
                          )}
                        </div>
                        <div className="font-black text-xl text-[#f7f5eb] group-hover:text-[#f0c020] transition-colors tracking-tight leading-tight">
                          {entry.team_name_snapshot}
                        </div>
                      </Link>
                    ) : (
                      <>
                        <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                          {entry.team_logo_snapshot ? (
                            <img
                              src={entry.team_logo_snapshot}
                              alt={entry.team_name_snapshot}
                              crossOrigin="anonymous"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-[9px] text-white/40">LOGO</span>
                          )}
                        </div>
                        <div className="font-black text-xl text-[#f7f5eb] tracking-tight leading-tight">
                          {entry.team_name_snapshot}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="min-w-0">
                    <ul className="space-y-0.5 text-[11px] font-mono text-[#e5e3d8]">
                      {normalizeRoster(entry.roster_snapshot).map(
                        (slot, pIdx) => {
                          const roleMeta = getRoleMeta(slot.role);
                          const displayName =
                            slot.name.split("#")[0].trim() || slot.name;
                          return (
                            <li
                              key={pIdx}
                              className="flex items-center gap-1.5 truncate"
                            >
                              <img
                                src={roleMeta.icon}
                                alt={roleMeta.label}
                                crossOrigin="anonymous"
                                className="w-3.5 h-3.5 object-contain shrink-0"
                              />
                              {ballot.season_id &&
                              ballot.division_id &&
                              displayName ? (
                                <Link
                                  href={`/stats/player/${encodeURIComponent(
                                    displayName.toLowerCase()
                                  )}`}
                                  className="truncate hover:text-[#f0c020] hover:underline transition-colors"
                                  title={`View ${displayName} stats`}
                                >
                                  {displayName}
                                </Link>
                              ) : (
                                <span className="truncate">{displayName}</span>
                              )}
                              {slot.is_captain && (
                                <img
                                  src={CAPTAIN_ICON}
                                  alt="Captain"
                                  crossOrigin="anonymous"
                                  className="w-3 h-3 object-contain shrink-0"
                                />
                              )}
                            </li>
                          );
                        }
                      )}
                    </ul>
                  </div>

                  <AutoFitComment text={entry.commentary} />
                </div>
              );
            })}
          </div>

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
        </ScaledGraphicFrame>
      </RetroWindow>

      <RetroConfirmModal
        open={deleteConfirmOpen}
        title="Delete Published Ranking"
        message="Are you sure you want to permanently delete this published ranking?"
        confirmLabel="Delete Ranking"
        danger
        loading={deleting}
        error={deleteError}
        onConfirm={confirmAdminDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

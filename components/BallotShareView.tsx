"use client";

import React, { useRef, useState } from "react";
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
  Ballot,
  BallotEntry,
  BallotOverlay,
  DivisionTheme,
} from "@/types/database";
import { RetroWindow } from "@/components/RetroWindow";
import { RankChangeBadge } from "@/components/RankChangeBadge";
import { CAPTAIN_ICON, getRoleMeta, normalizeRoster } from "@/utils/roles";
import { getRankColor } from "@/utils/rankColors";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";

interface BallotShareViewProps {
  ballot: Ballot;
  entries: BallotEntry[];
  themes?: DivisionTheme[];
  isOwner: boolean;
  isAdmin?: boolean;
}

function getCommentSizeClass(text: string | null | undefined): string {
  if (!text) return "text-sm leading-relaxed";
  const lineBreaks = (text.match(/\n/g) ?? []).length;
  if (text.length <= 180 && lineBreaks <= 3) {
    return "text-sm leading-relaxed";
  }
  if (text.length <= 320 && lineBreaks <= 5) {
    return "text-[13px] leading-snug";
  }
  if (text.length <= 480) {
    return "text-xs leading-snug";
  }
  return "text-[11px] leading-tight";
}

export function BallotShareView({
  ballot,
  entries,
  themes,
  isOwner,
  isAdmin = false,
}: BallotShareViewProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
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

  async function handleAdminDelete() {
    if (
      !confirm(
        "Are you sure you want to permanently delete this published ranking?"
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
      alert(`Failed to delete ranking: ${error.message}`);
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

  const canEditOverlays = (isOwner && Boolean(edition?.is_open)) || isAdmin;

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
              ? `Published ${new Date(ballot.published_at).toLocaleDateString()}`
              : "Draft Preview"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && edition?.is_open && (
              <Link
                href={`/rank?season=${season?.slug}&division=${division?.slug}&edition=${edition?.slug}`}
                className="xp-btn text-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Ranking</span>
              </Link>
            )}
            {canEditOverlays && !editingOverlays && (
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

        <div
          ref={cardRef}
          style={exporting ? { borderRadius: "44px", boxShadow: "none" } : undefined}
          className={`relative bg-[#181e1c] border-2 border-[#39443f] overflow-hidden ${
            exporting ? "" : "shadow-lg"
          }`}
        >
          <div
            style={{
              background: getThemeGradients(resolvedTheme).bannerGradient,
            }}
            className={`border-b border-[#39443f] text-white flex flex-col sm:flex-row items-center justify-between gap-4 ${
              exporting ? "px-9 sm:px-11 py-5 sm:py-6" : "px-5 py-4 sm:py-5"
            }`}
          >
            <div className="flex items-center gap-4">
              {leagueLogo && (
                <img
                  src={leagueLogo}
                  alt={leagueName}
                  crossOrigin="anonymous"
                  className="w-16 h-14 sm:w-20 sm:h-16 object-contain drop-shadow"
                />
              )}
              {divisionLogo && (
                <img
                  src={divisionLogo}
                  alt={divisionName}
                  crossOrigin="anonymous"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow"
                />
              )}
              <div>
                <div className="text-xs sm:text-sm uppercase tracking-wider font-bold text-[#f0c020]">
                  {leagueName} ({seasonName})
                </div>
                <h1 className="wow-heading text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {displayTitle}
                </h1>
                {ballot.author_notes && (
                  <p className="mt-1 text-xs sm:text-sm text-[#e8e6b8]/95 leading-snug max-w-2xl line-clamp-1">
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
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-md object-cover border border-white/50"
                  />
                )}
                <div className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                  {profile.username}
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3 bg-black/45 px-4 py-2 rounded-lg border border-white/20 shrink-0">
                <div className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                  Voter
                </div>
              </div>
            )}
          </div>


          <div
            className={`hidden md:grid md:grid-cols-[68px_88px_1.2fr_0.85fr_2.05fr] md:gap-x-3 bg-[#121615] border-b border-[#39443f] text-[11px] font-bold uppercase text-[#c89b3c] ${
              exporting ? "px-8 sm:px-10 py-2" : "px-3 py-1.5"
            }`}
          >
            <div className="text-center">Rank</div>
            <div className="text-center">Change</div>
            <div className="md:pl-[92px]">Team</div>
            <div />
            <div>Comments</div>
          </div>

          <div className="divide-y divide-white/10">
            {entries.map((entry, idx) => {
              const rankColor = getRankColor(idx, entries.length);
              const isLast = idx === entries.length - 1;
              return (
                <div
                  key={entry.id}
                  style={{ background: rankColor.cardBg }}
                  className={`grid grid-cols-1 md:grid-cols-[68px_88px_1.2fr_0.85fr_2.05fr] gap-2 md:gap-y-0 md:gap-x-3 items-center ${
                    exporting
                      ? `px-8 sm:px-10 ${isLast ? "pt-3.5 pb-6" : "py-3.5"}`
                      : "px-3 py-3"
                  }`}
                >
                  <div className="flex items-center justify-between md:justify-center">
                    <span className="md:hidden text-xs font-bold text-white/70">
                      Rank #{entry.rank}
                    </span>
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

                  <div className="flex md:justify-center">
                    <RankChangeBadge
                      previousRank={entry.previous_rank}
                      rankChange={entry.rank_change}
                    />
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 flex items-center justify-center">
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
                    <div className="font-black text-lg md:text-xl text-[#f7f5eb] tracking-tight leading-tight">
                      {entry.team_name_snapshot}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <ul className="text-[11px] font-mono text-[#e5e3d8] space-y-0.5">
                      {normalizeRoster(entry.roster_snapshot).map(
                        (slot, pIdx) => {
                          const roleMeta = getRoleMeta(slot.role);
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
                              <span className="truncate">{slot.name}</span>
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

                  <div
                    className={`${getCommentSizeClass(
                      entry.commentary
                    )} text-[#f0ede0] whitespace-pre-wrap break-words min-w-0`}
                  >
                    {entry.commentary || (
                      <span className="italic text-white/40">—</span>
                    )}
                  </div>
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
      </RetroWindow>
    </div>
  );
}

"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportElementToPng } from "@/utils/exportImage";
import {
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cleanupRankingOverlays } from "@/utils/blogMedia";
import { useOverlayEditor } from "@/hooks/useOverlayEditor";
import {
  OverlayCanvasLayer,
  OverlayEditorBanner,
  OverlayTriggerButton,
} from "@/components/RankingOverlayControls";
import { teamStatsHref } from "@/utils/statsLinks";
import type {
  Ranking,
  RankingEntry,
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

function handleSnapshotImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const rawSrc = img.getAttribute("src") ?? "";
  if (/\.jpg$/i.test(rawSrc) && !img.dataset.triedPng) {
    img.dataset.triedPng = "1";
    img.src = rawSrc.replace(/\.jpg$/i, ".png");
    return;
  }
  img.style.display = "none";
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

  const isEditionEditable = Boolean(edition?.is_open && !edition?.is_archived);
  const canEditOverlays = (isOwner && isEditionEditable) || isAdmin;

  const {
    overlays,
    editingOverlays,
    uploadingOverlay,
    savingOverlays,
    overlayError,
    setOverlayError,
    openOverlayEditor,
    cancelEditingOverlays,
    removeOverlay,
    clearOverlays,
    handleUploadOverlay,
    handleSaveOverlays,
    startDragOverlay,
    startResizeOverlay,
  } = useOverlayEditor({
    rankingId: ballot.id,
    userId: ballot.user_id,
    canEditOverlays,
    initialOverlays: ballot.overlays,
    cardRef,
  });

  const [hideComments, setHideComments] = useState(false);
  const [hideRosters, setHideRosters] = useState(true);
  const [hideChange, setHideChange] = useState(false);

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
      const exportOpts = {
        pixelRatio: 2,
        width: cardWidth,
        height: exportHeight,
        style: { margin: "0" },
        filter: (node: HTMLElement) => {
          if (node instanceof HTMLImageElement) {
            const src = node.getAttribute("src");
            if (!src || src.trim() === "") return false;
            if (!node.complete || node.naturalWidth === 0) return false;
          }
          return true;
        },
      };
      let dataUrl: string;
      try {
        dataUrl = await exportElementToPng(cardRef.current, {
          ...exportOpts,
          cacheBust: true,
        });
      } catch {
        dataUrl = await exportElementToPng(cardRef.current, {
          ...exportOpts,
          cacheBust: false,
          skipFonts: true,
          imagePlaceholder:
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        });
      }
      const link = document.createElement("a");
      const safeName = `${season?.slug ?? "rankr"}-${
        division?.slug ?? "div"
      }-${edition?.slug ?? "ed"}-${profile?.username ?? "ranking"}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.warn(
        "PNG export failed:",
        err instanceof Event
          ? {
              type: err.type,
              tag: (err.target as HTMLElement | null)?.tagName,
              src: (err.target as HTMLImageElement | null)?.src,
            }
          : err
      );
      setOverlayError(
        "PNG export failed. One of the images may have blocked cross-origin loading."
      );
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
    await cleanupRankingOverlays(supabase, ballot.overlays);
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

  const rawHasAnyCommentary = entries.some((e) => Boolean(e.commentary?.trim()));
  const hasAnyCommentary = rawHasAnyCommentary && !hideComments;
  const hasAnyRoster = entries.some(
    (e) => normalizeRoster(e.roster_snapshot).length > 0
  );
  const showRosters = hasAnyRoster && !hideRosters;
  const showChange = !hideChange;
  const cardWidth = hasAnyCommentary
    ? showRosters
      ? showChange
        ? 1020
        : 960
      : showChange
      ? 940
      : 880
    : showRosters
    ? showChange
      ? 800
      : 740
    : showChange
    ? 720
    : 680;
  const isNarrowCard = cardWidth <= 740;
  const teamGridCols = hasAnyCommentary
    ? showRosters
      ? showChange
        ? "grid-cols-[58px_76px_1.6fr_1.4fr]"
        : "grid-cols-[58px_1.6fr_1.4fr]"
      : showChange
      ? "grid-cols-[58px_76px_1.45fr_1.55fr]"
      : "grid-cols-[58px_1.45fr_1.55fr]"
    : showChange
    ? "grid-cols-[58px_76px_1fr]"
    : "grid-cols-[58px_1fr]";

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
        <div className="flex flex-col-reverse sm:flex-row sm:items-end justify-between gap-2 mb-4 pb-3 border-b border-white/10">
          <div className="text-xs text-[#a6a89e]">
            {ballot.status === "published" && ballot.published_at
              ? `Published ${new Date(ballot.published_at).toLocaleDateString(
                  "en-US",
                  { timeZone: "America/New_York" }
                )}`
              : "Draft Preview"}
          </div>
          <div className="w-full sm:w-auto ml-auto flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {rawHasAnyCommentary && (
                <button
                  type="button"
                  onClick={() => setHideComments((v) => !v)}
                  className={`xp-btn text-xs ${hideComments ? "xp-btn-primary" : ""}`}
                  title="Toggle comments in view and PNG export"
                >
                  {hideComments ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  <span>{hideComments ? "Show Comments" : "Hide Comments"}</span>
                </button>
              )}
              {hasAnyRoster && (
                <button
                  type="button"
                  onClick={() => setHideRosters((v) => !v)}
                  className={`xp-btn text-xs ${hideRosters ? "xp-btn-primary" : ""}`}
                  title="Toggle rosters in view and PNG export"
                >
                  {hideRosters ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  <span>{hideRosters ? "Show Rosters" : "Hide Rosters"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setHideChange((v) => !v)}
                className={`xp-btn text-xs ${hideChange ? "xp-btn-primary" : ""}`}
                title="Toggle change column in view and PNG export"
              >
                {hideChange ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span>{hideChange ? "Show Change" : "Hide Change"}</span>
              </button>
              {canEditOverlays && !editingOverlays && (
                <OverlayTriggerButton
                  overlayCount={overlays.length}
                  uploadingOverlay={uploadingOverlay}
                  onOpenEditor={openOverlayEditor}
                  onUploadFile={handleUploadOverlay}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isOwner && isEditionEditable && (
                <Link
                  href={`/create?season=${season?.slug}&division=${division?.slug}&edition=${edition?.slug}`}
                  prefetch={false}
                  className="xp-btn text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Ranking</span>
                </Link>
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
        </div>

        <OverlayEditorBanner
          editingOverlays={editingOverlays}
          overlayCount={overlays.length}
          uploadingOverlay={uploadingOverlay}
          savingOverlays={savingOverlays}
          overlayError={overlayError}
          onUploadFile={handleUploadOverlay}
          onClearAll={clearOverlays}
          onCancel={cancelEditingOverlays}
          onSave={handleSaveOverlays}
        />

        <ScaledGraphicFrame designWidth={cardWidth}>
          <div
            ref={cardRef}
            style={{ width: `${cardWidth}px` }}
            className="mx-auto p-2.5"
          >
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
              className="border-b-2 border-[#4d5652] text-white flex flex-row items-center justify-between gap-4 px-7 py-4"
            >
              <div className="flex items-center gap-3.5 text-left min-w-0">
                {leagueLogo && (
                  <img
                    src={leagueLogo}
                    alt={leagueName}
                    crossOrigin="anonymous"
                    className={`${
                      isNarrowCard ? "w-16 h-12" : "w-20 h-14"
                    } object-contain drop-shadow shrink-0`}
                  />
                )}
                {divisionLogo && (
                  <img
                    src={divisionLogo}
                    alt={divisionName}
                    crossOrigin="anonymous"
                    className={`${
                      isNarrowCard ? "w-12 h-12" : "w-14 h-14"
                    } object-contain drop-shadow shrink-0`}
                  />
                )}
                <div className="min-w-0">
                  <div
                    className={`${
                      isNarrowCard ? "text-xs" : "text-sm"
                    } uppercase tracking-wider font-bold text-[#f0c020]`}
                  >
                    {leagueName} ({seasonName})
                  </div>
                  <h1
                    className={`wow-heading ${
                      isNarrowCard ? "text-2xl" : "text-3xl"
                    } font-extrabold text-white leading-tight`}
                  >
                    {season?.slug && division?.slug && edition?.slug ? (
                      <Link
                        href={`/consensus?season=${encodeURIComponent(
                          season.slug
                        )}&division=${encodeURIComponent(
                          division.slug
                        )}&edition=${encodeURIComponent(edition.slug)}`}
                        prefetch={false}
                        className="hover:text-[#f0c020] transition-colors"
                        title="View consensus rankings for this edition"
                      >
                        {editionName}
                      </Link>
                    ) : (
                      editionName
                    )}
                  </h1>
                  <div
                    className={`${
                      isNarrowCard ? "text-sm" : "text-base"
                    } font-bold text-white/90 leading-snug`}
                  >
                    {divisionName} &middot; Team Power Rankings
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
                prefetch={false}
                title={`View all published rankings by ${profile.username}`}
                className={`flex items-center gap-2.5 bg-black/45 hover:bg-black/65 ${
                  isNarrowCard ? "px-3 py-1.5" : "px-4 py-2"
                } rounded-lg border border-white/20 hover:border-[#f0c020]/70 transition-colors shrink-0`}
              >
                {profile.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    crossOrigin="anonymous"
                    className={`${
                      isNarrowCard ? "w-8 h-8" : "w-10 h-10"
                    } rounded-md object-cover border border-white/50`}
                  />
                )}
                <div
                  className={`${
                    isNarrowCard ? "text-base" : "text-lg"
                  } font-extrabold text-white tracking-wide`}
                >
                  {profile.username}
                </div>
              </Link>
            ) : (
              <div
                className={`flex items-center gap-2.5 bg-black/45 ${
                  isNarrowCard ? "px-3 py-1.5" : "px-4 py-2"
                } rounded-lg border border-white/20 shrink-0`}
              >
                <div
                  className={`${
                    isNarrowCard ? "text-base" : "text-lg"
                  } font-extrabold text-white tracking-wide`}
                >
                  Voter
                </div>
              </div>
            )}
          </div>


          <div
            className={`grid ${teamGridCols} gap-x-3 bg-[#121615] border-b border-[#39443f] text-[11px] font-bold uppercase text-[#c89b3c] px-7 py-2`}
          >
            <div className="text-center">Rank</div>
            {showChange && <div className="text-center">Change</div>}
            <div className={showChange ? "pl-[76px]" : "pl-[88px]"}>Team</div>
            {hasAnyCommentary && <div className="text-center">Comments</div>}
          </div>

          <div className="divide-y divide-white/10">
            {entries.map((entry, idx) => {
              const rankColor = getRankColor(idx, entries.length);
              const isLast = idx === entries.length - 1;
              return (
                <div
                  key={entry.id}
                  style={{ background: rankColor.cardBg }}
                  className={`grid ${teamGridCols} gap-x-3 items-center px-7 ${
                    isLast ? "pt-2.5 pb-5" : "py-2.5"
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

                  {showChange && (
                    <div className="flex justify-center">
                      <RankChangeBadge
                        previousRank={entry.previous_rank}
                        rankChange={entry.rank_change}
                      />
                    </div>
                  )}

                  <div className={`flex items-center gap-3 min-w-0 ${!showChange ? "pl-3" : ""}`}>
                    {ballot.season_id && ballot.division_id && entry.team_id ? (
                      <Link
                        href={teamStatsHref(entry.team_id, "/stats", season?.slug)}
                        prefetch={false}
                        className="w-16 h-16 shrink-0 flex items-center justify-center"
                        title={`View ${entry.team_name_snapshot} stats`}
                      >
                        {entry.team_logo_snapshot ? (
                          <img
                            src={entry.team_logo_snapshot}
                            alt={entry.team_name_snapshot}
                            crossOrigin="anonymous"
                            onError={handleSnapshotImgError}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-white/40">LOGO</span>
                        )}
                      </Link>
                    ) : (
                      <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                        {entry.team_logo_snapshot ? (
                          <img
                            src={entry.team_logo_snapshot}
                            alt={entry.team_name_snapshot}
                            crossOrigin="anonymous"
                            onError={handleSnapshotImgError}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-white/40">LOGO</span>
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      {ballot.season_id && ballot.division_id && entry.team_id ? (
                        <Link
                          href={teamStatsHref(entry.team_id, "/stats", season?.slug)}
                          prefetch={false}
                          className={`block font-black ${
                            !showRosters
                              ? hasAnyCommentary
                                ? "text-2xl"
                                : "text-3xl"
                              : hasAnyCommentary
                              ? "text-xl"
                              : "text-2xl"
                          } text-[#f7f5eb] hover:text-[#f0c020] transition-colors tracking-tight leading-tight`}
                          title={`View ${entry.team_name_snapshot} stats`}
                        >
                          {entry.team_name_snapshot}
                        </Link>
                      ) : (
                        <div
                          className={`font-black ${
                            !showRosters
                              ? hasAnyCommentary
                                ? "text-2xl"
                                : "text-3xl"
                              : hasAnyCommentary
                              ? "text-xl"
                              : "text-2xl"
                          } text-[#f7f5eb] tracking-tight leading-tight`}
                        >
                          {entry.team_name_snapshot}
                        </div>
                      )}

                      {!hideRosters &&
                        normalizeRoster(entry.roster_snapshot).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {normalizeRoster(entry.roster_snapshot).map(
                              (slot, pIdx) => {
                                const roleMeta = getRoleMeta(slot.role);
                                const displayName =
                                  slot.name.split("#")[0].trim() || slot.name;
                                const pillContent = (
                                  <>
                                    <img
                                      src={roleMeta.icon}
                                      alt={roleMeta.label}
                                      crossOrigin="anonymous"
                                      className="w-3 h-3 object-contain shrink-0"
                                    />
                                    <span className="truncate max-w-[120px]">
                                      {displayName}
                                    </span>
                                    {slot.is_captain && (
                                      <img
                                        src={CAPTAIN_ICON}
                                        alt="Captain"
                                        crossOrigin="anonymous"
                                        className="w-3 h-3 object-contain shrink-0"
                                      />
                                    )}
                                  </>
                                );
                                return ballot.season_id &&
                                  ballot.division_id &&
                                  displayName ? (
                                  <Link
                                    key={pIdx}
                                    href={`/stats/player/${encodeURIComponent(
                                      slot.name.trim().toLowerCase()
                                    )}${
                                      ballot.seasons?.slug
                                        ? `?season=${encodeURIComponent(
                                            ballot.seasons.slug
                                          )}`
                                        : ""
                                    }`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 hover:border-[#f0c020]/50 text-[11px] text-[#d6d3c4] hover:text-[#f0c020] transition"
                                    title={`View ${displayName} stats`}
                                  >
                                    {pillContent}
                                  </Link>
                                ) : (
                                  <span
                                    key={pIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[11px] text-[#d6d3c4]"
                                  >
                                    {pillContent}
                                  </span>
                                );
                              }
                            )}
                          </div>
                        )}
                    </div>
                  </div>

                  {hasAnyCommentary && (
                    <AutoFitComment text={entry.commentary} />
                  )}
                </div>
              );
            })}
          </div>

          <OverlayCanvasLayer
            overlays={overlays}
            editingOverlays={editingOverlays}
            onStartDrag={startDragOverlay}
            onStartResize={startResizeOverlay}
            onRemove={removeOverlay}
          />
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

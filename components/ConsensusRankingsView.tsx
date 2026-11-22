"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import {
  AlertTriangle,
  Award,
  Check,
  ChevronDown,
  Copy,
  Crown,
  Download,
  Eye,
  EyeOff,
  Trophy,
} from "lucide-react";
import { RankChangeBadge } from "@/components/RankChangeBadge";
import { ScaledGraphicFrame } from "@/components/ScaledGraphicFrame";
import { getRankColor } from "@/utils/rankColors";
import { getThemeGradients } from "@/utils/themes";
import type { AverageTeamRow } from "@/utils/averageRankings";
import type { DivisionTheme } from "@/types/database";

interface SeasonOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  leagueName: string;
  leagueShortName: string;
  leagueLogoUrl: string | null;
}

interface DivisionOption {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string;
  primaryColor: string;
  themeKey: string;
}

interface EditionOption {
  id: string;
  name: string;
  slug: string;
  isOpen: boolean;
  isArchived: boolean;
  rankingCount: number;
}

interface Contributor {
  rankingId: string;
  username: string;
  avatarUrl: string | null;
}

interface ConsensusRankingsViewProps {
  seasons: SeasonOption[];
  divisions: DivisionOption[];
  editions: EditionOption[];
  selectedSeasonSlug: string;
  selectedDivisionSlug: string;
  selectedEditionSlug: string;
  leagueName: string;
  leagueLogoUrl: string | null;
  seasonName: string;
  divisionName: string;
  divisionLogoUrl: string | null;
  divisionTheme: DivisionTheme;
  editionName: string;
  submissionCount: number;
  isFallbackOutdated: boolean;
  latestEditionName: string | null;
  latestEditionCount: number;
  rows: AverageTeamRow[];
  contributors: Contributor[];
}

export function ConsensusRankingsView({
  seasons,
  divisions,
  editions,
  selectedSeasonSlug,
  selectedDivisionSlug,
  selectedEditionSlug,
  leagueName,
  leagueLogoUrl,
  seasonName,
  divisionName,
  divisionLogoUrl,
  divisionTheme,
  editionName,
  submissionCount,
  isFallbackOutdated,
  latestEditionName,
  latestEditionCount,
  rows,
  contributors,
}: ConsensusRankingsViewProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const selectorContainerRef = useRef<HTMLDivElement>(null);

  const [openMenu, setOpenMenu] = useState<
    "season" | "division" | "edition" | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showChange, setShowChange] = useState(true);
  const cardWidth = showChange ? 860 : 780;
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        selectorContainerRef.current &&
        !selectorContainerRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const currentSeason =
    seasons.find((s) => s.slug === selectedSeasonSlug) ?? seasons[0] ?? null;
  const currentDivision =
    divisions.find((d) => d.slug === selectedDivisionSlug) ??
    divisions[0] ??
    null;
  const currentEdition =
    editions.find((e) => e.slug === selectedEditionSlug) ?? editions[0] ?? null;

  function navigateScope(next: {
    season?: string;
    division?: string;
    edition?: string;
  }) {
    const params = new URLSearchParams();
    const s = next.season ?? selectedSeasonSlug;
    if (s) params.set("season", s);
    if (next.division !== undefined) {
      if (next.division) params.set("division", next.division);
    } else if (!next.season && selectedDivisionSlug) {
      params.set("division", selectedDivisionSlug);
    }
    if (next.edition !== undefined) {
      if (next.edition) params.set("edition", next.edition);
    } else if (!next.season && !next.division && selectedEditionSlug) {
      params.set("edition", selectedEditionSlug);
    }
    setOpenMenu(null);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/consensus?${qs}` : "/consensus");
    });
  }

  async function handleCopyLink() {
    try {
      const params = new URLSearchParams();
      if (selectedSeasonSlug) params.set("season", selectedSeasonSlug);
      if (selectedDivisionSlug) params.set("division", selectedDivisionSlug);
      if (selectedEditionSlug) params.set("edition", selectedEditionSlug);
      const qs = params.toString();
      const shareUrl = `${window.location.origin}/consensus${
        qs ? `?${qs}` : ""
      }`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  }

  async function handleExportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const exportHeight = Math.ceil(cardRef.current.offsetHeight);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: cardWidth,
        height: exportHeight,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const safeName = `${selectedSeasonSlug || "rankr"}-${
        selectedDivisionSlug || "div"
      }-${selectedEditionSlug || "ed"}-consensus`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  }

  const themeGradients = getThemeGradients(divisionTheme);
  const publishedPillTone = (count: number) =>
    count < 2
      ? "bg-[#451717] border-[#9e3535] text-[#ff857a]"
      : "bg-[#2a2210] border-[#c89b3c]/60 text-[#f0c020]";

  return (
    <div className="relative rounded-2xl border border-[#c89b3c]/50 bg-[#0d1412] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
      {/* Award-Show Spotlight Backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(240,192,32,0.18),_rgba(23,59,36,0.16)_45%,_transparent_75%)]"
      />

      <div className="relative p-4 sm:p-6 space-y-5">
        {/* Celebratory Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#c89b3c]/25">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0c020]/25 to-[#8c6b16]/25 border border-[#f0c020]/60 flex items-center justify-center shadow-[0_0_24px_rgba(240,192,32,0.22)] shrink-0">
            <Trophy className="w-6 h-6 text-[#f0c020]" />
          </div>
          <div>
            <h1 className="wow-heading text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              Consensus{" "}
              <span className="whitespace-nowrap">Power Rankings</span>
            </h1>
          </div>
        </div>

        {/* Modern Logo-Rich Rounded Selector Cards */}
        <div
          ref={selectorContainerRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {/* Season Selector Card */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenMenu((prev) => (prev === "season" ? null : "season"))
              }
              className="w-full text-left rounded-xl border border-white/15 bg-[#151d1a]/95 hover:border-[#c89b3c]/70 px-3.5 py-3 flex items-center justify-between gap-3 transition shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                {currentSeason?.leagueLogoUrl ? (
                  <img
                    src={currentSeason.leagueLogoUrl}
                    alt={currentSeason.leagueName}
                    className="w-10 h-10 object-contain shrink-0"
                  />
                ) : (
                  <Award className="w-9 h-9 text-[#f0c020] shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e] truncate">
                    {currentSeason?.leagueName ?? "Season"}
                  </div>
                  <div className="text-sm font-extrabold text-white truncate">
                    {currentSeason?.name ?? "Select Season"}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#c89b3c] shrink-0" />
            </button>

            {openMenu === "season" && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#c89b3c]/60 bg-[#121816] shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1">
                {seasons.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigateScope({ season: s.slug })}
                    className={`w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                      s.slug === selectedSeasonSlug
                        ? "bg-[#2a2210] border border-[#c89b3c]/70 text-[#f0c020]"
                        : "hover:bg-white/5 text-[#e8e6dc]"
                    }`}
                  >
                    {s.leagueLogoUrl ? (
                      <img
                        src={s.leagueLogoUrl}
                        alt={s.leagueName}
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    ) : (
                      <Award className="w-6 h-6 text-[#f0c020] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase font-bold text-[#a6a89e] truncate">
                        {s.leagueName}
                      </div>
                      <div className="text-xs font-bold truncate">
                        {s.name}{" "}
                        {!s.isActive && (
                          <span className="text-[#a6a89e]">(Inactive)</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Division Selector Card */}
          <div className="relative">
            <button
              type="button"
              disabled={divisions.length === 0}
              onClick={() =>
                setOpenMenu((prev) => (prev === "division" ? null : "division"))
              }
              style={
                currentDivision
                  ? {
                      borderColor: `${currentDivision.primaryColor}88`,
                    }
                  : undefined
              }
              className="w-full text-left rounded-xl border border-white/15 bg-[#151d1a]/95 hover:brightness-110 px-3.5 py-3 flex items-center justify-between gap-3 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                {currentDivision?.logoUrl ? (
                  <img
                    src={currentDivision.logoUrl}
                    alt={currentDivision.name}
                    className="w-10 h-10 object-contain shrink-0"
                  />
                ) : (
                  <Award className="w-9 h-9 text-[#7cd438] shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                    Division
                  </div>
                  <div
                    style={
                      currentDivision
                        ? { color: currentDivision.accentColor }
                        : undefined
                    }
                    className="text-sm font-extrabold text-white truncate"
                  >
                    {currentDivision?.name ?? "No Divisions"}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#c89b3c] shrink-0" />
            </button>

            {openMenu === "division" && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#c89b3c]/60 bg-[#121816] shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1">
                {divisions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      navigateScope({ division: d.slug, edition: "" })
                    }
                    className={`w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                      d.slug === selectedDivisionSlug
                        ? "bg-white/10 border border-[#c89b3c]/70"
                        : "hover:bg-white/5"
                    }`}
                  >
                    {d.logoUrl ? (
                      <img
                        src={d.logoUrl}
                        alt={d.name}
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    ) : (
                      <Award className="w-6 h-6 text-[#7cd438] shrink-0" />
                    )}
                    <span
                      style={{ color: d.accentColor }}
                      className="text-xs font-extrabold truncate"
                    >
                      {d.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Edition Selector Card */}
          <div className="relative">
            <button
              type="button"
              disabled={editions.length === 0}
              onClick={() =>
                setOpenMenu((prev) => (prev === "edition" ? null : "edition"))
              }
              className="w-full text-left rounded-xl border border-white/15 bg-[#151d1a]/95 hover:border-[#c89b3c]/70 px-3.5 py-3 flex items-center justify-between gap-3 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                  Edition
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-extrabold text-white truncate">
                    {currentEdition?.name ?? "No Editions"}
                  </span>
                  {currentEdition && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${publishedPillTone(
                        currentEdition.rankingCount
                      )}`}
                    >
                      {currentEdition.rankingCount} published
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#c89b3c] shrink-0" />
            </button>

            {openMenu === "edition" && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#c89b3c]/60 bg-[#121816] shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1">
                {editions.map((ed) => (
                  <button
                    key={ed.id}
                    type="button"
                    onClick={() => navigateScope({ edition: ed.slug })}
                    className={`w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 transition cursor-pointer ${
                      ed.slug === selectedEditionSlug
                        ? "bg-[#2a2210] border border-[#c89b3c]/70 text-[#f0c020]"
                        : "hover:bg-white/5 text-[#e8e6dc]"
                    }`}
                  >
                    <span className="text-xs font-bold truncate">
                      {ed.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${publishedPillTone(
                        ed.rankingCount
                      )}`}
                    >
                      {ed.rankingCount} published
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Outdated Fallback Notice */}
        <div
          className={`space-y-4 transition-opacity duration-150 ${
            isPending ? "opacity-60 pointer-events-none" : ""
          }`}
        >
        {isFallbackOutdated && latestEditionName && (
          <div className="rounded-xl border border-[#c89b3c]/60 bg-[#2a2210]/80 px-4 py-3 flex items-center gap-3 text-xs text-[#f7d560]">
            <AlertTriangle className="w-4 h-4 text-[#f0c020] shrink-0" />
            <span>
              Showing consensus for <strong>{editionName}</strong> —{" "}
              <strong>{latestEditionName}</strong> currently has{" "}
              {latestEditionCount}{" "}
              {latestEditionCount === 1 ? "submission" : "submissions"} and
              needs at least 2 published rankings before consensus is shown.
            </span>
          </div>
        )}

        {/* Voting Panel Strip */}
        {contributors.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 flex flex-wrap items-center justify-start gap-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#c89b3c]">
              Voting Panel ({contributors.length}{" "}
              {contributors.length === 1 ? "Submission" : "Submissions"})
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {contributors.map((c) => (
                <Link
                  key={c.rankingId}
                  href={`/rankings/${c.rankingId}`}
                  title={`Open ${c.username}'s ranking`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c89b3c]/60 text-[11px] font-bold text-[#e8e6dc] transition"
                >
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt={c.username}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-[#5865f2] text-[9px] inline-flex items-center justify-center text-white">
                      {c.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>{c.username}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowChange((prev) => !prev)}
              className={`xp-btn text-xs ${
                !showChange ? "xp-btn-primary" : ""
              }`}
            >
              {showChange ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>{showChange ? "Hide Change" : "Show Change"}</span>
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
          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleExportPng}
              disabled={exporting}
              className="xp-btn xp-btn-gold text-xs disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? "Exporting..." : "Export PNG"}</span>
            </button>
          )}
        </div>

        {/* Consensus Graphic / Empty State */}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-10 text-center space-y-2">
            <Trophy className="w-8 h-8 text-[#c89b3c]/60 mx-auto" />
            <div className="text-sm font-bold text-white">
              No Published Team Rankings Yet
            </div>
            <p className="text-xs text-[#a6a89e] max-w-md mx-auto">
              Once players publish Team Power Rankings for{" "}
              <span className="text-[#f0ede0] font-semibold">
                {divisionName || "this division"}
              </span>{" "}
              ({editionName || "this edition"}), the averaged consensus will
              appear here.
            </p>
          </div>
        ) : (
          <>
            {submissionCount === 1 && (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-xs text-[#c7c5b8]">
                Only 1 published ranking exists for{" "}
                <strong>{editionName}</strong> so far — consensus becomes more
                meaningful once at least 2 rankings are submitted.
              </div>
            )}

            <ScaledGraphicFrame designWidth={cardWidth}>
              <div
                ref={cardRef}
                style={{ width: `${cardWidth}px` }}
                className="mx-auto p-2.5"
              >
                <div
                  style={
                    exporting
                      ? { borderRadius: "44px", boxShadow: "none" }
                      : { borderRadius: "44px" }
                  }
                  className={`relative w-full bg-[#181e1c] border-[6px] border-[#c89b3c]/85 overflow-hidden rounded-[44px] ${
                    exporting ? "" : "shadow-2xl"
                  }`}
                >
                {/* Graphic Header Banner */}
                <div
                  style={{ background: themeGradients.bannerGradient }}
                  className="border-b-2 border-[#c89b3c]/60 text-white flex flex-row items-center justify-between gap-4 px-7 py-4"
                >
                  <div className="flex items-center gap-3.5 text-left min-w-0">
                    {leagueLogoUrl && (
                      <img
                        src={leagueLogoUrl}
                        alt={leagueName}
                        crossOrigin="anonymous"
                        className="w-16 h-12 object-contain drop-shadow shrink-0"
                      />
                    )}
                    {divisionLogoUrl && (
                      <img
                        src={divisionLogoUrl}
                        alt={divisionName}
                        crossOrigin="anonymous"
                        className="w-14 h-14 object-contain drop-shadow shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm uppercase tracking-wider font-bold text-[#f0c020]">
                        {leagueName} ({seasonName})
                      </div>
                      <h2 className="wow-heading text-3xl font-extrabold text-white leading-tight">
                        {editionName} Consensus
                      </h2>
                      <div className="text-base font-bold text-white/90 leading-snug">
                        {divisionName} &middot; Team Power Rankings
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-black/45 px-4 py-2 rounded-xl border border-[#f0c020]/50 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#f0c020]">
                        Average Of
                      </div>
                      <div className="text-base font-extrabold text-white leading-tight">
                        {submissionCount}{" "}
                        {submissionCount === 1 ? "Ranking" : "Rankings"}
                      </div>
                    </div>
                    <Trophy className="w-7 h-7 text-[#f0c020] shrink-0" />
                  </div>
                </div>

                {/* Column Header */}
                <div
                  className={`grid ${
                    showChange
                      ? "grid-cols-[76px_76px_1fr_116px_112px] gap-x-4"
                      : "grid-cols-[76px_1fr_116px_112px] gap-x-4"
                  } bg-[#121615] border-b border-[#39443f] text-[11px] font-bold uppercase text-[#c89b3c] px-7 py-2`}
                >
                  <div className="text-center">Rank</div>
                  {showChange && <div className="text-center">Change</div>}
                  <div className={showChange ? "pl-[80px]" : "pl-[92px]"}>Team</div>
                  <div className="text-center">Avg Rank</div>
                  <div className="text-center">
                    {submissionCount >= 5 ? "Trimmed Range" : "Range"}
                  </div>
                </div>

                {/* Consensus Rows */}
                <div className="divide-y divide-white/10">
                  {rows.map((row, idx) => {
                    const rankColor = getRankColor(idx, rows.length);
                    const isLast = idx === rows.length - 1;
                    return (
                      <div
                        key={row.teamKey}
                        style={{ background: rankColor.cardBg }}
                        className={`px-7 ${isLast ? "pt-2.5 pb-5" : "py-2.5"}`}
                      >
                        <div
                          className={`grid ${
                            showChange
                              ? "grid-cols-[76px_76px_1fr_116px_112px] gap-x-4"
                              : "grid-cols-[76px_1fr_116px_112px] gap-x-4"
                          } items-center`}
                        >
                          <div className="relative flex items-center justify-center">
                            {row.consensusRank === 1 && (
                              <Crown className="w-4 h-4 text-[#f0c020] absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none" />
                            )}
                            <span
                              style={{
                                backgroundColor: rankColor.badgeBg,
                                borderColor: rankColor.borderColor,
                                color: rankColor.badgeText,
                              }}
                              className="w-12 h-12 rounded-xl border font-black text-xl flex items-center justify-center shadow-sm"
                            >
                              {row.consensusRank}
                            </span>
                          </div>

                          {showChange && (
                            <div className="flex justify-center">
                              <RankChangeBadge
                                previousRank={row.previousRank ?? null}
                                rankChange={row.rankChange ?? null}
                              />
                            </div>
                          )}

                          <div className={`min-w-0 ${!showChange ? "pl-3" : ""}`}>
                            {!row.teamKey.startsWith("name:") ? (
                              <Link
                                href={`/stats/team/${encodeURIComponent(
                                  row.teamKey
                                )}`}
                                className="group flex items-center gap-4 min-w-0"
                                title={`View ${row.teamName} stats`}
                              >
                                {row.logoUrl ? (
                                  <img
                                    src={row.logoUrl}
                                    alt={row.teamName}
                                    crossOrigin="anonymous"
                                    className="w-16 h-16 object-contain drop-shadow shrink-0"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center shrink-0">
                                    <Award className="w-7 h-7 text-[#c89b3c]" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-3xl font-extrabold text-white group-hover:text-[#f0c020] transition-colors truncate leading-tight">
                                    {row.teamName}
                                  </div>
                                  {row.rankingCount < submissionCount && (
                                    <div className="text-[11px] text-[#a6a89e]">
                                      Ranked on {row.rankingCount} of{" "}
                                      {submissionCount} submissions
                                    </div>
                                  )}
                                </div>
                              </Link>
                            ) : (
                              <div className="flex items-center gap-4 min-w-0">
                                {row.logoUrl ? (
                                  <img
                                    src={row.logoUrl}
                                    alt={row.teamName}
                                    crossOrigin="anonymous"
                                    className="w-16 h-16 object-contain drop-shadow shrink-0"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center shrink-0">
                                    <Award className="w-7 h-7 text-[#c89b3c]" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-3xl font-extrabold text-white truncate leading-tight">
                                    {row.teamName}
                                  </div>
                                  {row.rankingCount < submissionCount && (
                                    <div className="text-[11px] text-[#a6a89e]">
                                      Ranked on {row.rankingCount} of{" "}
                                      {submissionCount} submissions
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-center">
                            <span className="h-12 px-4 rounded-xl bg-black/40 border border-white/15 text-xl font-black text-[#f0ede0] tabular-nums inline-flex items-center justify-center">
                              {row.averageRank.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-center">
                            <span className="text-lg font-bold text-[#d6d3c4] tabular-nums whitespace-nowrap">
                              {row.bestRank === row.worstRank
                                ? `#${row.bestRank}`
                                : `#${row.bestRank} – #${row.worstRank}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </ScaledGraphicFrame>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

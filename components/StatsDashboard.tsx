"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportElementToPng } from "@/utils/exportImage";
import { StatsDataCredits } from "@/components/stats/StatsDataCredits";
import {
  Award,
  BarChart3,
  ChevronDown,
  Clock,
  Coins,
  Crown,
  Diff,
  Download,
  Droplet,
  Eye,
  Flame,
  Megaphone,
  RefreshCw,
  Shield,
  Skull,
  Sword,
  Swords,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { RankrLogoIcon } from "@/components/RankrLogoIcon";
import { ScaledGraphicFrame } from "@/components/ScaledGraphicFrame";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { StatsAdminControls } from "@/components/stats/StatsAdminControls";
import { StatsDivisionTab } from "@/components/stats/StatsDivisionTab";
import { StatsPlayersTab } from "@/components/stats/StatsPlayersTab";
import { StatsTeamsTab } from "@/components/stats/StatsTeamsTab";
import { StatsUnrosteredModal } from "@/components/stats/StatsUnrosteredModal";
import { RoleLeaderboardExportCard } from "@/components/stats/RoleLeaderboardExportCard";
import { getChampionCenteredSplashUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import { playerStatsHref, statsHref } from "@/utils/statsLinks";
import {
  computeDivisionOverview,
  computePlayerLeaderboards,
  computeSortColors,
  sortTeamsForStandings,
  type PlayerSortKey,
  type PrecomputedSheetDashboardMeta,
} from "@/utils/statsOverview";
import {
  computeRoleNormalizedRatings,
  filterPlayersByStage,
  getPriorityPickRanks,
  getRoleFilteredSoloChampions,
  isMatchPlayoff,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
  type StatsStageBucket,
} from "@/utils/riotStatsAggregation";
import type { SoloPrioEntry, StatsSeasonOption } from "@/utils/riotStatsServer";
import type {
  DraftIntegrityIssue,
  IncompleteDataGame,
  PlayoffSeriesMatchup,
  UnrosteredSheetPlayer,
} from "@/utils/leagueStats";
import type { DraftImportSummary } from "@/utils/draftImporter";
import type {
  DivisionTheme,
  SeasonPlayoffBrackets,
  SeasonStructure,
} from "@/types/database";

interface DivisionItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_key: string;
}

function CreepScoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.2L20.5 13.5L12 21.8L3.5 13.5L12 2.2ZM7.4 11.4L10.6 12.6L9.1 14.9L7.4 11.4ZM16.6 11.4L14.9 14.9L13.4 12.6L16.6 11.4ZM10.4 15.8L12 18.4L13.6 15.8H10.4Z"
      />
    </svg>
  );
}

interface StatsDashboardProps {
  missingTable: boolean;
  hasRiotKey: boolean;
  ddVersion: string;
  leagueName: string;
  leagueLogoUrl: string | null;
  seasonName: string;
  seasonId: string | null;
  seasonSlug?: string | null;
  allSeasons?: StatsSeasonOption[];
  currentEditionName: string;
  divisions: DivisionItem[];
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  soloPrioMap?: Record<string, SoloPrioEntry>;
  isAdminView?: boolean;
  initialStatsNotice?: string | null;
  divisionThemes?: DivisionTheme[];
  seasonStructure?: SeasonStructure;
  playoffBrackets?: SeasonPlayoffBrackets | null;
  statsRoundLabel?: string | null;
  initialDivision?: string;
  initialTab?: "players" | "teams" | "division";
  initialSheetData?: {
    players: AggregatedPlayerStats[];
    subPlayers?: AggregatedPlayerStats[];
    teams: AggregatedTeamStats[];
    unrosteredPlayers?: UnrosteredSheetPlayer[];
    missingDraftGames?: { gameId: string; matchLabel: string }[];
    incompleteDataGames?: IncompleteDataGame[];
    draftIntegrityIssues?: DraftIntegrityIssue[];
    playoffSeries?: PlayoffSeriesMatchup[];
    fetchedAt: string;
    rowCount: number;
    matchCount: number;
    precomputed?: PrecomputedSheetDashboardMeta;
  } | null;
}

type SortKey = PlayerSortKey;

const DEFAULT_SHAREABLE_CARD_KEYS: string[] = [
  "KDA",
  "Kill Participation",
  "CS / Min",
  "Vision / Min",
  "Gold Diff @15",
  "Solo Kills",
];

export function StatsDashboard({
  missingTable,
  ddVersion,
  leagueName,
  leagueLogoUrl,
  seasonName,
  seasonId,
  seasonSlug,
  allSeasons = [],
  currentEditionName,
  divisions,
  players,
  teams,
  soloPrioMap,
  isAdminView = true,
  initialStatsNotice = null,
  divisionThemes = [],
  seasonStructure = "regular_playoffs",
  playoffBrackets = null,
  statsRoundLabel = null,
  initialDivision,
  initialTab,
  initialSheetData = null,
}: StatsDashboardProps) {
  const router = useRouter();
  const basePath = isAdminView ? "/admin/stats" : "/stats";
  const playerHref = (playerKey: string) =>
    playerStatsHref(playerKey, basePath, seasonSlug);
  const resolveDivId = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    if (raw === "all") return "all";
    const lower = raw.toLowerCase();
    const matched = divisions.find(
      (d) => d.id.toLowerCase() === lower || d.slug.toLowerCase() === lower
    );
    return matched ? matched.id : null;
  };

  const [divisionFilter, setDivisionFilter] = useState<string>(() => {
    const resolved = resolveDivId(initialDivision);
    if (resolved) return resolved;
    return divisions[0]?.id ?? "all";
  });
  const [activeSection, setActiveSection] = useState<
    "players" | "teams" | "division"
  >(() =>
    initialTab === "players" ||
    initialTab === "teams" ||
    initialTab === "division"
      ? initialTab
      : initialDivision === "all"
      ? "division"
      : "players"
  );
  const [leaderboardStyle, setLeaderboardStyle] = useState<
    "standard" | "shareable"
  >("standard");
  const [showAllLeaderboardCards, setShowAllLeaderboardCards] = useState(false);
  const [shareableCardKeys, setShareableCardKeys] = useState<(string | null)[]>(
    DEFAULT_SHAREABLE_CARD_KEYS
  );
  const [draggedPill, setDraggedPill] = useState<{
    title: string;
    fromSlot: number | null;
  } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<
    "league" | "division" | null
  >(null);
  const selectorContainerRef = useRef<HTMLDivElement>(null);

  const [roleFilter, setRoleFilter] = useState<LeagueRole | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("leagueRating");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [sheetData, setSheetData] = useState<{
    players: AggregatedPlayerStats[];
    subPlayers: AggregatedPlayerStats[];
    teams: AggregatedTeamStats[];
    unrosteredPlayers: UnrosteredSheetPlayer[];
    missingDraftGames: { gameId: string; matchLabel: string }[];
    incompleteDataGames: IncompleteDataGame[];
    draftIntegrityIssues: DraftIntegrityIssue[];
    playoffSeries: PlayoffSeriesMatchup[];
    fetchedAt: string;
    rowCount: number;
    matchCount: number;
    precomputed?: PrecomputedSheetDashboardMeta;
  } | null>(
    initialSheetData
      ? {
          ...initialSheetData,
          subPlayers: initialSheetData.subPlayers ?? [],
          unrosteredPlayers: initialSheetData.unrosteredPlayers ?? [],
          missingDraftGames: initialSheetData.missingDraftGames ?? [],
          incompleteDataGames: initialSheetData.incompleteDataGames ?? [],
          draftIntegrityIssues: initialSheetData.draftIntegrityIssues ?? [],
          playoffSeries: initialSheetData.playoffSeries ?? [],
        }
      : null
  );
  const [includeSubs, setIncludeSubs] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [importingDrafts, setImportingDrafts] = useState(false);
  const [draftImportResult, setDraftImportResult] =
    useState<DraftImportSummary | null>(null);
  const [statsNotice, setStatsNotice] = useState<string | null>(
    initialStatsNotice ?? null
  );
  const [noticeDraft, setNoticeDraft] = useState<string>(
    initialStatsNotice ?? ""
  );
  const [savingNotice, setSavingNotice] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [showIncompleteDetails, setShowIncompleteDetails] = useState(false);
  const [stageBucket, setStageBucket] = useState<StatsStageBucket>(() => {
    if (initialSheetData?.precomputed) {
      return initialSheetData.precomputed.hasPlayoffStats
        ? "playoffs"
        : "regular";
    }
    const seedPlayers = initialSheetData?.players ?? players;
    return seedPlayers.some((p) => p.matches.some((m) => isMatchPlayoff(m)))
      ? "playoffs"
      : "regular";
  });
  const [showUnrosteredModal, setShowUnrosteredModal] = useState(false);
  const [exportingLeaderboard, setExportingLeaderboard] = useState(false);
  const [exportingRoleLeaderboard, setExportingRoleLeaderboard] =
    useState(false);
  const [copiedRatingBlurb, setCopiedRatingBlurb] = useState(false);
  const leaderboardCardRef = useRef<HTMLDivElement>(null);
  const roleExportCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const rawDiv = sp.get("division") ?? initialDivision;
    const resolvedDiv = resolveDivId(rawDiv);
    if (resolvedDiv) {
      setDivisionFilter(resolvedDiv);
    }
    const tabParam = sp.get("tab") ?? initialTab;
    if (
      tabParam === "players" ||
      tabParam === "teams" ||
      tabParam === "division"
    ) {
      setActiveSection(tabParam);
    } else if (resolvedDiv === "all") {
      setActiveSection("division");
    }
  }, [divisions, initialDivision, initialTab]);

  function updateUrlParams(updates: { division?: string; tab?: string }) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (updates.division !== undefined) {
      url.searchParams.set("division", updates.division);
    }
    if (updates.tab !== undefined) {
      url.searchParams.set("tab", updates.tab);
    }
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function selectDivision(nextDivision: string) {
    setDivisionFilter(nextDivision);
    if (nextDivision === "all") {
      setActiveSection("division");
      updateUrlParams({ division: nextDivision, tab: "division" });
    } else {
      updateUrlParams({ division: nextDivision });
    }
  }

  function selectSection(nextSection: "players" | "teams" | "division") {
    setActiveSection(nextSection);
    updateUrlParams({ tab: nextSection });
  }

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        selectorContainerRef.current &&
        !selectorContainerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedDivision = useMemo(
    () =>
      divisionFilter !== "all"
        ? divisions.find((d) => d.id === divisionFilter) ?? null
        : null,
    [divisions, divisionFilter]
  );

  const selectedDivisionTheme = useMemo(
    () =>
      selectedDivision
        ? resolveDivisionTheme(selectedDivision.theme_key, divisionThemes)
        : null,
    [selectedDivision, divisionThemes]
  );

  const kpiCardStyle = useMemo<React.CSSProperties>(() => {
    const theme = selectedDivisionTheme ?? {
      primary_color: "#1b5e36",
      secondary_color: "#0f2e1f",
    };
    return {
      borderLeftWidth: "3px",
      borderLeftColor: theme.primary_color,
      backgroundImage: `linear-gradient(110deg, ${theme.primary_color}5c 0%, ${theme.primary_color}26 46%, rgba(18, 22, 21, 0.92) 100%)`,
    };
  }, [selectedDivisionTheme]);

  const bannerGradient = useMemo(
    () =>
      selectedDivisionTheme
        ? getThemeGradients(selectedDivisionTheme).bannerGradient
        : "linear-gradient(135deg, #1b3626 0%, #121615 100%)",
    [selectedDivisionTheme]
  );

  const showLeaderboards = selectedDivision !== null;

  async function handleExportLeaderboardPng() {
    if (!leaderboardCardRef.current) return;
    setExportingLeaderboard(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const exportHeight = Math.ceil(leaderboardCardRef.current.offsetHeight);
      const dataUrl = await exportElementToPng(leaderboardCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 800,
        height: exportHeight,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const divPart = selectedDivision?.slug || "league";
      const stagePart = stageBucket === "playoffs" ? "-playoffs" : "";
      link.download = `${divPart}-scdl-leaderboards${stagePart}.png`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      link.href = dataUrl;
      link.click();
    } finally {
      setExportingLeaderboard(false);
    }
  }

  async function handleExportRoleLeaderboardPng() {
    if (!roleExportCardRef.current || roleFilter === "all") return;
    setExportingRoleLeaderboard(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const exportHeight = Math.ceil(roleExportCardRef.current.offsetHeight);
      const dataUrl = await exportElementToPng(roleExportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 680,
        height: exportHeight,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const divPart = selectedDivision?.slug || "league";
      const stagePart = stageBucket === "playoffs" ? "-playoffs" : "";
      link.download = `${divPart}-${roleFilter}-leaderboard${stagePart}.png`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      link.href = dataUrl;
      link.click();
    } finally {
      setExportingRoleLeaderboard(false);
    }
  }

  async function loadSheetStats(force = false) {
    if (!force && sheetData) return;
    setSheetLoading(true);
    setSheetError(null);
    try {
      const sheetQs = seasonId
        ? `?seasonId=${encodeURIComponent(seasonId)}`
        : "";
      const res = await fetch(`/api/admin/scdl-sheet-stats${sheetQs}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        players?: AggregatedPlayerStats[];
        subPlayers?: AggregatedPlayerStats[];
        teams?: AggregatedTeamStats[];
        unrosteredPlayers?: UnrosteredSheetPlayer[];
        missingDraftGames?: { gameId: string; matchLabel: string }[];
        incompleteDataGames?: IncompleteDataGame[];
        draftIntegrityIssues?: DraftIntegrityIssue[];
        playoffSeries?: PlayoffSeriesMatchup[];
        fetchedAt?: string;
        rowCount?: number;
        matchCount?: number;
      };
      if (!res.ok || !json.players || !json.teams) {
        throw new Error(json.error || `Sheet load failed (${res.status})`);
      }
      setSheetData({
        players: json.players,
        subPlayers: json.subPlayers ?? [],
        teams: json.teams,
        unrosteredPlayers: json.unrosteredPlayers ?? [],
        missingDraftGames: json.missingDraftGames ?? [],
        incompleteDataGames: json.incompleteDataGames ?? [],
        draftIntegrityIssues: json.draftIntegrityIssues ?? [],
        playoffSeries: json.playoffSeries ?? [],
        fetchedAt: json.fetchedAt ?? new Date().toISOString(),
        rowCount: json.rowCount ?? 0,
        matchCount: json.matchCount ?? 0,
      });
    } catch (err) {
      setSheetError(
        err instanceof Error ? err.message : "Failed to load SCDL sheet stats"
      );
    } finally {
      setSheetLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdminView || initialSheetData) return;
    void loadSheetStats(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminView]);

  const activePlayers = useMemo(
    () => (sheetData ? sheetData.players : players),
    [sheetData, players]
  );

  const activeTeams = useMemo(
    () => (sheetData ? sheetData.teams : teams),
    [sheetData, teams]
  );

  const allDivisionPlayers = useMemo(() => {
    return activePlayers.filter((p) =>
      divisionFilter === "all" ? true : p.divisionId === divisionFilter
    );
  }, [activePlayers, divisionFilter]);

  const divisionSubPlayers = useMemo(() => {
    return (sheetData?.subPlayers ?? []).filter((p) =>
      divisionFilter === "all" ? true : p.divisionId === divisionFilter
    );
  }, [sheetData, divisionFilter]);

  const stagedSubCount = useMemo(() => {
    if (seasonStructure === "bracket_only") {
      return divisionSubPlayers.filter((p) => p.games > 0).length;
    }
    const pre = sheetData?.precomputed;
    if (pre) {
      const list =
        stageBucket === "playoffs"
          ? pre.hasPlayoffStats
            ? pre.playoffSubPlayers ?? []
            : []
          : pre.hasPlayoffStats
          ? pre.regularSubPlayers ?? []
          : divisionSubPlayers;
      return list.filter(
        (p) =>
          (divisionFilter === "all" || p.divisionId === divisionFilter) &&
          p.games > 0
      ).length;
    }
    const wantPlayoffs = stageBucket === "playoffs";
    return divisionSubPlayers.filter((p) =>
      p.matches.some((m) => isMatchPlayoff(m) === wantPlayoffs)
    ).length;
  }, [
    sheetData,
    divisionSubPlayers,
    divisionFilter,
    stageBucket,
    seasonStructure,
  ]);

  const stageMatchCounts = useMemo(() => {
    const pre = sheetData?.precomputed?.stageMatchCountsByDiv[divisionFilter];
    if (pre) return pre;
    const regIds = new Set<string>();
    const playoffIds = new Set<string>();
    for (const p of allDivisionPlayers) {
      for (const m of p.matches) {
        if (isMatchPlayoff(m)) {
          playoffIds.add(m.matchId);
        } else {
          regIds.add(m.matchId);
        }
      }
    }
    return { regular: regIds.size, playoffs: playoffIds.size };
  }, [sheetData, divisionFilter, allDivisionPlayers]);

  const hasPlayoffStats = stageMatchCounts.playoffs > 0;

  const latestRegularRound = useMemo(() => {
    const preMap = sheetData?.precomputed?.latestRegularRoundByDiv;
    if (preMap && divisionFilter in preMap) {
      return preMap[divisionFilter] ?? null;
    }
    let maxNum = 0;
    for (const p of allDivisionPlayers) {
      for (const m of p.matches) {
        if (isMatchPlayoff(m)) continue;
        const match =
          m.matchLabel?.match(
            /\b(?:round|week|wk|r|w|game|match)\s*(\d+)/i
          ) ?? m.matchLabel?.match(/^\s*(\d+)\s*$/);
        if (match) {
          const n = Number(match[1]);
          if (Number.isFinite(n) && n > maxNum) maxNum = n;
        }
      }
    }
    return maxNum > 0 ? maxNum : null;
  }, [sheetData, divisionFilter, allDivisionPlayers]);

  const exportSubtitle = useMemo(() => {
    if (seasonStructure === "bracket_only") return "Tournament Stats";
    if (stageBucket === "playoffs") return "Playoffs Only";
    if (hasPlayoffStats) return "End of Regular Season";
    if (latestRegularRound != null) {
      const term = statsRoundLabel?.trim() || "Round";
      return `Regular Season After ${term} ${latestRegularRound}`;
    }
    return `As of ${currentEditionName}`;
  }, [
    seasonStructure,
    stageBucket,
    hasPlayoffStats,
    latestRegularRound,
    statsRoundLabel,
    currentEditionName,
  ]);

  useEffect(() => {
    if (seasonStructure === "regular_only") {
      setStageBucket("regular");
    } else if (seasonStructure === "bracket_only") {
      setStageBucket("playoffs");
    } else {
      setStageBucket(hasPlayoffStats ? "playoffs" : "regular");
    }
  }, [divisionFilter, hasPlayoffStats, seasonStructure]);

  const filteredPlayers = useMemo(() => {
    const pre = sheetData?.precomputed;
    if (pre && seasonStructure !== "bracket_only") {
      const stageRoster =
        stageBucket === "playoffs"
          ? pre.hasPlayoffStats
            ? pre.playoffPlayers ?? []
            : []
          : pre.hasPlayoffStats
          ? pre.regularPlayers ?? []
          : sheetData.players;
      const stageSubs =
        stageBucket === "playoffs"
          ? pre.hasPlayoffStats
            ? pre.playoffSubPlayers ?? []
            : []
          : pre.hasPlayoffStats
          ? pre.regularSubPlayers ?? []
          : sheetData.subPlayers;
      const rawStage = includeSubs
        ? [...stageRoster, ...stageSubs]
        : stageRoster;
      const scopedStage = rawStage.filter(
        (p) =>
          (divisionFilter === "all" || p.divisionId === divisionFilter) &&
          (!p.isSub || p.games > 0)
      );
      return computeRoleNormalizedRatings(scopedStage);
    }

    const base = includeSubs
      ? [...allDivisionPlayers, ...divisionSubPlayers]
      : allDivisionPlayers;
    const staged = (
      seasonStructure === "bracket_only"
        ? base
        : filterPlayersByStage(base, stageBucket)
    ).filter((p) => !p.isSub || p.games > 0);
    return computeRoleNormalizedRatings(staged);
  }, [
    sheetData,
    divisionFilter,
    allDivisionPlayers,
    divisionSubPlayers,
    includeSubs,
    stageBucket,
    seasonStructure,
  ]);

  async function handleImportMissingDrafts() {
    setImportingDrafts(true);
    setSheetError(null);
    try {
      const res = await fetch("/api/admin/import-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId }),
      });
      const json = (await res.json().catch(() => ({}))) as DraftImportSummary & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Import failed (${res.status})`);
      }
      setDraftImportResult(json);
      if (json.imported.length > 0) {
        await loadSheetStats(true);
      }
    } catch (err) {
      setSheetError(
        err instanceof Error ? err.message : "Failed to import missing drafts"
      );
    } finally {
      setImportingDrafts(false);
    }
  }

  async function saveStatsNotice(nextNotice: string | null) {
    setSavingNotice(true);
    setNoticeError(null);
    try {
      const res = await fetch("/api/admin/stats-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice: nextNotice }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        statsNotice?: string | null;
      };
      if (!res.ok) {
        throw new Error(json.error || `Failed (${res.status})`);
      }
      setStatsNotice(json.statsNotice ?? null);
      setNoticeDraft(json.statsNotice ?? "");
    } catch (err) {
      setNoticeError(
        err instanceof Error ? err.message : "Failed to save stats notice"
      );
    } finally {
      setSavingNotice(false);
    }
  }

  const filteredTeams = useMemo(
    () => sortTeamsForStandings(activeTeams, divisionFilter),
    [activeTeams, divisionFilter]
  );

  const overview = useMemo(
    () =>
      sheetData?.precomputed?.overviewByDiv[divisionFilter] ??
      computeDivisionOverview(allDivisionPlayers),
    [sheetData, divisionFilter, allDivisionPlayers]
  );

  const leaderboardPlayers = useMemo(
    () => filteredPlayers.filter((p) => p.games >= 2),
    [filteredPlayers]
  );

  const {
    firstTeamAllPro,
    topRating,
    topKda,
    topKills,
    topAssists,
    lowestDeaths,
    topCs,
    topDpm,
    topGpm,
    topVision,
    topKp,
    topDmgShare,
    topGoldDiff15,
    topSoloKills,
    topFirstBlood,
  } = useMemo(
    () => computePlayerLeaderboards(leaderboardPlayers),
    [leaderboardPlayers]
  );

  const tablePlayers = useMemo(() => {
    const stageScoped =
      stageBucket === "playoffs"
        ? filteredPlayers.filter((p) => p.games > 0)
        : filteredPlayers;
    const roleFiltered =
      roleFilter === "all"
        ? stageScoped
        : stageScoped.filter((p) => p.role === roleFilter);

    return [...roleFiltered].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -999999;
      const bv = (b[sortKey] as number | null) ?? -999999;
      return sortAsc ? av - bv : bv - av;
    });
  }, [filteredPlayers, stageBucket, roleFilter, sortKey, sortAsc]);

  const roleLeaderboardPlayers = useMemo(() => {
    if (roleFilter === "all") return [];
    return filteredPlayers
      .filter((p) => p.role === roleFilter)
      .sort(
        (a, b) =>
          b.leagueRating - a.leagueRating ||
          b.games - a.games ||
          b.kda - a.kda ||
          a.displayName.localeCompare(b.displayName)
      );
  }, [filteredPlayers, roleFilter]);

  const sortColorByPlayerKey = useMemo(
    () => computeSortColors(tablePlayers, sortKey),
    [tablePlayers, sortKey]
  );

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(nextKey);
      setSortAsc(false);
    }
  }

  const missingDataPlayers = useMemo(() => {
    if (!sheetData) return [];
    return allDivisionPlayers.filter((p) => p.games === 0);
  }, [sheetData, allDivisionPlayers]);

  return (
    <div className="space-y-4">
      {/* Admin Controls WinXP Window (Admin View Only) */}
      {isAdminView && (
        <StatsAdminControls
          seasonId={seasonId}
          ddVersion={ddVersion}
          missingTable={missingTable}
          sheetData={sheetData}
          sheetLoading={sheetLoading}
          sheetError={sheetError}
          setSheetError={setSheetError}
          importingDrafts={importingDrafts}
          draftImportResult={draftImportResult}
          setDraftImportResult={setDraftImportResult}
          showIncompleteDetails={showIncompleteDetails}
          setShowIncompleteDetails={setShowIncompleteDetails}
          missingDataPlayers={missingDataPlayers}
          statsNotice={statsNotice}
          noticeDraft={noticeDraft}
          setNoticeDraft={setNoticeDraft}
          savingNotice={savingNotice}
          noticeError={noticeError}
          onOpenUnrosteredModal={() => setShowUnrosteredModal(true)}
          onImportMissingDrafts={() => void handleImportMissingDrafts()}
          onRefreshSheet={() => void loadSheetStats(true)}
          onSaveNotice={(next) => void saveStatsNotice(next)}
        />
      )}

      {/* Modern Consensus-Style League & Division Selectors */}
      <div
        ref={selectorContainerRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {/* League Selector Card */}
        <div className="relative">
          {allSeasons.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((prev) =>
                    prev === "league" ? null : "league"
                  )
                }
                className="w-full text-left rounded-xl border border-white/15 bg-[#151d1a]/95 hover:border-[#c89b3c]/70 px-3.5 py-3 flex items-center justify-between gap-3 transition shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {leagueLogoUrl ? (
                    <img
                      src={leagueLogoUrl}
                      alt={leagueName}
                      className="w-10 h-10 object-contain shrink-0"
                    />
                  ) : (
                    <Award className="w-9 h-9 text-[#f0c020] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e] truncate">
                      {leagueName}
                    </div>
                    <div className="text-sm font-extrabold text-white truncate">
                      {seasonName}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#c89b3c] shrink-0" />
              </button>

              {openDropdown === "league" && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#c89b3c]/60 bg-[#121816] shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1">
                  {allSeasons.map((opt) => {
                    const isSelected =
                      (seasonSlug && opt.slug === seasonSlug) ||
                      (seasonId && opt.id === seasonId);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setOpenDropdown(null);
                          if (!isSelected) {
                            router.push(statsHref(basePath, opt.slug));
                          }
                        }}
                        className={`w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                          isSelected
                            ? "bg-[#2a2210] border border-[#c89b3c]/70 text-[#f0c020]"
                            : "hover:bg-white/5 text-[#e8e5d8]"
                        }`}
                      >
                        {opt.leagueLogoUrl ? (
                          <img
                            src={opt.leagueLogoUrl}
                            alt={opt.leagueName}
                            className="w-7 h-7 object-contain shrink-0"
                          />
                        ) : (
                          <Award className="w-6 h-6 text-[#f0c020] shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase font-bold text-[#a6a89e] truncate">
                            {opt.leagueName}
                          </div>
                          <div className="text-xs font-bold truncate">
                            {opt.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="w-full text-left rounded-xl border border-white/15 bg-[#151d1a]/95 px-3.5 py-3 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                {leagueLogoUrl ? (
                  <img
                    src={leagueLogoUrl}
                    alt={leagueName}
                    className="w-10 h-10 object-contain shrink-0"
                  />
                ) : (
                  <Award className="w-9 h-9 text-[#f0c020] shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e] truncate">
                    {leagueName}
                  </div>
                  <div className="text-sm font-extrabold text-white truncate">
                    {seasonName}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Division Selector Card */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenDropdown((prev) =>
                prev === "division" ? null : "division"
              )
            }
            style={
              selectedDivisionTheme
                ? { borderColor: `${selectedDivisionTheme.primary_color}88` }
                : undefined
            }
            className="w-full text-left rounded-xl border border-white/15 bg-[#151d1a]/95 hover:brightness-110 px-3.5 py-3 flex items-center justify-between gap-3 transition shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedDivision?.logo_url ? (
                <img
                  src={selectedDivision.logo_url}
                  alt={selectedDivision.name}
                  className="w-10 h-10 object-contain shrink-0"
                />
              ) : leagueLogoUrl ? (
                <img
                  src={leagueLogoUrl}
                  alt={leagueName}
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
                    selectedDivisionTheme
                      ? { color: selectedDivisionTheme.accent_text_color }
                      : undefined
                  }
                  className="text-sm font-extrabold text-white truncate"
                >
                  {selectedDivision
                    ? `${selectedDivision.name} (${allDivisionPlayers.length})`
                    : `All Divisions (${activePlayers.length})`}
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#c89b3c] shrink-0" />
          </button>

          {openDropdown === "division" && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#c89b3c]/60 bg-[#121816] shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1">
              {divisions.map((div) => {
                const divTheme = resolveDivisionTheme(
                  div.theme_key,
                  divisionThemes
                );
                const count = activePlayers.filter(
                  (p) => p.divisionId === div.id
                ).length;
                return (
                  <button
                    key={div.id}
                    type="button"
                    onClick={() => {
                      selectDivision(div.id);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                      divisionFilter === div.id
                        ? "bg-white/10 border border-[#c89b3c]/70"
                        : "hover:bg-white/5"
                    }`}
                  >
                    {div.logo_url ? (
                      <img
                        src={div.logo_url}
                        alt={div.name}
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    ) : (
                      <Award className="w-6 h-6 text-[#7cd438] shrink-0" />
                    )}
                    <span
                      style={{ color: divTheme.accent_text_color }}
                      className="text-xs font-extrabold truncate flex-1"
                    >
                      {div.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-[#a6a89e]">
                      {count}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  selectDivision("all");
                  setOpenDropdown(null);
                }}
                className={`w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                  divisionFilter === "all"
                    ? "bg-white/10 border border-[#c89b3c]/70"
                    : "hover:bg-white/5"
                }`}
              >
                {leagueLogoUrl ? (
                  <img
                    src={leagueLogoUrl}
                    alt={leagueName}
                    className="w-7 h-7 object-contain shrink-0"
                  />
                ) : (
                  <Award className="w-6 h-6 text-[#f0c020] shrink-0" />
                )}
                <span className="text-xs font-extrabold text-[#f0ede0] truncate flex-1">
                  All Divisions
                </span>
                <span className="text-[10px] tabular-nums text-[#a6a89e]">
                  {activePlayers.length}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section Toggle Buttons: Players | Teams | Division */}
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            {
              key: "players",
              label: "Players",
              icon: <User className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />,
            },
            {
              key: "teams",
              label: "Teams",
              icon: <TeamGroupIcon className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />,
            },
            {
              key: "division",
              label: "General",
              icon: <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />,
            },
          ] as const
        ).map((sec) => (
          <button
            key={sec.key}
            type="button"
            onClick={() => selectSection(sec.key)}
            className={`xp-btn !py-3 sm:!py-4 !px-2 sm:!px-4 !min-h-[54px] sm:!min-h-[66px] !text-xs sm:!text-lg !gap-1.5 sm:!gap-2.5 font-extrabold uppercase tracking-wider justify-center rounded-xl ${
              activeSection === sec.key ? "xp-btn-primary" : ""
            }`}
          >
            {sec.icon}
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {statsNotice && (
        <div className="xp-panel border border-[#c89b3c]/60 bg-[#2a2210]/85 px-3.5 py-2.5 text-xs text-[#f0ede0] flex items-start gap-2.5">
          <Megaphone className="w-4 h-4 text-[#f0c020] shrink-0 mt-0.5" />
          <span className="leading-relaxed">{statsNotice}</span>
        </div>
      )}

      {!sheetData ? (
        <div className="xp-panel p-8 text-center text-xs text-[#a6a89e] flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#f0c020]" />
          <span>Loading league stats...</span>
        </div>
      ) : (
        <>
        {(activeSection === "players" || activeSection === "teams") &&
          (seasonStructure === "regular_playoffs" ||
            (activeSection === "players" && stagedSubCount > 0)) && (
          <div className="flex flex-wrap items-center justify-between gap-2 xp-panel px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#a6a89e]">
              {seasonStructure === "regular_playoffs"
                ? "Competition Stage"
                : "Player Filter"}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {seasonStructure === "regular_playoffs" && (
                <>
                  <button
                    type="button"
                    onClick={() => setStageBucket("regular")}
                    className={`xp-btn text-xs px-3 py-1 ${
                      stageBucket === "regular" ? "xp-btn-primary" : ""
                    }`}
                  >
                    <span>Regular Season</span>
                    <span className="text-[10px] opacity-80 tabular-nums">
                      ({stageMatchCounts.regular})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStageBucket("playoffs")}
                    className={`xp-btn text-xs px-3 py-1 ${
                      stageBucket === "playoffs" ? "xp-btn-primary" : ""
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Playoffs</span>
                    <span className="text-[10px] opacity-80 tabular-nums">
                      ({stageMatchCounts.playoffs})
                    </span>
                  </button>
                </>
              )}
              {activeSection === "players" && stagedSubCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIncludeSubs((v) => !v)}
                  title="Include unrostered substitute players in leaderboards and player table (separated by role)"
                  className={`xp-btn text-xs px-3 py-1 ${
                    includeSubs ? "xp-btn-primary" : ""
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{includeSubs ? "Subs Included" : "Include Subs"}</span>
                  <span className="text-[10px] opacity-80 tabular-nums">
                    ({stagedSubCount})
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeSection === "players" &&
          showLeaderboards &&
          stageBucket === "playoffs" &&
          !hasPlayoffStats && (
            <div className="xp-panel p-6 text-center text-xs text-[#a6a89e] mb-4">
              No playoff player stats recorded for{" "}
              <strong className="text-[#f0ede0]">
                {selectedDivision?.name ?? "this division"}
              </strong>{" "}
              yet. Switch to Regular Season to view regular season leaderboards.
            </div>
          )}
        {/* Players Section: All Divisions prompt */}
        {activeSection === "players" && !showLeaderboards && (
          <div className="xp-panel p-6 text-center text-xs text-[#a6a89e] mb-6">
            Select a specific division above to view division player leaderboards and rankings.
          </div>
        )}

        {/* First Team All-Pro (Top player per role by Rankr Rating) */}
        {activeSection === "players" &&
          showLeaderboards &&
          firstTeamAllPro.length > 0 && (
            <div
              style={
                selectedDivisionTheme
                  ? {
                      borderColor: `${selectedDivisionTheme.primary_color}66`,
                      borderTopWidth: "3px",
                      borderTopColor: selectedDivisionTheme.primary_color,
                    }
                  : undefined
              }
              className="mb-6 xp-panel overflow-hidden"
            >
              <div
                style={
                  selectedDivisionTheme
                    ? {
                        background: `linear-gradient(90deg, ${selectedDivisionTheme.primary_color}38 0%, #121615 70%)`,
                      }
                    : undefined
                }
                className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[54px] flex flex-wrap items-center justify-between gap-2"
              >
                <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  <span>First Team All-Pro</span>
                </h2>
                <span className="text-[11px] text-[#a6a89e]">
                  Top-rated player per role
                </span>
              </div>

              <div className="p-3">
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-2.5 pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
                  {firstTeamAllPro.map(({ roleMeta, player }) => {
                    const soloEntry = soloPrioMap?.[player.playerKey];
                    const soloPlayerFallback =
                      !soloEntry && players.length > 0
                        ? players.find((p) => p.playerKey === player.playerKey)
                        : undefined;
                    const masteryTop4 =
                      soloEntry?.masteryTop4 ?? soloPlayerFallback?.masteryTop4;

                    const leaguePrio = getPriorityPickRanks(
                      player.topChampions,
                      masteryTop4,
                      "league"
                    );
                    let signatureChamp: string | undefined;
                    for (const [champ, rank] of leaguePrio.entries()) {
                      if (rank === 1) {
                        signatureChamp = champ;
                        break;
                      }
                    }

                    if (!signatureChamp) {
                      if (soloEntry?.soloTopPrioChamp) {
                        signatureChamp = soloEntry.soloTopPrioChamp;
                      } else if (soloPlayerFallback) {
                        const soloChamps = getRoleFilteredSoloChampions(
                          soloPlayerFallback.matches,
                          soloPlayerFallback.role,
                          7
                        );
                        const soloPrio = getPriorityPickRanks(
                          soloChamps,
                          masteryTop4,
                          "solo"
                        );
                        for (const [champ, rank] of soloPrio.entries()) {
                          if (rank === 1) {
                            signatureChamp = champ;
                            break;
                          }
                        }
                      }
                    }

                    if (!signatureChamp) {
                      signatureChamp = player.topChampions[0]?.name;
                    }
                    const cardContent = (
                      <>
                        {signatureChamp && (
                          <img
                            src={getChampionCenteredSplashUrl(signatureChamp)}
                            alt={signatureChamp}
                            fetchPriority="high"
                            className="absolute inset-0 w-full h-full object-cover object-top opacity-70 group-hover:opacity-85 group-hover:scale-105 transition duration-300"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b100e]/90 via-[#0b100e]/40 to-transparent" />

                        <div className="relative z-10 flex items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/65 border border-white/15 text-[10px] font-extrabold uppercase tracking-wider text-[#e8e5d8]">
                            <img
                              src={roleMeta.icon}
                              alt={roleMeta.label}
                              className="w-3.5 h-3.5 object-contain shrink-0"
                            />
                            <span>{roleMeta.label}</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-black/70 border border-[#f0c020]/50 text-[11px] font-black tabular-nums text-[#f0c020]">
                            {player.leagueRating.toFixed(1)}
                          </span>
                        </div>

                        <div className="relative z-10 min-w-0">
                          <div className="font-extrabold text-sm sm:text-base text-white group-hover:text-[#f0c020] transition-colors truncate drop-shadow flex items-center gap-1.5">
                            <span className="truncate">{player.displayName}</span>
                            {player.isSub && (
                              <span className="px-1 py-0.5 rounded bg-black/75 border border-white/25 text-[9px] font-bold uppercase text-[#c7c5b8] shrink-0">
                                SUB
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            {player.teamLogoUrl && (
                              <img
                                src={player.teamLogoUrl}
                                alt={player.teamName}
                                className="w-3.5 h-3.5 object-contain shrink-0"
                              />
                            )}
                            <span className="text-[11px] font-semibold text-[#c7c5b8] truncate">
                              {player.teamName}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                    if (player.isSub) {
                      return (
                        <div
                          key={roleMeta.key}
                          className="relative min-w-[155px] h-[160px] shrink-0 snap-start md:min-w-0 md:h-[180px] rounded-lg border border-white/15 overflow-hidden bg-[#101513] flex flex-col justify-between p-2.5"
                        >
                          {cardContent}
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={roleMeta.key}
                        prefetch={false} href={playerHref(player.playerKey)}
                        className="group relative min-w-[155px] h-[160px] shrink-0 snap-start md:min-w-0 md:h-[180px] rounded-lg border border-white/15 hover:border-[#f0c020]/80 overflow-hidden bg-[#101513] flex flex-col justify-between p-2.5 transition"
                      >
                        {cardContent}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        {/* Stat Leaderboards (Standard 4x3 or Shareable 2x3 with Export Frame) */}
        {activeSection === "players" && showLeaderboards && leaderboardPlayers.length > 0 && (() => {
          const RANKR_RATING_BLURB = [
            "Rankr Rating (0–100) is a role-normalized composite score.",
            "Each player is compared strictly against peers in the same role within the current division using Z-scores across role-specific stats:",
            "• Top: KDA, KP%, Damage/min, CS/min, Gold Diff/game, Solo Kills/game, Turret Dmg/min, Mitigated/min",
            "• Jungle: KDA, KP%, CS/min, Vision/min, Assists/game, Objective Dmg/min, First Blood %",
            "• Mid: KDA, KP%, Damage/min, CS/min, Gold/min, Team Damage %, Solo Kills/game",
            "• Bot (ADC): KDA, KP%, Gold Diff/game, CS/min, Gold/min, Team Damage %, Damage/Gold",
            "• Support: KDA, KP%, Assists/game, Vision/min, First Blood %",
            "Each metric Z-score is clamped to [-2.5, 2.5], averaged, smoothed for <3-game sample sizes, and scaled around 50 (50 + 15 × avgZ × confidence, bounded 10–99) so every role and playstyle is judged on equal footing.",
          ].join("\n");

          type LeaderboardCard = {
            title: string;
            icons?: React.ReactNode;
            rows: AggregatedPlayerStats[];
            fmt: (p: AggregatedPlayerStats) => string;
            onHeaderClick?: () => void;
            headerTooltip?: string;
            copiedBadge?: boolean;
          };

          const ratingCard: LeaderboardCard = {
            title: "Rankr Rating",
            icons: <RankrLogoIcon className="w-6 h-5 text-[#f0c020]" />,
            rows: topRating,
            fmt: (p) => p.leagueRating.toFixed(1),
            headerTooltip: "Click to copy Rankr Rating algorithm summary",
            copiedBadge: copiedRatingBlurb,
            onHeaderClick: () => {
              void navigator.clipboard.writeText(RANKR_RATING_BLURB).then(() => {
                setCopiedRatingBlurb(true);
                setTimeout(() => setCopiedRatingBlurb(false), 2000);
              });
            },
          };

          const kdaCard: LeaderboardCard = {
            title: "KDA",
            icons: <Swords className="w-3.5 h-3.5 text-[#f0c020]" />,
            rows: topKda,
            fmt: (p) => p.kda.toFixed(2),
          };

          const standardGridCards: LeaderboardCard[] = [
            // Row 1 (per min): Gold/min, CS/min, Damage/min, Vision/min
            {
              title: "Gold / Min",
              icons: (
                <>
                  <Coins className="w-3.5 h-3.5 text-[#f0c020]" />
                  <Clock className="w-3.5 h-3.5 text-[#f0c020]" />
                </>
              ),
              rows: topGpm,
              fmt: (p) => Math.round(p.gpm).toString(),
            },
            {
              title: "CS / Min",
              icons: (
                <>
                  <CreepScoreIcon className="w-3.5 h-3.5 text-[#f0c020]" />
                  <Clock className="w-3.5 h-3.5 text-[#f0c020]" />
                </>
              ),
              rows: topCs,
              fmt: (p) => p.csPerMin.toFixed(1),
            },
            {
              title: "Damage / Min",
              icons: (
                <>
                  <Flame className="w-3.5 h-3.5 text-[#f0c020]" />
                  <Clock className="w-3.5 h-3.5 text-[#f0c020]" />
                </>
              ),
              rows: topDpm,
              fmt: (p) => Math.round(p.dpm).toString(),
            },
            {
              title: "Vision / Min",
              icons: (
                <>
                  <Eye className="w-3.5 h-3.5 text-[#f0c020]" />
                  <Clock className="w-3.5 h-3.5 text-[#f0c020]" />
                </>
              ),
              rows: topVision,
              fmt: (p) => p.visionPerMin.toFixed(2),
            },
            // Row 2: Gold Diff @15, First Blood %, Team Damage %, Kill Participation
            ...(topGoldDiff15.length > 0
              ? [
                  {
                    title: "Gold Diff @15",
                    icons: (
                      <>
                        <Coins className="w-3.5 h-3.5 text-[#f0c020]" />
                        <Diff className="w-3.5 h-3.5 text-[#f0c020]" />
                      </>
                    ),
                    rows: topGoldDiff15,
                    fmt: (p: AggregatedPlayerStats) => {
                      const val = Math.round(p.avgGoldDiff15 ?? 0);
                      return val >= 0 ? `+${val}` : `${val}`;
                    },
                  },
                ]
              : []),
            ...(topFirstBlood.length > 0
              ? [
                  {
                    title: "First Blood %",
                    icons: <Droplet className="w-3.5 h-3.5 text-[#f0c020]" />,
                    rows: topFirstBlood,
                    fmt: (p: AggregatedPlayerStats) =>
                      `${(p.firstBloodPct ?? 0).toFixed(0)}%`,
                  },
                ]
              : []),
            {
              title: "Team Damage %",
              icons: (
                <>
                  <TeamGroupIcon className="w-3.5 h-3.5 text-[#f0c020]" />
                  <Flame className="w-3.5 h-3.5 text-[#f0c020]" />
                </>
              ),
              rows: topDmgShare,
              fmt: (p) => `${p.damageSharePct.toFixed(1)}%`,
            },
            {
              title: "Kill Participation",
              icons: (
                <>
                  <TeamGroupIcon className="w-3.5 h-3.5 text-[#f0c020]" />
                  <Sword className="w-3.5 h-3.5 text-[#f0c020]" />
                </>
              ),
              rows: topKp,
              fmt: (p) => `${p.kpPct.toFixed(1)}%`,
            },
            // Row 3: Solo Kills, Kills/Game, Deaths/Game, Assists/Game
            ...(topSoloKills.length > 0
              ? [
                  {
                    title: "Solo Kills",
                    icons: (
                      <>
                        <User className="w-3.5 h-3.5 text-[#f0c020]" />
                        <Sword className="w-3.5 h-3.5 text-[#f0c020]" />
                      </>
                    ),
                    rows: topSoloKills,
                    fmt: (p: AggregatedPlayerStats) => `${p.soloKills}`,
                  },
                ]
              : []),
            {
              title: "Kills / Game",
              icons: <Sword className="w-3.5 h-3.5 text-[#f0c020]" />,
              rows: topKills,
              fmt: (p) => p.killsPerGame.toFixed(1),
            },
            {
              title: "Deaths / Game",
              icons: <Skull className="w-3.5 h-3.5 text-[#f0c020]" />,
              rows: lowestDeaths,
              fmt: (p) => p.deathsPerGame.toFixed(1),
            },
            {
              title: "Assists / Game",
              icons: <Shield className="w-3.5 h-3.5 text-[#f0c020]" />,
              rows: topAssists,
              fmt: (p) => p.assistsPerGame.toFixed(1),
            },
          ];

          const allGridCards: LeaderboardCard[] = [
            kdaCard,
            ...standardGridCards,
          ];

          const selectedShareableCards = shareableCardKeys
            .map((key) =>
              key ? allGridCards.find((c) => c.title === key) : undefined
            )
            .filter((c): c is LeaderboardCard => Boolean(c));

          const availableShareableCards = allGridCards.filter(
            (c) => !shareableCardKeys.includes(c.title)
          );

          function placePillInSlot(
            title: string,
            targetSlot: number,
            fromSlot: number | null
          ) {
            setShareableCardKeys((prev) => {
              const next = [...prev];
              if (fromSlot !== null) {
                const prevTarget = next[targetSlot] ?? null;
                next[targetSlot] = title;
                next[fromSlot] = prevTarget;
              } else {
                const existingIdx = next.indexOf(title);
                if (existingIdx !== -1) {
                  const prevTarget = next[targetSlot] ?? null;
                  next[targetSlot] = title;
                  next[existingIdx] = prevTarget;
                } else {
                  next[targetSlot] = title;
                }
              }
              return next;
            });
          }

          function removePillFromSlot(slotIdx: number) {
            setShareableCardKeys((prev) => {
              const next = [...prev];
              next[slotIdx] = null;
              return next;
            });
          }

          function addPillToFirstEmpty(title: string) {
            setShareableCardKeys((prev) => {
              const emptyIdx = prev.findIndex((k) => k === null);
              if (emptyIdx === -1) return prev;
              const next = [...prev];
              next[emptyIdx] = title;
              return next;
            });
          }

          const renderCard = (card: LeaderboardCard, fullWidth = false) => (
            <div
              key={card.title}
              style={
                selectedDivisionTheme
                  ? {
                      borderColor: `${selectedDivisionTheme.primary_color}66`,
                      backgroundImage: `linear-gradient(135deg, ${selectedDivisionTheme.primary_color}22 0%, rgba(18, 22, 21, 0.94) 65%)`,
                    }
                  : undefined
              }
              className={`xp-panel border-2 border-white/20 overflow-hidden ${
                fullWidth ? "w-full" : "w-[calc(50%-8px)]"
              }`}
            >
              <div
                onClick={card.onHeaderClick}
                title={card.headerTooltip}
                style={
                  selectedDivisionTheme
                    ? {
                        background: `linear-gradient(90deg, ${selectedDivisionTheme.primary_color}45 0%, rgba(22, 24, 21, 0.9) 100%)`,
                        borderBottomColor: `${selectedDivisionTheme.primary_color}70`,
                      }
                    : undefined
                }
                className={`bg-[#2a2210] border-b-2 border-[#c89b3c]/70 px-3 py-1.5 text-[11px] font-bold uppercase text-[#f0c020] flex items-center justify-between gap-2 ${
                  card.onHeaderClick ? "cursor-pointer hover:bg-[#362c16]" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{card.title}</span>
                  {card.copiedBadge && !exportingLeaderboard && (
                    <span className="text-[9px] text-[#7cd438] normal-case font-semibold">
                      Copied!
                    </span>
                  )}
                </span>
                {card.icons && (
                  <span className="inline-flex items-center gap-1 shrink-0">
                    {card.icons}
                  </span>
                )}
              </div>
              <div className="divide-y divide-white/10">
                {card.rows.map((p, idx) => {
                  const rowInner = (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] tabular-nums text-[#a6a89e] w-3">
                          {idx + 1}
                        </span>
                        {p.isSub ? (
                          <img
                            src={getRoleMeta(p.role as LeagueRole).icon}
                            alt={getRoleMeta(p.role as LeagueRole).label}
                            crossOrigin="anonymous"
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        ) : p.teamLogoUrl ? (
                          <img
                            src={p.teamLogoUrl}
                            alt={p.teamName}
                            crossOrigin="anonymous"
                            className="w-4 h-4 object-contain shrink-0"
                          />
                        ) : null}
                        <span className="font-bold text-[#f0ede0] truncate">
                          {p.displayName}
                        </span>
                        {p.isSub && (
                          <span className="px-1 py-0.5 rounded bg-black/60 border border-white/20 text-[9px] font-bold uppercase text-[#a6a89e] shrink-0">
                            SUB
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums font-bold text-[#7cd438] shrink-0">
                        {card.fmt(p)}
                      </span>
                    </>
                  );
                  return p.isSub ? (
                    <div
                      key={p.playerKey}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
                    >
                      {rowInner}
                    </div>
                  ) : (
                    <Link
                      key={p.playerKey}
                      prefetch={false} href={playerHref(p.playerKey)}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-white/5 transition"
                    >
                      {rowInner}
                    </Link>
                  );
                })}
              </div>
            </div>
          );

          const cardBorderColor =
            selectedDivisionTheme?.primary_color ?? "#c89b3c";

          const featuredRatingCard = (
            <div
              className="max-w-[480px] mx-auto rounded-lg border-2 border-[#f0c020] overflow-hidden bg-[#171b19]"
              style={{
                boxShadow: "0 0 20px rgba(240, 192, 32, 0.22)",
                ...(selectedDivisionTheme
                  ? {
                      backgroundImage: `linear-gradient(135deg, ${selectedDivisionTheme.primary_color}38 0%, rgba(23, 27, 25, 0.94) 65%)`,
                    }
                  : {}),
              }}
            >
              <div
                onClick={ratingCard.onHeaderClick}
                title={ratingCard.headerTooltip}
                style={
                  selectedDivisionTheme
                    ? {
                        background: `linear-gradient(90deg, ${selectedDivisionTheme.primary_color}55 0%, rgba(42, 34, 16, 0.92) 100%)`,
                      }
                    : undefined
                }
                className="bg-[#2a2210] border-b-2 border-[#f0c020] px-4 sm:px-5 py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center justify-between gap-2 cursor-pointer hover:brightness-110 transition"
              >
                <span className="inline-flex items-center gap-2">
                  <span>{ratingCard.title}</span>
                  {ratingCard.copiedBadge && !exportingLeaderboard && (
                    <span className="text-[10px] text-[#7cd438] normal-case font-semibold">
                      Copied!
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  {ratingCard.icons}
                </span>
              </div>
              <div className="divide-y divide-[#f0c020]/15">
                {(() => {
                  const topRatingDisplay = ratingCard.rows[0]
                    ? ratingCard.fmt(ratingCard.rows[0])
                    : null;
                  return ratingCard.rows.map((p) => {
                    const isLeader =
                      topRatingDisplay !== null &&
                      ratingCard.fmt(p) === topRatingDisplay;
                    const ratingInner = (
                      <>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <span
                            className={`text-sm sm:text-base font-extrabold tabular-nums w-4 sm:w-5 text-center ${
                              isLeader ? "text-[#f0c020]" : "text-[#c89b3c]"
                            }`}
                          >
                            {ratingCard.rows.indexOf(p) + 1}
                          </span>
                          {p.isSub ? (
                            <img
                              src={getRoleMeta(p.role as LeagueRole).icon}
                              alt={getRoleMeta(p.role as LeagueRole).label}
                              crossOrigin="anonymous"
                              className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
                            />
                          ) : p.teamLogoUrl ? (
                            <img
                              src={p.teamLogoUrl}
                              alt={p.teamName}
                              crossOrigin="anonymous"
                              className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
                            />
                          ) : null}
                          <span
                            className={`text-sm sm:text-base font-extrabold truncate flex items-center gap-1.5 ${
                              isLeader ? "text-[#fff4cc]" : "text-[#f0ede0]"
                            }`}
                          >
                            <span className="truncate">{p.displayName}</span>
                            {p.isSub && (
                              <span className="px-1 py-0.5 rounded bg-black/60 border border-white/20 text-[9px] font-bold uppercase text-[#a6a89e] shrink-0">
                                SUB
                              </span>
                            )}
                            {isLeader && (
                              <Crown className="w-4 h-4 text-[#f0c020] shrink-0 drop-shadow-[0_0_6px_rgba(240,192,32,0.75)]" />
                            )}
                          </span>
                        </div>
                        <span
                          className={`font-black text-base sm:text-lg tabular-nums shrink-0 ${
                            isLeader ? "text-[#f0c020]" : "text-[#7cd438]"
                          }`}
                        >
                          {ratingCard.fmt(p)}
                        </span>
                      </>
                    );
                    return p.isSub ? (
                      <div
                        key={p.playerKey}
                        className={`px-4 sm:px-5 py-2 flex items-center justify-between gap-3 ${
                          isLeader ? "bg-[#f0c020]/10" : ""
                        }`}
                      >
                        {ratingInner}
                      </div>
                    ) : (
                      <Link
                        key={p.playerKey}
                        prefetch={false} href={playerHref(p.playerKey)}
                        className={`px-4 sm:px-5 py-2 flex items-center justify-between gap-3 transition hover:bg-[#f0c020]/10 ${
                          isLeader ? "bg-[#f0c020]/10" : ""
                        }`}
                      >
                        {ratingInner}
                      </Link>
                    );
                  });
                })()}
              </div>
            </div>
          );

          return (
            <div
              style={
                selectedDivisionTheme
                  ? {
                      borderColor: `${selectedDivisionTheme.primary_color}66`,
                      borderTopWidth: "3px",
                      borderTopColor: selectedDivisionTheme.primary_color,
                    }
                  : undefined
              }
              className="mb-6 xp-panel overflow-hidden"
            >
              {/* Leaderboards Header Bar: Standard (4x3) vs Shareable (2x3 + Export Frame) */}
              <div
                style={
                  selectedDivisionTheme
                    ? {
                        background: `linear-gradient(90deg, ${selectedDivisionTheme.primary_color}38 0%, #121615 70%)`,
                      }
                    : undefined
                }
                className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2"
              >
                <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  <span>Stat Leaderboards</span>
                </h2>
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded border border-white/15">
                  <button
                    type="button"
                    onClick={() => setLeaderboardStyle("standard")}
                    className={`xp-btn text-xs px-3 py-1 ${
                      leaderboardStyle === "standard" ? "xp-btn-primary" : ""
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardStyle("shareable")}
                    className={`xp-btn text-xs px-3 py-1 ${
                      leaderboardStyle === "shareable" ? "xp-btn-primary" : ""
                    }`}
                  >
                    Shareable
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-4">

              {leaderboardStyle === "standard" ? (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 lg:gap-8 py-2">
                    <div className="w-full md:flex-1 max-w-[460px]">
                      {featuredRatingCard}
                    </div>
                    <div className="w-full sm:max-w-[270px] md:w-[240px] lg:w-[270px] md:shrink-0">
                      {renderCard(kdaCard, true)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {standardGridCards.map((card, idx) => (
                      <div
                        key={card.title}
                        className={
                          !showAllLeaderboardCards && idx >= 5
                            ? "hidden sm:block"
                            : undefined
                        }
                      >
                        {renderCard(card, true)}
                      </div>
                    ))}
                  </div>
                  {standardGridCards.length > 5 && (
                    <div className="sm:hidden flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllLeaderboardCards((prev) => !prev)
                        }
                        className="xp-btn text-xs px-4 py-1.5 flex items-center gap-1.5"
                      >
                        <span>
                          {showAllLeaderboardCards
                            ? "Show Fewer Stats"
                            : `Show All ${standardGridCards.length + 2} Stat Cards (${standardGridCards.length - 5} more)`}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            showAllLeaderboardCards ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mini 2x3 Drag-and-Drop Array + Stat Pill Tray + Reset / Export PNG */}
                  <div className="xp-panel p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1 min-w-0">
                      <div className="space-y-1.5 shrink-0 sm:w-[270px]">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#c7c5b8]">
                          Shareable 2×3 Layout (
                          <strong className="text-[#f0c020]">
                            {selectedShareableCards.length}/6
                          </strong>
                          )
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 bg-black/35 p-2 rounded border border-white/10">
                          {shareableCardKeys.map((slotKey, slotIdx) => {
                            const isOver = dragOverSlot === slotIdx;
                            return (
                              <div
                                key={slotIdx}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (dragOverSlot !== slotIdx) {
                                    setDragOverSlot(slotIdx);
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dragOverSlot === slotIdx) {
                                    setDragOverSlot(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverSlot(null);
                                  if (draggedPill) {
                                    placePillInSlot(
                                      draggedPill.title,
                                      slotIdx,
                                      draggedPill.fromSlot
                                    );
                                    setDraggedPill(null);
                                  }
                                }}
                                className={`min-h-[30px] rounded border flex items-center justify-between gap-1 px-1.5 py-1 transition ${
                                  isOver
                                    ? "border-[#f0c020] bg-[#f0c020]/15"
                                    : slotKey
                                    ? "border-[#c89b3c]/60 bg-[#1b221e]"
                                    : "border-dashed border-white/20 bg-black/30"
                                }`}
                              >
                                {slotKey ? (
                                  <>
                                    <div
                                      draggable
                                      onDragStart={() =>
                                        setDraggedPill({
                                          title: slotKey,
                                          fromSlot: slotIdx,
                                        })
                                      }
                                      onDragEnd={() => {
                                        setDraggedPill(null);
                                        setDragOverSlot(null);
                                      }}
                                      title="Drag to swap slots or drag out to remove"
                                      className="text-[10px] font-bold text-[#f0ede0] truncate cursor-grab active:cursor-grabbing flex-1"
                                    >
                                      {slotKey}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removePillFromSlot(slotIdx)
                                      }
                                      title="Remove from slot"
                                      className="text-[#a6a89e] hover:text-[#ff857a] shrink-0 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[9px] text-[#7c8078] mx-auto select-none">
                                    Slot {slotIdx + 1}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedPill && draggedPill.fromSlot !== null) {
                            removePillFromSlot(draggedPill.fromSlot);
                          }
                          setDraggedPill(null);
                          setDragOverSlot(null);
                        }}
                        className="space-y-1.5 flex-1 min-w-0"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#c7c5b8]">
                          Available Stat Cards - Drag and Drop
                        </div>
                        <div className="flex flex-wrap gap-1.5 p-2 rounded border border-white/10 bg-black/25 min-h-[58px] items-start content-start">
                          {availableShareableCards.length > 0 ? (
                            availableShareableCards.map((card) => (
                              <button
                                key={card.title}
                                type="button"
                                draggable
                                onDragStart={() =>
                                  setDraggedPill({
                                    title: card.title,
                                    fromSlot: null,
                                  })
                                }
                                onDragEnd={() => {
                                  setDraggedPill(null);
                                  setDragOverSlot(null);
                                }}
                                onClick={() => addPillToFirstEmpty(card.title)}
                                title="Drag into a 2×3 slot, or click to fill next empty slot"
                                className="xp-btn text-[10px] px-2 py-1 cursor-grab active:cursor-grabbing"
                              >
                                {card.title}
                              </button>
                            ))
                          ) : (
                            <span className="text-[10px] text-[#7c8078] italic">
                              All available stats placed or drag a slot pill here
                              to remove it.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setShareableCardKeys(DEFAULT_SHAREABLE_CARD_KEYS)
                        }
                        title="Reset to default 2×3 layout"
                        className="xp-btn text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleExportLeaderboardPng()}
                        disabled={exportingLeaderboard}
                        className="xp-btn xp-btn-gold text-xs disabled:opacity-50 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>
                          {exportingLeaderboard ? "Exporting..." : "Export PNG"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="max-w-[800px] mx-auto w-full">
                    <ScaledGraphicFrame designWidth={800}>
                      <div ref={leaderboardCardRef} className="w-[800px] p-2.5">
                        <div
                          style={{ borderRadius: "44px" }}
                          className={`w-full border-[6px] border-[#c89b3c]/85 rounded-[44px] overflow-hidden bg-[#171b19] ${
                            exportingLeaderboard ? "" : "shadow-2xl"
                          }`}
                        >
                          {/* Graphic Header Banner */}
                          <div
                            style={{ background: bannerGradient }}
                            className="border-b-2 border-[#4d5652] text-white flex flex-row items-center justify-between gap-4 px-7 py-5"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              {leagueLogoUrl && (
                                <img
                                  src={leagueLogoUrl}
                                  alt={leagueName}
                                  crossOrigin="anonymous"
                                  className="w-16 h-12 object-contain drop-shadow shrink-0"
                                />
                              )}
                              {selectedDivision?.logo_url && (
                                <img
                                  src={selectedDivision.logo_url}
                                  alt={selectedDivision.name}
                                  crossOrigin="anonymous"
                                  className="w-12 h-12 object-contain drop-shadow shrink-0"
                                />
                              )}
                              <div>
                                <div className="text-xs uppercase tracking-wider font-bold text-[#f0c020]">
                                  {leagueName} ({seasonName})
                                </div>
                                <h2 className="wow-heading text-2xl font-extrabold text-white leading-tight">
                                  Stat Leaderboards
                                </h2>
                                <div className="text-xs font-bold text-[#c7c5b8] mt-0.5">
                                  {selectedDivision
                                    ? selectedDivision.name
                                    : "League"}{" "}
                                  &middot;{" "}
                                  {exportSubtitle}
                                </div>
                              </div>
                            </div>
                            <Trophy className="w-10 h-10 text-[#c89b3c] opacity-90 drop-shadow shrink-0" />
                          </div>

                          {/* Card Body: Rankr Rating + 2x3 Selected Cards */}
                          <div className="px-5 py-5 bg-[#171b19]">
                            <div className="space-y-4">
                              {featuredRatingCard}
                              <div className="flex flex-wrap justify-center gap-4">
                                {selectedShareableCards.map((c) =>
                                  renderCard(c, false)
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScaledGraphicFrame>
                  </div>
                </div>
              )}
              </div>
            </div>
          );
        })()}

        {/* Division Section: 10 Overview Cards + Champions Played & Most Banned */}
        {activeSection === "division" && (
          <StatsDivisionTab
            overview={overview}
            ddVersion={ddVersion}
            kpiCardStyle={kpiCardStyle}
            selectedDivisionPrimaryColor={selectedDivisionTheme?.primary_color}
            selectedDivisionSlug={selectedDivision?.slug ?? null}
            seasonSlug={seasonSlug}
            basePath={basePath}
          />
        )}

        {/* Full Players Leaderboard (Sortable + Role Filter) */}
        {activeSection === "players" &&
          showLeaderboards &&
          leaderboardPlayers.length === 0 &&
          (stageBucket !== "playoffs" || hasPlayoffStats) && (
            <div className="xp-panel p-6 text-center text-xs text-[#a6a89e] mb-4">
              No player match stats recorded for{" "}
              <strong className="text-[#f0ede0]">
                {selectedDivision?.name ?? "this division"}
              </strong>{" "}
              yet.
            </div>
          )}

        {activeSection === "players" &&
          showLeaderboards &&
          leaderboardPlayers.length > 0 && (
          <StatsPlayersTab
            ddVersion={ddVersion}
            selectedDivisionTheme={selectedDivisionTheme}
            roleFilter={roleFilter}
            onSelectRoleFilter={setRoleFilter}
            sortKey={sortKey}
            onSort={handleSort}
            tablePlayers={tablePlayers}
            sortColorByPlayerKey={sortColorByPlayerKey}
            roleLeaderboardPlayers={roleLeaderboardPlayers}
            exportingRoleLeaderboard={exportingRoleLeaderboard}
            onExportRoleLeaderboardPng={handleExportRoleLeaderboardPng}
            showAllPlayers={showAllPlayers}
            onToggleShowAllPlayers={() => setShowAllPlayers((prev) => !prev)}
            onNavigatePlayer={(playerKey) =>
              router.push(playerHref(playerKey))
            }
          />
        )}

        {/* Teams Standings / Playoff Bracket */}
        {activeSection === "teams" && (
          <StatsTeamsTab
            selectedDivision={selectedDivision}
            divisions={divisions}
            divisionThemes={divisionThemes}
            filteredTeams={filteredTeams}
            activeTeams={activeTeams}
            basePath={basePath}
            seasonSlug={seasonSlug}
            stageBucket={stageBucket}
            playoffSeries={sheetData?.playoffSeries ?? []}
            playoffBracket={
              selectedDivision
                ? playoffBrackets?.[selectedDivision.id] ?? null
                : null
            }
            onNavigateTeam={(href) => router.push(href)}
          />
        )}
        </>
      )}

      <StatsDataCredits
        leagueName={leagueName}
        seasonName={seasonName}
        variant="full"
      />

      {isAdminView && showUnrosteredModal && sheetData && (
        <StatsUnrosteredModal
          unrosteredPlayers={sheetData.unrosteredPlayers}
          onClose={() => setShowUnrosteredModal(false)}
        />
      )}

      {roleFilter !== "all" && roleLeaderboardPlayers.length > 0 && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none">
          <div ref={roleExportCardRef} className="w-[680px] p-2.5">
            <RoleLeaderboardExportCard
              role={roleFilter}
              players={roleLeaderboardPlayers}
              leagueName={leagueName}
              leagueLogoUrl={leagueLogoUrl}
              seasonName={seasonName}
              divisionName={selectedDivision?.name ?? "League"}
              divisionLogoUrl={selectedDivision?.logo_url ?? null}
              currentEditionName={currentEditionName}
              subtitleSuffix={exportSubtitle}
              bannerGradient={bannerGradient}
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { StatsDataCredits } from "@/components/stats/StatsDataCredits";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Crown,
  Diff,
  Download,
  Droplet,
  Eye,
  Flame,
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
import { RetroWindow } from "@/components/RetroWindow";
import { RankrLogoIcon } from "@/components/RankrLogoIcon";
import { ScaledGraphicFrame } from "@/components/ScaledGraphicFrame";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { StatsDivisionTab } from "@/components/stats/StatsDivisionTab";
import { StatsTeamsTab } from "@/components/stats/StatsTeamsTab";
import { StatsUnrosteredModal } from "@/components/stats/StatsUnrosteredModal";
import { RoleLeaderboardExportCard } from "@/components/stats/RoleLeaderboardExportCard";
import { getChampionCenteredSplashUrl, getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import {
  computeRoleNormalizedRatings,
  formatMinutesSeconds,
  getPriorityPickRanks,
  getRoleFilteredSoloChampions,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
} from "@/utils/riotStatsAggregation";
import type { SoloPrioEntry } from "@/utils/riotStatsServer";
import type { UnrosteredSheetPlayer } from "@/utils/scdlSheetStats";

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
  currentEditionName: string;
  divisions: DivisionItem[];
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
  soloPrioMap?: Record<string, SoloPrioEntry>;
  isAdminView?: boolean;
  initialDivision?: string;
  initialTab?: "players" | "teams" | "division";
  initialSheetData?: {
    players: AggregatedPlayerStats[];
    teams: AggregatedTeamStats[];
    unrosteredPlayers?: UnrosteredSheetPlayer[];
    missingDraftGames?: { gameId: string; matchLabel: string }[];
    fetchedAt: string;
    rowCount: number;
    matchCount: number;
  } | null;
}

type SortKey =
  | "leagueRating"
  | "avgGoldDiff15"
  | "kda"
  | "dpm"
  | "gpm"
  | "csPerMin"
  | "kpPct"
  | "visionPerMin"
  | "damageSharePct"
  | "games";

const MIGRATION_SQL = `create table if not exists public.riot_player_stats (
  player_key text primary key,
  riot_id text not null,
  puuid text,
  season_id uuid references public.seasons(id) on delete set null,
  division_id uuid references public.divisions(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  role text,
  solo_tier text,
  solo_rank text,
  solo_lp integer,
  solo_wins integer,
  solo_losses integer,
  matches jsonb not null default '[]'::jsonb,
  sync_error text,
  synced_at timestamptz not null default now()
);
alter table public.riot_player_stats enable row level security;
create policy "Admins can manage riot_player_stats" on public.riot_player_stats for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));`;

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
  currentEditionName,
  divisions,
  players,
  teams,
  soloPrioMap,
  isAdminView = true,
  initialDivision,
  initialTab,
  initialSheetData = null,
}: StatsDashboardProps) {
  const router = useRouter();
  const basePath = isAdminView ? "/admin/stats" : "/stats";
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
    teams: AggregatedTeamStats[];
    unrosteredPlayers: UnrosteredSheetPlayer[];
    missingDraftGames: { gameId: string; matchLabel: string }[];
    fetchedAt: string;
    rowCount: number;
    matchCount: number;
  } | null>(
    initialSheetData
      ? {
          ...initialSheetData,
          unrosteredPlayers: initialSheetData.unrosteredPlayers ?? [],
          missingDraftGames: initialSheetData.missingDraftGames ?? [],
        }
      : null
  );
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
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
        ? resolveDivisionTheme(selectedDivision.theme_key)
        : null,
    [selectedDivision]
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

  const showLeaderboards =
    divisions.length <= 1 || selectedDivision !== null;

  async function handleExportLeaderboardPng() {
    if (!leaderboardCardRef.current) return;
    setExportingLeaderboard(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const exportHeight = Math.ceil(leaderboardCardRef.current.offsetHeight);
      const dataUrl = await toPng(leaderboardCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 800,
        height: exportHeight,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const divPart = selectedDivision?.slug || "league";
      link.download = `${divPart}-scdl-leaderboards.png`
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
      const dataUrl = await toPng(roleExportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 800,
        height: exportHeight,
        style: { margin: "0" },
      });
      const link = document.createElement("a");
      const divPart = selectedDivision?.slug || "league";
      link.download = `${divPart}-${roleFilter}-leaderboard.png`
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
      const res = await fetch("/api/admin/scdl-sheet-stats", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        players?: AggregatedPlayerStats[];
        teams?: AggregatedTeamStats[];
        unrosteredPlayers?: UnrosteredSheetPlayer[];
        missingDraftGames?: { gameId: string; matchLabel: string }[];
        fetchedAt?: string;
        rowCount?: number;
        matchCount?: number;
      };
      if (!res.ok || !json.players || !json.teams) {
        throw new Error(json.error || `Sheet load failed (${res.status})`);
      }
      setSheetData({
        players: json.players,
        teams: json.teams,
        unrosteredPlayers: json.unrosteredPlayers ?? [],
        missingDraftGames: json.missingDraftGames ?? [],
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

  const filteredPlayers = useMemo(() => {
    const scoped = activePlayers.filter((p) =>
      divisionFilter === "all" ? true : p.divisionId === divisionFilter
    );
    return computeRoleNormalizedRatings(scoped);
  }, [activePlayers, divisionFilter]);

  const filteredTeams = useMemo(() => {
    return activeTeams
      .filter((t) =>
        divisionFilter === "all" ? true : t.divisionId === divisionFilter
      )
      .sort((a, b) => {
        if (a.seed != null && b.seed != null && a.seed !== b.seed) {
          return a.seed - b.seed;
        }
        const aSeriesDiff =
          (a.seriesWins ?? a.wins) -
          (a.seriesLosses ?? Math.max(0, a.games - a.wins));
        const bSeriesDiff =
          (b.seriesWins ?? b.wins) -
          (b.seriesLosses ?? Math.max(0, b.games - b.wins));
        return (
          bSeriesDiff - aSeriesDiff ||
          b.winRate - a.winRate ||
          b.avgKda - a.avgKda
        );
      });
  }, [activeTeams, divisionFilter]);

  const overview = useMemo(() => {
    const allMatches = filteredPlayers.flatMap((p) => p.matches);

    const uniqueMatchMap = new Map<string, typeof allMatches[number]>();
    const uniqueSideMap = new Map<string, typeof allMatches[number]>();
    for (const m of allMatches) {
      if (!uniqueMatchMap.has(m.matchId)) uniqueMatchMap.set(m.matchId, m);
      const sideKey = `${m.matchId}::${m.teamId}`;
      if (!uniqueSideMap.has(sideKey)) uniqueSideMap.set(sideKey, m);
    }

    const totalGames = uniqueMatchMap.size;

    const durationSource = [...uniqueMatchMap.values()];
    const avgDurationMin =
      durationSource.length > 0
        ? durationSource.reduce((s, m) => s + m.gameDuration, 0) /
          60 /
          durationSource.length
        : 0;

    const sideSource = [...uniqueSideMap.values()];
    const avgKillsPerGame =
      sideSource.length > 0
        ? sideSource.reduce((s, m) => s + (m.teamKills || m.kills), 0) /
          sideSource.length
        : 0;

    const blueGames = sideSource.filter((m) => m.teamId === 100);
    const redGames = sideSource.filter((m) => m.teamId === 200);
    const blueWr =
      blueGames.length > 0
        ? (blueGames.filter((m) => m.win).length / blueGames.length) * 100
        : 50;
    const redWr =
      redGames.length > 0
        ? (redGames.filter((m) => m.win).length / redGames.length) * 100
        : 50;

    const champMap = new Map<string, { games: number; wins: number }>();
    const banMap = new Map<string, number>();
    const seenBanMatches = new Set<string>();
    for (const m of allMatches) {
      const c = champMap.get(m.championName) ?? { games: 0, wins: 0 };
      c.games += 1;
      if (m.win) c.wins += 1;
      champMap.set(m.championName, c);

      if (
        Array.isArray(m.bans) &&
        m.bans.length > 0 &&
        !seenBanMatches.has(m.matchId)
      ) {
        seenBanMatches.add(m.matchId);
        for (const banned of m.bans) {
          banMap.set(banned, (banMap.get(banned) ?? 0) + 1);
        }
      }
    }

    const champs = [...champMap.entries()]
      .map(([name, val]) => ({
        name,
        games: val.games,
        wins: val.wins,
        winRate: (val.wins / val.games) * 100,
      }))
      .sort((a, b) => b.games - a.games || b.winRate - a.winRate);

    const banMatchCount = seenBanMatches.size;
    const bannedChamps = [...banMap.entries()]
      .map(([name, bans]) => ({
        name,
        bans,
        banRate:
          banMatchCount > 0 ? Math.min(100, (bans / banMatchCount) * 100) : 0,
      }))
      .sort((a, b) => b.bans - a.bans || a.name.localeCompare(b.name));

    // Flash on D vs F
    let flashDPicks = 0;
    let flashDWins = 0;
    let flashFPicks = 0;
    let flashFWins = 0;
    for (const m of allMatches) {
      if (m.flashKey === "D") {
        flashDPicks += 1;
        if (m.win) flashDWins += 1;
      } else if (m.flashKey === "F") {
        flashFPicks += 1;
        if (m.win) flashFWins += 1;
      }
    }

    // First Blood team win rate & @15 gold lead team win rate
    const teamMatchMeta = new Map<
      string,
      { win: boolean; hasFb: boolean; gd15Sum: number; hasGd15: boolean }
    >();
    for (const m of allMatches) {
      const key = `${m.matchId}::${m.teamId}`;
      const cur = teamMatchMeta.get(key) ?? {
        win: m.win,
        hasFb: false,
        gd15Sum: 0,
        hasGd15: false,
      };
      if (m.firstBlood) cur.hasFb = true;
      if (typeof m.goldDiff15 === "number" && Number.isFinite(m.goldDiff15)) {
        cur.gd15Sum += m.goldDiff15;
        cur.hasGd15 = true;
      }
      teamMatchMeta.set(key, cur);
    }
    const fbTeams = [...teamMatchMeta.values()].filter((t) => t.hasFb);
    const fbWr =
      fbTeams.length > 0
        ? (fbTeams.filter((t) => t.win).length / fbTeams.length) * 100
        : null;

    const gd15AheadTeams = [...teamMatchMeta.values()].filter(
      (t) => t.hasGd15 && t.gd15Sum > 0
    );
    const gd15Wr =
      gd15AheadTeams.length > 0
        ? (gd15AheadTeams.filter((t) => t.win).length / gd15AheadTeams.length) *
          100
        : null;

    // Longest game with teams / result / week
    let longestGame: {
      durationMin: number;
      winner: string;
      loser: string;
      roundLabel: string;
    } | null = null;
    for (const m of durationSource) {
      if (
        m.gameDuration > 0 &&
        (!longestGame || m.gameDuration / 60 > longestGame.durationMin)
      ) {
        const gameRows = allMatches.filter((x) => x.matchId === m.matchId);
        const winTeam =
          gameRows.find((x) => x.win)?.teamName ??
          (m.matchLabel ? m.matchLabel.split("_")[1] : "");
        const loseTeam =
          gameRows.find((x) => !x.win)?.teamName ??
          (m.matchLabel ? m.matchLabel.split("_")[2] : "");
        const rawRound = m.matchLabel ? m.matchLabel.split("_")[0] : "";
        const roundLabel = rawRound
          ? rawRound.replace(/([a-zA-Z]+)(\d+)/, "$1 $2")
          : "";
        longestGame = {
          durationMin: m.gameDuration / 60,
          winner: winTeam || "Winner",
          loser: loseTeam || "Opponent",
          roundLabel,
        };
      }
    }

    // Most Toxic?, Most Pentakills, Most Objective Steals, Control Wards / Min
    type PlayerKpiLeader = {
      name: string;
      count: number;
      teamName: string;
      teamLogoUrl?: string | null;
    };
    let topPingPlayer: PlayerKpiLeader | null = null;
    let topPentaPlayer: PlayerKpiLeader | null = null;
    let topStealPlayer: PlayerKpiLeader | null = null;
    for (const p of filteredPlayers) {
      const pings = p.matches.reduce((s, m) => s + (m.questionPings ?? 0), 0);
      if (pings > 0 && (!topPingPlayer || pings > topPingPlayer.count)) {
        topPingPlayer = {
          name: p.displayName,
          count: pings,
          teamName: p.teamName,
          teamLogoUrl: p.teamLogoUrl,
        };
      }
      const pentas = p.matches.reduce((s, m) => s + (m.pentaKills ?? 0), 0);
      if (pentas > 0 && (!topPentaPlayer || pentas > topPentaPlayer.count)) {
        topPentaPlayer = {
          name: p.displayName,
          count: pentas,
          teamName: p.teamName,
          teamLogoUrl: p.teamLogoUrl,
        };
      }
      const steals = p.matches.reduce(
        (s, m) => s + (m.objectivesStolen ?? 0),
        0
      );
      if (steals > 0 && (!topStealPlayer || steals > topStealPlayer.count)) {
        topStealPlayer = {
          name: p.displayName,
          count: steals,
          teamName: p.teamName,
          teamLogoUrl: p.teamLogoUrl,
        };
      }
    }

    let totalControlWards = 0;
    for (const m of allMatches) {
      totalControlWards += m.controlWardsBought ?? 0;
    }
    const totalGameMinutes = durationSource.reduce(
      (s, m) => s + m.gameDuration / 60,
      0
    );
    const controlWardsPerMin =
      totalGameMinutes > 0 ? totalControlWards / totalGameMinutes : 0;

    return {
      totalGames,
      avgDurationMin,
      avgKillsPerGame,
      uniqueChamps: champs.length,
      blueWr,
      redWr,
      champs,
      bannedChamps,
      flashDPicks,
      flashDWr: flashDPicks > 0 ? (flashDWins / flashDPicks) * 100 : 0,
      flashFPicks,
      flashFWr: flashFPicks > 0 ? (flashFWins / flashFPicks) * 100 : 0,
      fbWr,
      fbGames: fbTeams.length,
      gd15Wr,
      gd15Games: gd15AheadTeams.length,
      longestGame,
      topPingPlayer,
      topPentaPlayer,
      topStealPlayer,
      totalControlWards,
      controlWardsPerMin,
    };
  }, [filteredPlayers]);

  const leaderboardPlayers = useMemo(
    () => filteredPlayers.filter((p) => p.games > 0),
    [filteredPlayers]
  );

  const firstTeamAllPro = useMemo(
    () =>
      LEAGUE_ROLES.map((roleDef) => {
        const candidates = leaderboardPlayers
          .filter((p) => p.role === roleDef.key)
          .sort((a, b) => b.leagueRating - a.leagueRating);
        return candidates[0]
          ? { roleMeta: roleDef, player: candidates[0] }
          : null;
      }).filter(
        (
          x
        ): x is {
          roleMeta: (typeof LEAGUE_ROLES)[number];
          player: AggregatedPlayerStats;
        } => Boolean(x)
      ),
    [leaderboardPlayers]
  );

  const topRating = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => b.leagueRating - a.leagueRating)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topKda = useMemo(
    () =>
      [...leaderboardPlayers].sort((a, b) => b.kda - a.kda).slice(0, 5),
    [leaderboardPlayers]
  );
  const topKills = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => b.killsPerGame - a.killsPerGame)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topAssists = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => b.assistsPerGame - a.assistsPerGame)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const lowestDeaths = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => a.deathsPerGame - b.deathsPerGame)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topCs = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => b.csPerMin - a.csPerMin)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topDpm = useMemo(
    () =>
      [...leaderboardPlayers].sort((a, b) => b.dpm - a.dpm).slice(0, 5),
    [leaderboardPlayers]
  );
  const topGpm = useMemo(
    () =>
      [...leaderboardPlayers].sort((a, b) => b.gpm - a.gpm).slice(0, 5),
    [leaderboardPlayers]
  );
  const topVision = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => b.visionPerMin - a.visionPerMin)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topKp = useMemo(
    () =>
      [...leaderboardPlayers].sort((a, b) => b.kpPct - a.kpPct).slice(0, 5),
    [leaderboardPlayers]
  );
  const topDmgShare = useMemo(
    () =>
      [...leaderboardPlayers]
        .sort((a, b) => b.damageSharePct - a.damageSharePct)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topGoldDiff15 = useMemo(
    () =>
      leaderboardPlayers
        .filter(
          (p) => p.avgGoldDiff15 !== null && p.avgGoldDiff15 !== undefined
        )
        .sort((a, b) => (b.avgGoldDiff15 ?? 0) - (a.avgGoldDiff15 ?? 0))
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topSoloKills = useMemo(
    () =>
      leaderboardPlayers
        .filter((p) => p.hasSoloKillsData)
        .sort((a, b) => b.soloKills - a.soloKills)
        .slice(0, 5),
    [leaderboardPlayers]
  );
  const topFirstBlood = useMemo(
    () =>
      leaderboardPlayers
        .filter((p) => p.firstBloodPct !== null)
        .sort((a, b) => (b.firstBloodPct ?? 0) - (a.firstBloodPct ?? 0))
        .slice(0, 5),
    [leaderboardPlayers]
  );

  const tablePlayers = useMemo(() => {
    const roleFiltered =
      roleFilter === "all"
        ? filteredPlayers
        : filteredPlayers.filter((p) => p.role === roleFilter);

    return [...roleFiltered].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -999999;
      const bv = (b[sortKey] as number | null) ?? -999999;
      return sortAsc ? av - bv : bv - av;
    });
  }, [filteredPlayers, roleFilter, sortKey, sortAsc]);

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

  const sortColorByPlayerKey = useMemo(() => {
    const map = new Map<string, string>();
    const valid = tablePlayers
      .filter((p) => p.games > 0)
      .map((p) => ({
        key: p.playerKey,
        val: p[sortKey] as number | null | undefined,
      }))
      .filter(
        (x): x is { key: string; val: number } =>
          typeof x.val === "number" && Number.isFinite(x.val)
      );
    if (valid.length === 0) return map;
    valid.sort((a, b) => b.val - a.val);
    const total = valid.length;
    for (let i = 0; i < total; i++) {
      let rank = i + 1;
      while (rank > 1 && valid[rank - 2].val === valid[i].val) {
        rank--;
      }
      const t = total <= 1 ? 0 : Math.min(1, Math.max(0, (rank - 1) / (total - 1)));
      let r: number;
      let g: number;
      let b: number;
      if (t <= 0.5) {
        const u = t / 0.5;
        r = Math.round(74 + (166 - 74) * u);
        g = Math.round(222 + (168 - 222) * u);
        b = Math.round(128 + (158 - 128) * u);
      } else {
        const u = (t - 0.5) / 0.5;
        r = Math.round(166 + (248 - 166) * u);
        g = Math.round(168 + (113 - 168) * u);
        b = Math.round(158 + (113 - 158) * u);
      }
      map.set(valid[i].key, `rgb(${r}, ${g}, ${b})`);
    }
    return map;
  }, [tablePlayers, sortKey]);

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
    return filteredPlayers.filter((p) => p.games === 0);
  }, [sheetData, filteredPlayers]);

  return (
    <div className="space-y-4">
      {/* Admin Controls WinXP Window (Admin View Only) */}
      {isAdminView && (
      <RetroWindow title="Admin Controls" theme="xp">
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center">
              <Link
                href="/admin"
                className="xp-btn text-xs justify-center sm:justify-start"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Admin Console</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {sheetData && (
                <span className="text-[11px] text-[#a6a89e]">
                  Loaded{" "}
                  <strong className="text-[#f0ede0]">
                    {sheetData.matchCount}
                  </strong>{" "}
                  league games ({sheetData.rowCount} rows)
                </span>
              )}
              {sheetData && sheetData.unrosteredPlayers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnrosteredModal(true)}
                  title="View unrostered sub / alt summoner names found in the sheet"
                  className="xp-btn text-xs justify-center"
                >
                  <Users className="w-3.5 h-3.5 text-[#f0c020]" />
                  <span>
                    Unrostered ({sheetData.unrosteredPlayers.length})
                  </span>
                </button>
              )}
              <button
                type="button"
                disabled={sheetLoading}
                onClick={() => void loadSheetStats(true)}
                title="Fetch latest SCDL League stats from the public Google Sheet"
                className="xp-btn xp-btn-primary text-xs justify-center disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${sheetLoading ? "animate-spin" : ""}`}
                />
                <span>
                  {sheetLoading ? "Loading Sheet..." : "Refresh Sheet"}
                </span>
              </button>
            </div>
          </div>

          {sheetError && (
            <div className="p-2 bg-[#451717] border border-[#9e3535] rounded text-xs text-[#ff857a] font-bold">
              {sheetError}
            </div>
          )}

          {missingDataPlayers.length > 0 && (() => {
            const preview = missingDataPlayers
              .slice(0, 6)
              .map((p) => `${p.displayName} (${p.teamName})`)
              .join(", ");
            const remainder = missingDataPlayers.length - 6;
            return (
              <div
                title={missingDataPlayers
                  .map((p) => `${p.displayName} (${p.teamName})`)
                  .join(", ")}
                className="px-3 py-1.5 bg-[#2a2210]/80 border border-[#c89b3c]/40 rounded text-[11px] text-[#f0c020] flex items-center gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{missingDataPlayers.length}</strong> rostered{" "}
                  {missingDataPlayers.length === 1 ? "player has" : "players have"}{" "}
                  no match data yet: {preview}
                  {remainder > 0 ? ` +${remainder} more` : ""}
                </span>
              </div>
            );
          })()}

          {sheetData && sheetData.missingDraftGames.length > 0 && (() => {
            const missing = sheetData.missingDraftGames;
            const preview = missing
              .slice(0, 6)
              .map((g) => g.matchLabel)
              .join(", ");
            const remainder = missing.length - 6;
            return (
              <div
                title={missing
                  .map((g) => `${g.matchLabel} (${g.gameId})`)
                  .join("\n")}
                className="px-3 py-1.5 bg-[#451717]/90 border border-[#9e3535] rounded text-[11px] text-[#ff857a] flex items-center gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{missing.length}</strong>{" "}
                  {missing.length === 1 ? "game is" : "games are"} missing draft
                  info (picks/bans in <code>match_drafts</code> /{" "}
                  <code>data/scdl_drafts.json</code>): {preview}
                  {remainder > 0 ? ` +${remainder} more` : ""}
                </span>
              </div>
            );
          })()}

          <details className="xp-inset p-2.5 text-xs">
            <summary className="cursor-pointer font-bold text-[#f0c020] select-none">
              + Add / Update Match Draft (public.match_drafts)
            </summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const splitCsv = (raw: FormDataEntryValue | null) =>
                  String(raw ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                const res = await fetch("/api/admin/scdl-sheet-stats", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    gameId: fd.get("gameId"),
                    seasonId,
                    blueTeam: fd.get("blueTeam"),
                    redTeam: fd.get("redTeam"),
                    blueBans: splitCsv(fd.get("blueBans")),
                    redBans: splitCsv(fd.get("redBans")),
                    bluePicks: splitCsv(fd.get("bluePicks")),
                    redPicks: splitCsv(fd.get("redPicks")),
                    sourceUrl: fd.get("sourceUrl"),
                  }),
                });
                const json = await res.json();
                if (!res.ok) {
                  setSheetError(json.error || "Failed to save draft");
                } else {
                  void loadSheetStats(true);
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5"
            >
              <input
                name="gameId"
                required
                placeholder="Game ID (e.g. 5680632994)"
                className="xp-inset px-2 py-1 text-xs"
              />
              <input
                name="blueTeam"
                required
                placeholder="Blue Team Name"
                className="xp-inset px-2 py-1 text-xs"
              />
              <input
                name="redTeam"
                required
                placeholder="Red Team Name"
                className="xp-inset px-2 py-1 text-xs"
              />
              <input
                name="blueBans"
                placeholder="Blue Bans (B1-B5, comma-sep)"
                className="xp-inset px-2 py-1 text-xs"
              />
              <input
                name="redBans"
                placeholder="Red Bans (R1-R5, comma-sep)"
                className="xp-inset px-2 py-1 text-xs"
              />
              <input
                name="sourceUrl"
                placeholder="Draft URL (optional)"
                className="xp-inset px-2 py-1 text-xs"
              />
              <input
                name="bluePicks"
                placeholder="Blue Picks (B1-B5 in pick order, comma-sep)"
                className="xp-inset px-2 py-1 text-xs sm:col-span-1"
              />
              <input
                name="redPicks"
                placeholder="Red Picks (R1-R5 in pick order, comma-sep)"
                className="xp-inset px-2 py-1 text-xs sm:col-span-1"
              />
              <button
                type="submit"
                className="xp-btn xp-btn-primary text-xs justify-center"
              >
                Save Draft to DB
              </button>
            </form>
          </details>
        </div>
      </RetroWindow>
      )}

      {isAdminView && missingTable && (
        <RetroWindow title="Setup Required — Create Stats Cache Table" theme="xp">
          <div className="space-y-3 text-xs text-[#e8e5d8]">
            <div className="flex items-start gap-2 text-[#f0c020] font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Run migration{" "}
                <code>supabase/migrations/017_riot_stats_cache.sql</code> in
                your Supabase SQL Editor to cache Riot API stats:
              </span>
            </div>
            <pre className="xp-inset p-3 text-[11px] overflow-x-auto text-[#7cd438] tabular-nums">
              {MIGRATION_SQL}
            </pre>
          </div>
        </RetroWindow>
      )}

      {/* Modern Consensus-Style League & Division Selectors */}
      <div
        ref={selectorContainerRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {/* League Selector Card */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenDropdown((prev) => (prev === "league" ? null : "league"))
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
              <button
                type="button"
                onClick={() => setOpenDropdown(null)}
                className="w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition cursor-pointer bg-[#2a2210] border border-[#c89b3c]/70 text-[#f0c020]"
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
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-bold text-[#a6a89e] truncate">
                    {leagueName}
                  </div>
                  <div className="text-xs font-bold truncate">
                    {seasonName}
                  </div>
                </div>
              </button>
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
                    ? `${selectedDivision.name} (${filteredPlayers.length})`
                    : `All Divisions (${activePlayers.length})`}
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#c89b3c] shrink-0" />
          </button>

          {openDropdown === "division" && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#c89b3c]/60 bg-[#121816] shadow-2xl p-1.5 max-h-72 overflow-y-auto space-y-1">
              {divisions.map((div) => {
                const divTheme = resolveDivisionTheme(div.theme_key);
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

      {!sheetData ? (
        <div className="xp-panel p-8 text-center text-xs text-[#a6a89e] flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#f0c020]" />
          <span>Loading league stats...</span>
        </div>
      ) : (
        <>
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
                    return (
                      <Link
                        key={roleMeta.key}
                        href={`${basePath}/player/${encodeURIComponent(
                          player.playerKey
                        )}`}
                        className="group relative min-w-[155px] h-[160px] shrink-0 snap-start md:min-w-0 md:h-[180px] rounded-lg border border-white/15 hover:border-[#f0c020]/80 overflow-hidden bg-[#101513] flex flex-col justify-between p-2.5 transition"
                      >
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
                          <div className="font-extrabold text-sm sm:text-base text-white group-hover:text-[#f0c020] transition-colors truncate drop-shadow">
                            {player.displayName}
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
                {card.rows.map((p, idx) => (
                  <Link
                    key={p.playerKey}
                    href={`${basePath}/player/${encodeURIComponent(
                      p.playerKey
                    )}`}
                    className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] tabular-nums text-[#a6a89e] w-3">
                        {idx + 1}
                      </span>
                      {p.teamLogoUrl && (
                        <img
                          src={p.teamLogoUrl}
                          alt={p.teamName}
                          crossOrigin="anonymous"
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                      <span className="font-bold text-[#f0ede0] truncate">
                        {p.displayName}
                      </span>
                    </div>
                    <span className="tabular-nums font-bold text-[#7cd438] shrink-0">
                      {card.fmt(p)}
                    </span>
                  </Link>
                ))}
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
                {ratingCard.rows.map((p, idx) => (
                  <Link
                    key={p.playerKey}
                    href={`${basePath}/player/${encodeURIComponent(
                      p.playerKey
                    )}`}
                    className={`px-4 sm:px-5 py-2 flex items-center justify-between gap-3 transition hover:bg-[#f0c020]/10 ${
                      idx === 0 ? "bg-[#f0c020]/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <span
                        className={`text-sm sm:text-base font-extrabold tabular-nums w-4 sm:w-5 text-center ${
                          idx === 0 ? "text-[#f0c020]" : "text-[#c89b3c]"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      {p.teamLogoUrl && (
                        <img
                          src={p.teamLogoUrl}
                          alt={p.teamName}
                          crossOrigin="anonymous"
                          className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
                        />
                      )}
                      <span
                        className={`text-sm sm:text-base font-extrabold truncate flex items-center gap-1.5 ${
                          idx === 0 ? "text-[#fff4cc]" : "text-[#f0ede0]"
                        }`}
                      >
                        <span className="truncate">{p.displayName}</span>
                        {idx === 0 && (
                          <Crown className="w-4 h-4 text-[#f0c020] shrink-0 drop-shadow-[0_0_6px_rgba(240,192,32,0.75)]" />
                        )}
                      </span>
                    </div>
                    <span
                      className={`font-black text-base sm:text-lg tabular-nums shrink-0 ${
                        idx === 0 ? "text-[#f0c020]" : "text-[#7cd438]"
                      }`}
                    >
                      {ratingCard.fmt(p)}
                    </span>
                  </Link>
                ))}
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
                                  <span>
                                    {selectedDivision
                                      ? selectedDivision.name
                                      : "League"}
                                  </span>{" "}
                                  <span className="inline-block whitespace-nowrap">
                                    Stat Leaderboards
                                  </span>
                                </h2>
                                <div className="text-xs font-bold text-[#c7c5b8] mt-0.5">
                                  As of {currentEditionName}
                                </div>
                              </div>
                            </div>
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
          />
        )}

        {/* Full Players Leaderboard (Sortable + Role Filter) */}
        {activeSection === "players" && showLeaderboards && (
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
            className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2"
          >
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Top Players ({tablePlayers.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`xp-btn text-[10px] px-2 py-1 ${
                  roleFilter === "all" ? "xp-btn-primary" : ""
                }`}
              >
                All Roles
              </button>
              {LEAGUE_ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRoleFilter(r.key)}
                  className={`xp-btn text-[10px] px-2 py-1 ${
                    roleFilter === r.key ? "xp-btn-primary" : ""
                  }`}
                >
                  <img
                    src={r.icon}
                    alt={r.label}
                    className="w-3.5 h-3.5 object-contain"
                  />
                  <span>{r.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleExportRoleLeaderboardPng}
                disabled={
                  roleFilter === "all" ||
                  roleLeaderboardPlayers.length === 0 ||
                  exportingRoleLeaderboard
                }
                title={
                  roleFilter === "all"
                    ? "Select a role to export its Role Leaderboard PNG"
                    : `Export ${getRoleMeta(roleFilter).label} Leaderboard PNG`
                }
                className="xp-btn xp-btn-gold text-[10px] px-2.5 py-1 flex items-center gap-1.5 ml-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exportingRoleLeaderboard ? "Exporting..." : "Export PNG"}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black/35 text-[10px] uppercase text-[#a6a89e] border-b border-white/10">
                <tr>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-2 py-2">Team</th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "games" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("games")}
                    title="Games Played"
                  >
                    Games
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "leagueRating" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("leagueRating")}
                    title="Role-normalized 0–100 Rankr Rating"
                  >
                    Rating
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "kda" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("kda")}
                    title="Kill / Death / Assist Ratio"
                  >
                    KDA
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "dpm" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("dpm")}
                    title="Damage to Champions / Min"
                  >
                    DPM
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "gpm" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("gpm")}
                    title="Gold Earned / Min"
                  >
                    GPM
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "csPerMin" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("csPerMin")}
                    title="Creep Score / Min"
                  >
                    CS/m
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "kpPct" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("kpPct")}
                    title="Kill Participation %"
                  >
                    KP%
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "damageSharePct" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("damageSharePct")}
                    title="Team Damage Share %"
                  >
                    DMG%
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "visionPerMin" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("visionPerMin")}
                    title="Vision Score / Min"
                  >
                    VS/m
                  </th>
                  <th
                    className={`px-2 py-2 text-right cursor-pointer hover:text-white ${
                      sortKey === "avgGoldDiff15" ? "text-[#f0c020]" : ""
                    }`}
                    onClick={() => handleSort("avgGoldDiff15")}
                    title="Average Gold Diff at 15 Minutes vs Lane Opponent"
                  >
                    GD@15
                  </th>
                  <th className="px-3 py-2" title="Most Played Champions">
                    Top Champs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(showAllPlayers ? tablePlayers : tablePlayers.slice(0, 15)).map(
                  (p) => {
                  const roleMeta = getRoleMeta(p.role as LeagueRole);
                  const sortColor = sortColorByPlayerKey.get(p.playerKey);
                  const sortCellStyle = (col: SortKey) =>
                    sortKey === col && sortColor
                      ? { color: sortColor }
                      : undefined;
                  return (
                    <tr
                      key={p.playerKey}
                      onClick={() =>
                        router.push(
                          `${basePath}/player/${encodeURIComponent(
                            p.playerKey
                          )}`
                        )
                      }
                      className="hover:bg-white/5 transition cursor-pointer"
                    >
                      <td className="px-3 py-2 font-bold text-[#f0ede0] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={roleMeta.icon}
                            alt={roleMeta.label}
                            className="w-4 h-4 object-contain shrink-0"
                          />
                          <span>{p.displayName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[#c7c5b8] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {p.teamLogoUrl && (
                            <img
                              src={p.teamLogoUrl}
                              alt={p.teamName}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                          )}
                          <span>{p.teamName}</span>
                        </div>
                      </td>
                      <td
                        style={sortCellStyle("games")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "games"
                            ? "font-bold"
                            : "text-[#e8e5d8]"
                        }`}
                      >
                        {p.games}
                      </td>
                      <td
                        style={sortCellStyle("leagueRating")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "leagueRating"
                            ? "font-bold"
                            : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? p.leagueRating.toFixed(1) : "—"}
                      </td>
                      <td
                        style={sortCellStyle("kda")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "kda" ? "font-bold" : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? p.kda.toFixed(2) : "—"}
                      </td>
                      <td
                        style={sortCellStyle("dpm")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "dpm" ? "font-bold" : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? Math.round(p.dpm) : "—"}
                      </td>
                      <td
                        style={sortCellStyle("gpm")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "gpm" ? "font-bold" : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? Math.round(p.gpm) : "—"}
                      </td>
                      <td
                        style={sortCellStyle("csPerMin")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "csPerMin"
                            ? "font-bold"
                            : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? p.csPerMin.toFixed(1) : "—"}
                      </td>
                      <td
                        style={sortCellStyle("kpPct")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "kpPct" ? "font-bold" : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? `${p.kpPct.toFixed(0)}%` : "—"}
                      </td>
                      <td
                        style={sortCellStyle("damageSharePct")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "damageSharePct"
                            ? "font-bold"
                            : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? `${p.damageSharePct.toFixed(0)}%` : "—"}
                      </td>
                      <td
                        style={sortCellStyle("visionPerMin")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "visionPerMin"
                            ? "font-bold"
                            : "text-[#e8e5d8]"
                        } ${p.games <= 0 ? "text-[#a6a89e]" : ""}`}
                      >
                        {p.games > 0 ? p.visionPerMin.toFixed(2) : "—"}
                      </td>
                      <td
                        style={sortCellStyle("avgGoldDiff15")}
                        className={`px-2 py-2 text-right tabular-nums ${
                          sortKey === "avgGoldDiff15"
                            ? "font-bold"
                            : "text-[#e8e5d8]"
                        } ${
                          p.avgGoldDiff15 === null ||
                          p.avgGoldDiff15 === undefined ||
                          p.games <= 0
                            ? "text-[#a6a89e]"
                            : ""
                        }`}
                      >
                        {p.games > 0 &&
                        p.avgGoldDiff15 !== null &&
                        p.avgGoldDiff15 !== undefined
                          ? `${p.avgGoldDiff15 >= 0 ? "+" : ""}${Math.round(
                              p.avgGoldDiff15
                            )}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {p.topChampions.slice(0, 3).map((c) => (
                            <img
                              key={c.name}
                              src={getChampionIconUrl(c.name, ddVersion)}
                              alt={c.name}
                              title={`${c.name} (${c.games}G)`}
                              className="w-5 h-5 rounded border border-white/20 object-cover"
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tablePlayers.length > 15 && (
            <div className="bg-[#121615] border-t border-white/10 px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#a6a89e]">
                Showing{" "}
                {showAllPlayers
                  ? tablePlayers.length
                  : Math.min(15, tablePlayers.length)}{" "}
                of {tablePlayers.length} players
              </span>
              <button
                type="button"
                onClick={() => setShowAllPlayers((prev) => !prev)}
                className="xp-btn text-xs"
              >
                {showAllPlayers
                  ? "Show Top 15 ▲"
                  : `Show All ${tablePlayers.length} Players ▼`}
              </button>
            </div>
          )}
        </div>
        )}
        {/* Teams Standings (Seeded, Larger Buttonized Rows) */}
        {activeSection === "teams" && (
          <StatsTeamsTab
            selectedDivision={selectedDivision}
            divisions={divisions}
            filteredTeams={filteredTeams}
            activeTeams={activeTeams}
            basePath={basePath}
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
          <div ref={roleExportCardRef} className="w-[800px] p-2.5">
            <RoleLeaderboardExportCard
              role={roleFilter}
              players={roleLeaderboardPlayers}
              leagueName={leagueName}
              leagueLogoUrl={leagueLogoUrl}
              seasonName={seasonName}
              divisionName={selectedDivision?.name ?? "League"}
              divisionLogoUrl={selectedDivision?.logo_url ?? null}
              currentEditionName={currentEditionName}
              bannerGradient={bannerGradient}
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Award,
  BarChart3,
  Clock,
  RefreshCw,
  Square,
  Swords,
  User,
} from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import {
  computeRoleNormalizedRatings,
  formatMinutesSeconds,
  formatSoloRank,
  type AggregatedPlayerStats,
  type AggregatedTeamStats,
} from "@/utils/riotStatsAggregation";

interface DivisionItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_key: string;
}

interface AdminStatsDashboardProps {
  missingTable: boolean;
  hasRiotKey: boolean;
  ddVersion: string;
  seasonName: string;
  seasonId: string | null;
  divisions: DivisionItem[];
  players: AggregatedPlayerStats[];
  teams: AggregatedTeamStats[];
}

type SortKey =
  | "rankScore"
  | "leagueRating"
  | "winRate"
  | "kda"
  | "dpm"
  | "gpm"
  | "csPerMin"
  | "kpPct"
  | "visionPerMin"
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

export function AdminStatsDashboard({
  missingTable,
  hasRiotKey,
  ddVersion,
  seasonName,
  seasonId,
  divisions,
  players,
  teams,
}: AdminStatsDashboardProps) {
  const router = useRouter();
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<LeagueRole | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("kda");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showAllLeaderboards, setShowAllLeaderboards] = useState(false);
  const [matchCount, setMatchCount] = useState<number>(5);
  const [dataSource, setDataSource] = useState<"riot" | "sheet">("riot");
  const [sheetData, setSheetData] = useState<{
    players: AggregatedPlayerStats[];
    teams: AggregatedTeamStats[];
    fetchedAt: string;
    rowCount: number;
    matchCount: number;
  } | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    done: number;
    total: number;
    currentLabel: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<
    { time: string; level: "ok" | "warn" | "err"; text: string }[]
  >([]);
  const [showSyncLog, setShowSyncLog] = useState(true);
  const cancelSyncRef = useRef(false);

  function appendSyncLog(level: "ok" | "warn" | "err", text: string) {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setSyncLogs((prev) => [{ time, level, text }, ...prev].slice(0, 120));
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

  const activePlayers = useMemo(
    () => (dataSource === "sheet" && sheetData ? sheetData.players : players),
    [dataSource, sheetData, players]
  );

  const activeTeams = useMemo(
    () => (dataSource === "sheet" && sheetData ? sheetData.teams : teams),
    [dataSource, sheetData, teams]
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
      .sort((a, b) => b.winRate - a.winRate || b.avgKda - a.avgKda);
  }, [activeTeams, divisionFilter]);

  const syncedCount = useMemo(
    () => filteredPlayers.filter((p) => p.syncedAt !== null).length,
    [filteredPlayers]
  );

  const overview = useMemo(() => {
    const allMatches = filteredPlayers.flatMap((p) => p.matches);
    const totalMatchRows = allMatches.length;
    const totalGames =
      dataSource === "sheet"
        ? new Set(allMatches.map((m) => m.matchId)).size
        : totalMatchRows;
    const avgDurationMin =
      totalMatchRows > 0
        ? allMatches.reduce((s, m) => s + m.gameDuration, 0) /
          60 /
          totalMatchRows
        : 0;
    const avgKillsPerGame =
      totalMatchRows > 0
        ? allMatches.reduce((s, m) => s + (m.teamKills || m.kills), 0) /
          totalMatchRows
        : 0;

    const blueGames = allMatches.filter((m) => m.teamId === 100);
    const redGames = allMatches.filter((m) => m.teamId === 200);
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

    return {
      totalGames,
      avgDurationMin,
      avgKillsPerGame,
      uniqueChamps: champs.length,
      blueWr,
      redWr,
      champs,
      bannedChamps,
    };
  }, [filteredPlayers, dataSource]);

  const leaderboardPlayers = useMemo(
    () => filteredPlayers.filter((p) => p.games > 0),
    [filteredPlayers]
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
  const topGoldDiff = useMemo(
    () =>
      leaderboardPlayers
        .filter((p) => p.avgGoldDiff !== null)
        .sort((a, b) => (b.avgGoldDiff ?? 0) - (a.avgGoldDiff ?? 0))
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
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
  }, [filteredPlayers, roleFilter, sortKey, sortAsc]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(nextKey);
      setSortAsc(false);
    }
  }

  async function runBatchSync(onlyUnsynced: boolean) {
    if (syncing) return;
    const queue = (
      onlyUnsynced
        ? filteredPlayers.filter((p) => p.syncedAt === null)
        : filteredPlayers
    ).map((p) => ({
      playerKey: p.playerKey,
      riotId: p.riotId,
      seasonId,
      divisionId: p.divisionId,
      teamId: p.teamId,
      role: p.role,
    }));

    if (queue.length === 0) {
      setSyncError("All players in this view are already synced.");
      return;
    }

    cancelSyncRef.current = false;
    setSyncing(true);
    setSyncError(null);
    setShowSyncLog(true);
    setSyncLogs([]);
    appendSyncLog(
      "ok",
      `Started sync for ${queue.length} player(s) (${matchCount} games/player)`
    );
    setSyncProgress({
      done: 0,
      total: queue.length,
      currentLabel: queue[0].riotId,
    });

    const maxReqsPerPlayer = 4 + matchCount;
    const windowMs = 122_000;
    const maxReqsPerWindow = 92;
    const reqTimestamps: number[] = [];

    async function waitForCountdown(seconds: number, reason: string) {
      const targetEnd = Date.now() + seconds * 1000;
      while (!cancelSyncRef.current) {
        const remainingMs = targetEnd - Date.now();
        if (remainingMs <= 0) break;
        const rem = Math.ceil(remainingMs / 1000);
        setSyncProgress((prev) =>
          prev
            ? { ...prev, currentLabel: `${reason} (${rem}s)` }
            : prev
        );
        await new Promise((r) => setTimeout(r, Math.min(1000, remainingMs)));
      }
    }

    try {
      let i = 0;
      while (i < queue.length) {
        if (cancelSyncRef.current) break;

        // Prune requests older than 2m02s from our sliding window
        const now = Date.now();
        while (reqTimestamps.length > 0 && now - reqTimestamps[0] >= windowMs) {
          reqTimestamps.shift();
        }

        // If adding this player could exceed 85 reqs in 2 mins, pause until window frees up
        if (
          reqTimestamps.length > 0 &&
          reqTimestamps.length + maxReqsPerPlayer > maxReqsPerWindow
        ) {
          const waitSec = Math.max(
            2,
            Math.ceil((windowMs - (now - reqTimestamps[0])) / 1000)
          );
          appendSyncLog(
            "warn",
            `Rate-limit safe pause (${waitSec}s) to stay under 100 req / 2 min`
          );
          await waitForCountdown(waitSec, "Rate-limit safe pause");
          continue;
        }

        const playerItem = queue[i];
        setSyncProgress({
          done: i,
          total: queue.length,
          currentLabel: playerItem.riotId.split("#")[0],
        });

        for (let r = 0; r < maxReqsPerPlayer; r++) {
          reqTimestamps.push(Date.now());
        }

        const res = await fetch("/api/admin/riot-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players: [playerItem], matchCount }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          retryAfterSeconds?: number;
          results?: {
            riot_id: string;
            solo_tier: string | null;
            solo_rank: string | null;
            matches: unknown[];
            sync_error: string | null;
          }[];
        };

        if (res.status === 429) {
          const waitSec = Math.max(2, Number(data.retryAfterSeconds ?? 30) + 2);
          appendSyncLog("warn", `Riot 429 Retry-After pause (${waitSec}s)`);
          await waitForCountdown(waitSec, "Riot Retry-After pause");
          continue;
        }

        if (!res.ok) {
          throw new Error(data.error || `Sync failed (${res.status})`);
        }

        const syncedRow = data.results?.[0];
        if (syncedRow?.sync_error) {
          appendSyncLog(
            "err",
            `${playerItem.riotId} — ${syncedRow.sync_error}`
          );
        } else if (syncedRow) {
          const tierLabel = syncedRow.solo_tier
            ? `${syncedRow.solo_tier} ${syncedRow.solo_rank ?? ""}`.trim()
            : "Unranked";
          appendSyncLog(
            "ok",
            `${syncedRow.riot_id} — ${tierLabel} • ${syncedRow.matches.length}G`
          );
        }

        i += 1;
        setSyncProgress({
          done: i,
          total: queue.length,
          currentLabel: playerItem.riotId.split("#")[0],
        });
      }
      if (cancelSyncRef.current) {
        appendSyncLog("warn", "Sync stopped by admin.");
      } else {
        appendSyncLog("ok", "Sync finished.");
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      appendSyncLog("err", msg);
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin" className="xp-btn text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Admin Console</span>
        </Link>
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-white/15">
          <button
            type="button"
            onClick={() => setDataSource("riot")}
            className={`xp-btn text-xs ${
              dataSource === "riot" ? "xp-btn-primary" : ""
            }`}
          >
            SoloQ (Riot API)
          </button>
          <button
            type="button"
            onClick={() => {
              setDataSource("sheet");
              void loadSheetStats(false);
            }}
            className={`xp-btn text-xs ${
              dataSource === "sheet" ? "xp-btn-primary" : ""
            }`}
          >
            SCDL League (Sheet)
          </button>
        </div>
      </div>

      {missingTable && (
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
            <pre className="xp-inset p-3 text-[11px] overflow-x-auto text-[#7cd438] font-mono">
              {MIGRATION_SQL}
            </pre>
          </div>
        </RetroWindow>
      )}

      {!hasRiotKey && (
        <div className="xp-panel p-3 border border-[#9e3535] bg-[#451717]/60 text-xs text-[#ff857a] font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <code>RIOT_API_KEY</code> is not set in server environment
            variables. Add it to <code>.env.local</code> and Vercel to sync live
            Riot data.
          </span>
        </div>
      )}

      <RetroWindow
        title={
          dataSource === "sheet"
            ? `Stats Lab (SCDL Sheet) - SCDL ${seasonName}`
            : `Stats Lab (Riot API) - SCDL ${seasonName}`
        }
        theme="scdl"
      >
        {/* Division Toggle + Riot Sync Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDivisionFilter("all")}
              className={`xp-btn text-xs ${
                divisionFilter === "all" ? "xp-btn-primary" : ""
              }`}
            >
              All Divisions ({activePlayers.length})
            </button>
            {divisions.map((div) => {
              const count = activePlayers.filter(
                (p) => p.divisionId === div.id
              ).length;
              return (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setDivisionFilter(div.id)}
                  className={`xp-btn text-xs ${
                    divisionFilter === div.id ? "xp-btn-primary" : ""
                  }`}
                >
                  {div.logo_url && (
                    <img
                      src={div.logo_url}
                      alt={div.name}
                      className="w-4 h-4 object-contain"
                    />
                  )}
                  <span>
                    {div.name} ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {dataSource === "sheet" ? (
            <div className="flex flex-wrap items-center gap-2">
              {sheetData && (
                <span className="text-[11px] text-[#a6a89e]">
                  Loaded{" "}
                  <strong className="text-[#f0ede0]">
                    {sheetData.matchCount}
                  </strong>{" "}
                  league games ({sheetData.rowCount} rows)
                </span>
              )}
              <button
                type="button"
                disabled={sheetLoading}
                onClick={() => void loadSheetStats(true)}
                title="Fetch latest SCDL League stats from the public Google Sheet"
                className="xp-btn xp-btn-primary text-xs disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${sheetLoading ? "animate-spin" : ""}`}
                />
                <span>{sheetLoading ? "Loading Sheet..." : "Refresh Sheet"}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#a6a89e]">
                Synced:{" "}
                <strong className="text-[#f0ede0]">{syncedCount}</strong>/
                {filteredPlayers.length}
              </span>
              <select
                value={matchCount}
                disabled={syncing}
                onChange={(e) => setMatchCount(Number(e.target.value))}
                className="xp-inset px-2 py-1 text-[11px] font-bold"
                title="Recent non-tournament games to pull per player"
              >
                <option value={3}>3 games / player</option>
                <option value={5}>5 games / player</option>
                <option value={10}>10 games / player</option>
              </select>
              {!syncing ? (
                <>
                  <button
                    type="button"
                    disabled={
                      !hasRiotKey ||
                      missingTable ||
                      filteredPlayers.length - syncedCount === 0
                    }
                    onClick={() => void runBatchSync(true)}
                    title="Sync only players in this view who have never been synced"
                    className="xp-btn text-xs disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#7cd438]" />
                    <span>
                      Sync Missing ({filteredPlayers.length - syncedCount})
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasRiotKey || missingTable}
                    onClick={() => void runBatchSync(false)}
                    title="Force-refresh all players in the current division view"
                    className="xp-btn xp-btn-primary text-xs disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-Sync All ({filteredPlayers.length})</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    cancelSyncRef.current = true;
                  }}
                  className="xp-btn xp-btn-danger text-xs"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop Sync</span>
                </button>
              )}
            </div>
          )}
        </div>

        {syncProgress && (
          <div className="mb-4 xp-inset p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#f0c020] font-bold">
                {syncing
                  ? `Syncing Riot API (${syncProgress.currentLabel})...`
                  : "Sync Complete"}
              </span>
              <span className="text-[#c7c5b8] font-mono">
                {syncProgress.done} / {syncProgress.total}
              </span>
            </div>
            <div className="w-full h-2 rounded bg-black/50 overflow-hidden">
              <div
                className="h-full bg-[#7cd438] transition-all"
                style={{
                  width: `${
                    syncProgress.total > 0
                      ? (syncProgress.done / syncProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {sheetError && dataSource === "sheet" && (
          <div className="mb-4 p-2.5 bg-[#451717] border border-[#9e3535] text-xs text-[#ff857a] font-bold">
            {sheetError}
          </div>
        )}

        {syncError && dataSource === "riot" && (
          <div className="mb-4 p-2.5 bg-[#451717] border border-[#9e3535] text-xs text-[#ff857a] font-bold">
            {syncError}
          </div>
        )}

        {syncLogs.length > 0 && (
          <div className="mb-4 xp-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSyncLog((prev) => !prev)}
              className="w-full bg-[#121615] border-b border-white/10 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-[#c7c5b8] hover:text-white cursor-pointer"
            >
              <span>Sync Activity Log ({syncLogs.length})</span>
              <span>{showSyncLog ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {showSyncLog && (
              <div className="max-h-36 overflow-y-auto p-2 space-y-1 font-mono text-[11px] bg-black/40">
                {syncLogs.map((entry, idx) => (
                  <div
                    key={idx}
                    className={
                      entry.level === "err"
                        ? "text-[#ff857a]"
                        : entry.level === "warn"
                        ? "text-[#f0c020]"
                        : "text-[#7cd438]"
                    }
                  >
                    <span className="text-[#a6a89e] mr-2">[{entry.time}]</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top Overview KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <div className="xp-panel p-3 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#f0c020]" />
              <span>Matches Analyzed</span>
            </div>
            <div className="text-2xl font-black text-white mt-1 tabular-nums">
              {overview.totalGames}
            </div>
            <div className="text-[10px] text-[#a6a89e]">
              {dataSource === "sheet"
                ? "Official SCDL league games"
                : "Non-tournament personal games"}
            </div>
          </div>

          <div className="xp-panel p-3 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#7cd438]" />
              <span>Avg Game Time</span>
            </div>
            <div className="text-2xl font-black text-[#f0c020] mt-1 tabular-nums">
              {formatMinutesSeconds(overview.avgDurationMin)}
            </div>
            <div className="text-[10px] text-[#a6a89e]">
              Across synced matches
            </div>
          </div>

          <div className="xp-panel p-3 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-[#ff857a]" />
              <span>Avg Team Kills / G</span>
            </div>
            <div className="text-2xl font-black text-white mt-1 tabular-nums">
              {overview.avgKillsPerGame.toFixed(1)}
            </div>
            <div className="text-[10px] text-[#a6a89e]">Per player team</div>
          </div>

          <div className="xp-panel p-3 flex flex-col justify-between">
            <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#00b8c9]" />
              <span>Unique Champs</span>
            </div>
            <div className="text-2xl font-black text-white mt-1 tabular-nums">
              {overview.uniqueChamps}
            </div>
            <div className="text-[10px] text-[#a6a89e]">
              Patch {ddVersion}
            </div>
          </div>

          <div className="xp-panel p-3 flex flex-col justify-between col-span-2 lg:col-span-1">
            <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#f0c020]" />
              <span>Side Win Rate</span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-[#5ea3ff]">
                  Blue {overview.blueWr.toFixed(1)}%
                </span>
                <span className="text-[#ff7b72]">
                  Red {overview.redWr.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#ff7b72]/70">
                <div
                  className="bg-[#3b82f6] h-full"
                  style={{ width: `${overview.blueWr}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Most Picked Champions Grid */}
        {overview.champs.length > 0 && (
          <div className="mb-6 xp-panel p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020]">
                Champions Played ({overview.champs.length})
              </h2>
              <span className="text-[11px] text-[#a6a89e]">
                Top 36 by pick count
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1.5">
              {overview.champs.slice(0, 36).map((c) => (
                <div
                  key={c.name}
                  title={`${c.name}: ${c.games} games (${c.winRate.toFixed(
                    0
                  )}% WR)`}
                  className="rounded border border-white/15 bg-[#121615] overflow-hidden flex flex-col"
                >
                  <img
                    src={getChampionIconUrl(c.name, ddVersion)}
                    alt={c.name}
                    className="w-full aspect-square object-cover block"
                  />
                  <div className="px-1 py-1 border-t border-white/10 flex items-center justify-between text-[11px] font-bold leading-none tabular-nums">
                    <span className="text-[#f0ede0]">{c.games}</span>
                    <span
                      className={
                        c.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                      }
                    >
                      {c.winRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {overview.bannedChamps.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#ff857a]">
                    Most Banned Champions
                  </span>
                  <span className="text-[11px] text-[#a6a89e]">
                    Top 12 by ban count
                  </span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1.5">
                  {overview.bannedChamps.slice(0, 12).map((b) => (
                    <div
                      key={b.name}
                      title={`${b.name} — ${b.bans} bans (${b.banRate.toFixed(
                        0
                      )}% ban rate)`}
                      className="bg-black/40 border border-white/10 rounded overflow-hidden"
                    >
                      <img
                        src={getChampionIconUrl(b.name, ddVersion)}
                        alt={b.name}
                        className="w-full aspect-square object-cover block grayscale-[25%]"
                      />
                      <div className="px-1 py-1 border-t border-white/10 flex items-center justify-between text-[11px] font-bold leading-none tabular-nums">
                        <span className="text-[#ff857a]">{b.bans}</span>
                        <span className="text-white">
                          {b.banRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stat Leaderboards Grid (Top 5 cards) */}
        {leaderboardPlayers.length > 0 && (() => {
          type LeaderboardCard = {
            title: string;
            rows: AggregatedPlayerStats[];
            fmt: (p: AggregatedPlayerStats) => string;
          };

          const primaryRow: LeaderboardCard[] = [
            {
              title: "League Rating (Role-Norm)",
              rows: topRating,
              fmt: (p) => p.leagueRating.toFixed(1),
            },
            {
              title: "Highest KDA",
              rows: topKda,
              fmt: (p) => p.kda.toFixed(2),
            },
          ];

          const secondaryRow: LeaderboardCard[] = [
            {
              title: "Highest Vision / Min",
              rows: topVision,
              fmt: (p) => p.visionPerMin.toFixed(2),
            },
            {
              title: "Highest Damage / Min",
              rows: topDpm,
              fmt: (p) => Math.round(p.dpm).toString(),
            },
            {
              title: "Highest Gold / Min",
              rows: topGpm,
              fmt: (p) => Math.round(p.gpm).toString(),
            },
            ...(topGoldDiff.length > 0
              ? [
                  {
                    title: "Highest Gold Diff / Game",
                    rows: topGoldDiff,
                    fmt: (p: AggregatedPlayerStats) => {
                      const val = Math.round(p.avgGoldDiff ?? 0);
                      return val >= 0 ? `+${val}` : `${val}`;
                    },
                  },
                ]
              : []),
          ];

          const expandedRow1: LeaderboardCard[] = [
            {
              title: "Highest Kill Participation",
              rows: topKp,
              fmt: (p) => `${p.kpPct.toFixed(1)}%`,
            },
            {
              title: "Highest Team Damage %",
              rows: topDmgShare,
              fmt: (p) => `${p.damageSharePct.toFixed(1)}%`,
            },
            ...(topSoloKills.length > 0
              ? [
                  {
                    title: "Most Solo Kills",
                    rows: topSoloKills,
                    fmt: (p: AggregatedPlayerStats) => `${p.soloKills}`,
                  },
                ]
              : []),
            ...(topFirstBlood.length > 0
              ? [
                  {
                    title: "First Blood %",
                    rows: topFirstBlood,
                    fmt: (p: AggregatedPlayerStats) =>
                      `${(p.firstBloodPct ?? 0).toFixed(0)}%`,
                  },
                ]
              : []),
          ];

          const expandedRow2: LeaderboardCard[] = [
            {
              title: "Highest Kills / Game",
              rows: topKills,
              fmt: (p) => p.killsPerGame.toFixed(1),
            },
            {
              title: "Lowest Deaths / Game",
              rows: lowestDeaths,
              fmt: (p) => p.deathsPerGame.toFixed(1),
            },
            {
              title: "Highest Assists / Game",
              rows: topAssists,
              fmt: (p) => p.assistsPerGame.toFixed(1),
            },
          ];

          const renderCard = (card: LeaderboardCard) => (
            <div
              key={card.title}
              className="xp-panel overflow-hidden w-full sm:w-[calc(50%-6px)] lg:w-[calc(25%-9px)]"
            >
              <div className="bg-[#2a2210] border-b border-[#c89b3c]/50 px-3 py-1.5 text-[11px] font-bold uppercase text-[#f0c020]">
                {card.title}
              </div>
              <div className="divide-y divide-white/10">
                {card.rows.map((p, idx) => (
                  <Link
                    key={p.playerKey}
                    href={`/admin/stats/player/${encodeURIComponent(
                      p.playerKey
                    )}`}
                    className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-[#a6a89e] w-3">
                        {idx + 1}
                      </span>
                      {p.teamLogoUrl && (
                        <img
                          src={p.teamLogoUrl}
                          alt={p.teamName}
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                      <span className="font-bold text-[#f0ede0] truncate">
                        {p.displayName}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#7cd438] shrink-0">
                      {card.fmt(p)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );

          return (
            <div className="mb-6 space-y-3">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] text-center">
                Leaderboards
              </h2>

              <div className="flex flex-wrap justify-center gap-3">
                {primaryRow.map(renderCard)}
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {secondaryRow.map(renderCard)}
              </div>

              {showAllLeaderboards && (
                <>
                  <div className="flex flex-wrap justify-center gap-3">
                    {expandedRow1.map(renderCard)}
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {expandedRow2.map(renderCard)}
                  </div>
                </>
              )}

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllLeaderboards((prev) => !prev)}
                  className="xp-btn text-[11px] px-3 py-1"
                >
                  {showAllLeaderboards
                    ? "Show Fewer Leaderboards ▲"
                    : "Show More Leaderboards ▼"}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Teams Table (Click through to Team Page) */}
        <div className="mb-6 xp-panel overflow-hidden">
          <div className="bg-[#121615] border-b border-white/10 px-3 py-2.5 flex items-center justify-between">
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020] flex items-center gap-2">
              <TeamGroupIcon className="w-4 h-4" />
              <span>Teams ({filteredTeams.length})</span>
            </h2>
            <span className="text-[10px] text-[#a6a89e]">
              Click any team for full roster breakdown
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black/35 text-[10px] uppercase text-[#a6a89e] border-b border-white/10">
                <tr>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2 text-right">Games</th>
                  <th className="px-3 py-2 text-right">WR%</th>
                  <th className="px-3 py-2 text-right">KDA</th>
                  <th className="px-3 py-2 text-right">DPM</th>
                  <th className="px-3 py-2 text-right">GPM</th>
                  <th className="px-3 py-2 text-right">Avg Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredTeams.map((t) => (
                  <tr
                    key={t.teamId}
                    className="hover:bg-white/5 transition cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/admin/stats/team/${encodeURIComponent(t.teamId)}`
                      )
                    }
                  >
                    <td className="px-3 py-2 font-bold text-[#f0ede0]">
                      <div className="flex items-center gap-2">
                        {t.logoUrl && (
                          <img
                            src={t.logoUrl}
                            alt={t.teamName}
                            className="w-5 h-5 object-contain shrink-0"
                          />
                        )}
                        <span>{t.teamName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[#c7c5b8]">
                      {t.divisionName}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.games}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono font-bold ${
                        t.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                      }`}
                    >
                      {t.games > 0 ? `${t.winRate.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.games > 0 ? t.avgKda.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.games > 0 ? Math.round(t.avgDpm) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.games > 0 ? Math.round(t.avgGpm) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.games > 0
                        ? formatMinutesSeconds(t.avgGameMinutes)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full Players Leaderboard (Sortable + Role Filter) */}
        <div className="xp-panel overflow-hidden">
          <div className="bg-[#121615] border-b border-white/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-black/35 text-[10px] uppercase text-[#a6a89e] border-b border-white/10">
                <tr>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-2 py-2">Team</th>
                  <th
                    className="px-2 py-2 cursor-pointer hover:text-white"
                    onClick={() => handleSort("rankScore")}
                  >
                    <span className="inline-flex items-center gap-1">
                      SoloQ <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("leagueRating")}
                    title="Role-normalized 0–100 League Rating"
                  >
                    Rating
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("games")}
                  >
                    Games
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("winRate")}
                  >
                    WR%
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("kda")}
                  >
                    KDA
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("dpm")}
                  >
                    DPM
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("gpm")}
                  >
                    GPM
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("csPerMin")}
                  >
                    CS/m
                  </th>
                  <th
                    className="px-2 py-2 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("kpPct")}
                  >
                    KP%
                  </th>
                  <th className="px-3 py-2">Top Champs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(showAllPlayers ? tablePlayers : tablePlayers.slice(0, 15)).map(
                  (p) => {
                  const roleMeta = getRoleMeta(p.role as LeagueRole);
                  return (
                    <tr
                      key={p.playerKey}
                      onClick={() =>
                        router.push(
                          `/admin/stats/player/${encodeURIComponent(
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
                      <td className="px-2 py-2 text-[11px] text-[#f0c020] whitespace-nowrap">
                        {p.syncError ? (
                          <span
                            title={p.syncError}
                            className="text-[#ff857a] font-mono"
                          >
                            Error
                          </span>
                        ) : (
                          formatSoloRank(p.soloTier, p.soloRank, p.soloLp)
                        )}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono font-bold ${
                          p.games <= 0
                            ? "text-[#a6a89e]"
                            : p.leagueRating >= 60
                            ? "text-[#7cd438]"
                            : p.leagueRating >= 45
                            ? "text-[#f0c020]"
                            : "text-[#ff857a]"
                        }`}
                      >
                        {p.games > 0 ? p.leagueRating.toFixed(1) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {p.games}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono font-bold ${
                          p.winRate >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                        }`}
                      >
                        {p.games > 0 ? `${p.winRate.toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-bold">
                        {p.games > 0 ? p.kda.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {p.games > 0 ? Math.round(p.dpm) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {p.games > 0 ? Math.round(p.gpm) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {p.games > 0 ? p.csPerMin.toFixed(1) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {p.games > 0 ? `${p.kpPct.toFixed(0)}%` : "—"}
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
      </RetroWindow>
    </div>
  );
}

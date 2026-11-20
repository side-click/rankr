"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Clock,
  Coins,
  Crown,
  Droplet,
  Eye,
  HelpCircle,
  Swords,
} from "lucide-react";
import { getChampionIconUrl } from "@/utils/riotApi";
import { formatMinutesSeconds } from "@/utils/riotStatsAggregation";

export interface DivisionPlayerKpiLeader {
  name: string;
  count: number;
  teamName: string;
  teamLogoUrl?: string | null;
}

export interface DivisionOverviewStats {
  totalGames: number;
  blueWr: number;
  redWr: number;
  flashDPicks: number;
  flashDWr: number;
  flashFPicks: number;
  flashFWr: number;
  fbWr: number | null;
  fbGames: number;
  gd15Wr: number | null;
  gd15Games: number;
  longestGame: {
    durationMin: number;
    winner: string;
    loser: string;
    roundLabel: string;
  } | null;
  topPingPlayer: DivisionPlayerKpiLeader | null;
  topPentaPlayer: DivisionPlayerKpiLeader | null;
  topStealPlayer: DivisionPlayerKpiLeader | null;
  totalControlWards: number;
  controlWardsPerMin: number;
  champs: {
    name: string;
    games: number;
    wins: number;
    winRate: number;
  }[];
  bannedChamps: {
    name: string;
    bans: number;
    banRate: number;
  }[];
}

interface StatsDivisionTabProps {
  overview: DivisionOverviewStats;
  ddVersion: string;
  kpiCardStyle: React.CSSProperties;
  selectedDivisionPrimaryColor?: string | null;
}

function normChampKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const ddChampionCache = new Map<string, { id: string; name: string }[]>();

function useAllChampions(ddVersion: string) {
  const [all, setAll] = useState<{ id: string; name: string }[]>(
    () => ddChampionCache.get(ddVersion) ?? []
  );
  useEffect(() => {
    if (ddChampionCache.has(ddVersion)) return;
    let cancelled = false;
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data || cancelled) return;
        const list = (
          Object.values(json.data) as { id: string; name: string }[]
        )
          .map((c) => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        ddChampionCache.set(ddVersion, list);
        setAll(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ddVersion]);
  return all;
}

export function StatsDivisionTab({
  overview,
  ddVersion,
  kpiCardStyle,
  selectedDivisionPrimaryColor,
}: StatsDivisionTabProps) {
  const allChampions = useAllChampions(ddVersion);
  const untouched = useMemo(() => {
    if (allChampions.length === 0) return [];
    const touched = new Set<string>();
    for (const c of overview.champs) touched.add(normChampKey(c.name));
    for (const b of overview.bannedChamps) touched.add(normChampKey(b.name));
    return allChampions.filter(
      (c) =>
        !touched.has(normChampKey(c.id)) && !touched.has(normChampKey(c.name))
    );
  }, [allChampions, overview.champs, overview.bannedChamps]);

  return (
    <>
      {/* Top Overview KPI Strip (10 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#f0c020]" />
            <span>Matches Analyzed</span>
          </div>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">
            {overview.totalGames}
          </div>
          <div className="text-[10px] text-[#a6a89e]">
            Official SCDL league games
          </div>
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
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

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-[3px] border-[1.25px] border-[#f0c020] text-[#f0c020] text-[9px] font-black leading-none inline-flex items-center justify-center shrink-0">
              F
            </span>
            <span>Flash on D vs F</span>
          </div>
          {overview.flashDPicks + overview.flashFPicks > 0 ? (
            <div className="mt-1.5 space-y-1 text-xs font-bold tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-[#f0ede0]">
                  D: {overview.flashDPicks}
                </span>
                <span className="text-[#7cd438]">
                  {overview.flashDWr.toFixed(0)}% WR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#f0ede0]">
                  F: {overview.flashFPicks}
                </span>
                <span className="text-[#7cd438]">
                  {overview.flashFWr.toFixed(0)}% WR
                </span>
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold text-[#a6a89e] mt-1">—</div>
          )}
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Droplet className="w-3.5 h-3.5 text-[#ff857a]" />
            <span>First Blood WR</span>
          </div>
          <div className="text-2xl font-black text-[#7cd438] mt-1 tabular-nums">
            {overview.fbWr !== null ? `${overview.fbWr.toFixed(0)}%` : "—"}
          </div>
          <div className="text-[10px] text-[#a6a89e]">
            {overview.fbGames > 0
              ? `Across ${overview.fbGames} FB games`
              : "No FB data"}
          </div>
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#f0c020]" />
            <span>@15 Gold Lead WR</span>
          </div>
          <div className="text-2xl font-black text-[#f0c020] mt-1 tabular-nums">
            {overview.gd15Wr !== null ? `${overview.gd15Wr.toFixed(0)}%` : "—"}
          </div>
          <div className="text-[10px] text-[#a6a89e]">
            {overview.gd15Games > 0 ? "Teams ahead @15m" : "Sheet mode only"}
          </div>
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00b8c9]" />
            <span>Longest Game</span>
          </div>
          <div className="text-2xl font-black text-[#f0c020] mt-1 tabular-nums">
            {overview.longestGame
              ? formatMinutesSeconds(overview.longestGame.durationMin)
              : "—"}
          </div>
          {overview.longestGame ? (
            <div
              title={`${overview.longestGame.winner} def. ${overview.longestGame.loser}${
                overview.longestGame.roundLabel
                  ? ` • ${overview.longestGame.roundLabel}`
                  : ""
              }`}
              className="text-[11px] leading-tight text-[#a6a89e]"
            >
              <div className="truncate">
                {overview.longestGame.winner} def. {overview.longestGame.loser}
              </div>
              {overview.longestGame.roundLabel && (
                <div className="text-[#8e9286]">
                  {overview.longestGame.roundLabel}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] leading-tight text-[#a6a89e]">
              No match data
            </div>
          )}
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#f0c020]" />
            <span>Most Toxic?</span>
          </div>
          <div className="flex items-center gap-1.5 text-base font-black text-[#f0ede0] mt-1 min-w-0">
            {overview.topPingPlayer?.teamLogoUrl && (
              <img
                src={overview.topPingPlayer.teamLogoUrl}
                alt={overview.topPingPlayer.teamName}
                crossOrigin="anonymous"
                className="w-4 h-4 object-contain shrink-0"
              />
            )}
            <span className="truncate">
              {overview.topPingPlayer ? overview.topPingPlayer.name : "—"}
            </span>
          </div>
          <div className="text-[10px] text-[#f0c020] font-bold tabular-nums">
            {overview.topPingPlayer
              ? `${overview.topPingPlayer.count} missing pings`
              : "Sheet mode only"}
          </div>
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#f0c020]" />
            <span>Most Pentakills</span>
          </div>
          <div className="flex items-center gap-1.5 text-base font-black text-[#f0ede0] mt-1 min-w-0">
            {overview.topPentaPlayer?.teamLogoUrl && (
              <img
                src={overview.topPentaPlayer.teamLogoUrl}
                alt={overview.topPentaPlayer.teamName}
                crossOrigin="anonymous"
                className="w-4 h-4 object-contain shrink-0"
              />
            )}
            <span className="truncate">
              {overview.topPentaPlayer ? overview.topPentaPlayer.name : "None yet"}
            </span>
          </div>
          <div className="text-[10px] text-[#a6a89e] font-bold tabular-nums">
            {overview.topPentaPlayer
              ? `${overview.topPentaPlayer.count} ${
                  overview.topPentaPlayer.count === 1
                    ? "pentakill"
                    : "pentakills"
                }`
              : "0 pentakills"}
          </div>
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5 text-[#ff857a]" />
            <span>Most Objective Steals</span>
          </div>
          <div className="flex items-center gap-1.5 text-base font-black text-[#f0ede0] mt-1 min-w-0">
            {overview.topStealPlayer?.teamLogoUrl && (
              <img
                src={overview.topStealPlayer.teamLogoUrl}
                alt={overview.topStealPlayer.teamName}
                crossOrigin="anonymous"
                className="w-4 h-4 object-contain shrink-0"
              />
            )}
            <span className="truncate">
              {overview.topStealPlayer ? overview.topStealPlayer.name : "None yet"}
            </span>
          </div>
          <div className="text-[10px] text-[#a6a89e] font-bold tabular-nums">
            {overview.topStealPlayer
              ? `${overview.topStealPlayer.count} ${
                  overview.topStealPlayer.count === 1 ? "steal" : "steals"
                }`
              : "0 steals"}
          </div>
        </div>

        <div
          style={kpiCardStyle}
          className="xp-panel p-3 flex flex-col justify-between"
        >
          <div className="text-[10px] font-bold uppercase text-[#a6a89e] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#00b8c9]" />
            <span>Wards Bought / Min</span>
          </div>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">
            {overview.totalGames > 0
              ? overview.controlWardsPerMin.toFixed(2)
              : "—"}
          </div>
          <div className="text-[10px] text-[#a6a89e]">
            {overview.totalControlWards} total bought
          </div>
        </div>
      </div>

      {/* Most Picked Champions Grid */}
      {overview.champs.length > 0 && (
        <div
          style={
            selectedDivisionPrimaryColor
              ? {
                  borderColor: `${selectedDivisionPrimaryColor}66`,
                  borderTopWidth: "3px",
                  borderTopColor: selectedDivisionPrimaryColor,
                }
              : undefined
          }
          className="mb-6 xp-panel overflow-hidden"
        >
          <div
            style={
              selectedDivisionPrimaryColor
                ? {
                    background: `linear-gradient(90deg, ${selectedDivisionPrimaryColor}38 0%, #121615 70%)`,
                  }
                : undefined
            }
            className="bg-[#121615] border-b border-white/10 px-4 py-2 min-h-[60px] flex flex-wrap items-center justify-between gap-2"
          >
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#f0c020]">
              Champions Played ({overview.champs.length})
            </h2>
            <span className="text-[11px] text-[#a6a89e]">
              Top 36 by pick count
            </span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1.5">
              {overview.champs.slice(0, 36).map((c) => (
                <Link
                  key={c.name}
                  href={`/stats/champion/${encodeURIComponent(c.name)}`}
                  title={`${c.name}: ${c.games} games (${c.winRate.toFixed(
                    0
                  )}% WR)`}
                  className="rounded border border-white/15 bg-[#121615] hover:border-[#f0c020]/70 transition overflow-hidden flex flex-col"
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
                </Link>
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
                    <Link
                      key={b.name}
                      href={`/stats/champion/${encodeURIComponent(b.name)}`}
                      title={`${b.name} — ${b.bans} bans (${b.banRate.toFixed(
                        0
                      )}% ban rate)`}
                      className="bg-black/40 border border-white/10 hover:border-[#f0c020]/70 transition rounded overflow-hidden block"
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
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {untouched.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#a6a89e]">
                    Untouched Champions ({untouched.length})
                  </span>
                  <span className="text-[11px] text-[#a6a89e]">
                    Never picked or banned
                  </span>
                </div>
                <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-[repeat(20,minmax(0,1fr))] gap-1">
                  {untouched.map((c) => (
                    <div
                      key={c.id}
                      title={`${c.name} — no picks or bans`}
                      className="rounded border border-white/10 bg-black/40 overflow-hidden cursor-default"
                    >
                      <img
                        src={getChampionIconUrl(c.id, ddVersion)}
                        alt={c.name}
                        loading="lazy"
                        className="w-full aspect-square object-cover block grayscale opacity-50"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

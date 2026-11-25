"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocalTimestamp } from "@/components/LocalTimestamp";
import { RetroWindow } from "@/components/RetroWindow";
import { getRoleMeta, normalizeRoster, type LeagueRole } from "@/utils/roles";
import type {
  Division,
  Season,
  SeasonMatch,
  Team,
  TournamentCode,
} from "@/types/database";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Swords,
  Users,
} from "lucide-react";

export interface MatchHubTeamStatInfo {
  teamId: string;
  wins: number;
  losses: number;
  seed: number | null;
}

export interface MatchHubPlayerKeyMap {
  [nameLower: string]: string;
}

interface TeamMatchHubProps {
  seasons: Season[];
  selectedSeasonSlug: string;
  divisions: Division[];
  teams: Team[];
  accessibleTeamIds: string[];
  codeAccessTeamIds: string[];
  defaultTeamId?: string;
  matches: SeasonMatch[];
  initialCodes: TournamentCode[];
  teamStatsMap: Record<string, MatchHubTeamStatInfo>;
  playerKeyByName: MatchHubPlayerKeyMap;
}

export function TeamMatchHub({
  seasons,
  selectedSeasonSlug,
  divisions,
  teams,
  accessibleTeamIds,
  codeAccessTeamIds,
  defaultTeamId,
  matches,
  initialCodes,
  teamStatsMap,
  playerKeyByName,
}: TeamMatchHubProps) {
  const router = useRouter();
  const accessibleTeams = useMemo(
    () => teams.filter((t) => accessibleTeamIds.includes(t.id)),
    [teams, accessibleTeamIds]
  );
  const codeAccessSet = useMemo(
    () => new Set(codeAccessTeamIds),
    [codeAccessTeamIds]
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string>(() =>
    defaultTeamId && accessibleTeams.some((t) => t.id === defaultTeamId)
      ? defaultTeamId
      : accessibleTeams[0]?.id ?? ""
  );

  useEffect(() => {
    const nextDefault =
      defaultTeamId && accessibleTeams.some((t) => t.id === defaultTeamId)
        ? defaultTeamId
        : accessibleTeams[0]?.id ?? "";
    setSelectedTeamId(nextDefault);
  }, [defaultTeamId, accessibleTeams]);
  const [codes, setCodes] = useState<TournamentCode[]>(initialCodes);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const myTeam =
    accessibleTeams.find((t) => t.id === selectedTeamId) ??
    accessibleTeams[0] ??
    null;

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );
  const divisionById = useMemo(
    () => new Map(divisions.map((d) => [d.id, d])),
    [divisions]
  );
  const seasonById = useMemo(
    () => new Map(seasons.map((s) => [s.id, s])),
    [seasons]
  );

  const activeSeason = useMemo(
    () => seasons.find((s) => s.slug === selectedSeasonSlug) ?? seasons[0] ?? null,
    [seasons, selectedSeasonSlug]
  );

  if (!myTeam) {
    return (
      <RetroWindow
        title={`Team Hub${activeSeason ? ` — ${activeSeason.name}` : ""}`}
        theme="scdl"
      >
        <div className="p-6 text-center text-xs text-[#a6a89e]">
          No active teams found.
        </div>
      </RetroWindow>
    );
  }

  const canManageCodes = codeAccessSet.has(myTeam.id);

  const myDiv = divisionById.get(myTeam.division_id) ?? null;
  const mySeason = (myDiv ? seasonById.get(myDiv.season_id) : null) ?? activeSeason;
  const seasonQuery = mySeason?.slug
    ? `?season=${encodeURIComponent(mySeason.slug)}`
    : "";

  const myMatches = matches
    .filter((m) => m.team_a_id === myTeam.id || m.team_b_id === myTeam.id)
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      if (a.stage !== b.stage) return a.stage === "regular" ? -1 : 1;
      return a.round_number - b.round_number;
    });

  const upcomingMatches = myMatches.filter((m) => m.status !== "completed");
  const nextMatch = upcomingMatches[0] ?? myMatches[0] ?? null;
  const remainingSchedule = nextMatch
    ? myMatches.filter((m) => m.id !== nextMatch.id)
    : [];

  const myRoster = normalizeRoster(myTeam.roster, myTeam.captain);
  const myStat = teamStatsMap[myTeam.id];

  function resolveOpponent(match: SeasonMatch): Team | null {
    const oppId =
      match.team_a_id === myTeam.id ? match.team_b_id : match.team_a_id;
    return oppId ? teamById.get(oppId) ?? null : null;
  }

  function resolvePlayerHref(name: string): string | null {
    const clean = name.trim().toLowerCase();
    const key = playerKeyByName[clean] ?? playerKeyByName[clean.split("#")[0]];
    return key
      ? `/stats/player/${encodeURIComponent(key)}${seasonQuery}`
      : null;
  }

  async function handleGenerateCode(matchId: string, gameNumber: number) {
    const opKey = `${matchId}-${gameNumber}`;
    setGeneratingKey(opKey);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/matches/tournament-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, gameNumber }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        codeRow?: TournamentCode;
        error?: string;
      };
      if (!res.ok || !json.codeRow) {
        throw new Error(json.error || `Failed (${res.status})`);
      }
      setCodes((prev) => {
        const filtered = prev.filter(
          (c) => !(c.match_id === matchId && c.game_number === gameNumber)
        );
        return [...filtered, json.codeRow!];
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate tournament code"
      );
    } finally {
      setGeneratingKey(null);
    }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  }

  const nextOpponent = nextMatch ? resolveOpponent(nextMatch) : null;
  const nextOppRoster = nextOpponent
    ? normalizeRoster(nextOpponent.roster, nextOpponent.captain)
    : [];
  const nextOppStat = nextOpponent ? teamStatsMap[nextOpponent.id] : undefined;

  return (
    <RetroWindow
      title={`Team Hub${mySeason ? ` — ${mySeason.name}` : ""}`}
      theme="scdl"
      statusText={errorMsg ?? undefined}
    >
      <div className="space-y-4">
        {/* Season & Team Switchers */}
        {(seasons.length > 1 || accessibleTeams.length > 1) && (
          <div className="xp-panel p-2.5 flex flex-wrap items-center justify-between gap-3">
            {seasons.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#a6a89e]">
                  League / Season
                </span>
                <select
                  value={selectedSeasonSlug}
                  onChange={(e) => {
                    const slug = e.target.value;
                    router.push(
                      slug ? `/team-hub?season=${encodeURIComponent(slug)}` : "/team-hub"
                    );
                  }}
                  className="xp-inset px-2.5 py-1 text-xs font-bold"
                >
                  {seasons.map((s) => {
                    const leagueObj = Array.isArray(s.leagues)
                      ? s.leagues[0]
                      : (s.leagues as
                          | { name?: string; short_name?: string }
                          | null
                          | undefined);
                    const prefix = leagueObj?.short_name || leagueObj?.name;
                    return (
                      <option key={s.id} value={s.slug}>
                        {prefix ? `${prefix}: ` : ""}
                        {s.name}
                        {!s.is_active ? " (Inactive)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {accessibleTeams.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#a6a89e]">
                  Viewing Team
                </span>
                <select
                  value={myTeam.id}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="xp-inset px-2.5 py-1 text-xs font-bold"
                >
                  {accessibleTeams.map((t) => {
                    const div = divisionById.get(t.division_id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {div ? ` (${div.name})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Block 1: Next Match Spotlight + Block 2: My Team */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Block 1: Next Match Spotlight */}
          <div className="lg:col-span-8 xp-panel p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-[#f0c020]" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
                  Next Match Spotlight
                </h2>
              </div>
              {nextMatch && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-black/50 border border-[#c89b3c]/50 text-[#f0c020] font-bold">
                    {nextMatch.round_label} · Bo{nextMatch.best_of}
                  </span>
                  {nextMatch.scheduled_at && (
                    <span className="text-[#a6a89e]">
                      <LocalTimestamp iso={nextMatch.scheduled_at} />
                    </span>
                  )}
                </div>
              )}
            </div>

            {!nextMatch ? (
              <div className="xp-inset p-5 text-center text-xs text-[#a6a89e]">
                No upcoming scheduled matches for <strong>{myTeam.name}</strong> yet.
              </div>
            ) : (
              <>
                {/* Opponent Header */}
                <div className="xp-inset p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {nextOpponent?.logo_url && (
                      <img
                        src={nextOpponent.logo_url}
                        alt={nextOpponent.name}
                        className="w-11 h-11 object-contain shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                        Next Opponent
                      </div>
                      <div className="text-base font-extrabold text-[#f0ede0] truncate">
                        {nextOpponent?.name ?? "TBD"}
                      </div>
                      {nextOppStat && (
                        <div className="text-[11px] text-[#c7c5b8]">
                          {nextOppStat.seed != null
                            ? `Seed #${nextOppStat.seed} · `
                            : ""}
                          {nextOppStat.wins}W - {nextOppStat.losses}L
                        </div>
                      )}
                    </div>
                  </div>
                  {nextOpponent && (
                    <Link
                      href={`/stats/team/${encodeURIComponent(
                        nextOpponent.id
                      )}${seasonQuery}`}
                      prefetch={false}
                      className="xp-btn xp-btn-primary text-xs"
                    >
                      <span>Scout Opponent</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {/* Opponent Roster */}
                {nextOppRoster.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                      Opponent Lineup
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                      {nextOppRoster.map((slot, idx) => {
                        const meta = getRoleMeta(slot.role as LeagueRole);
                        const pHref = resolvePlayerHref(slot.name);
                        const displayName = slot.name.split("#")[0].trim();
                        return (
                          <div
                            key={`${slot.role}-${idx}`}
                            className="xp-inset px-2 py-1.5 flex items-center gap-1.5 min-w-0"
                          >
                            <img
                              src={meta.icon}
                              alt={meta.label}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                            {pHref ? (
                              <Link
                                href={pHref}
                                prefetch={false}
                                className="text-xs font-bold text-[#f0ede0] hover:text-[#f0c020] hover:underline truncate"
                              >
                                {displayName}
                              </Link>
                            ) : (
                              <span className="text-xs font-bold text-[#c7c5b8] truncate">
                                {displayName}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tournament Codes (Captains / Operators / Admins only) */}
                {canManageCodes && (
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#7cd438]" />
                        <span>Tournament Lobby Codes</span>
                      </span>
                      <span>Copy &amp; paste in LoL Custom Lobby</span>
                    </div>
                    <div className="space-y-1.5">
                      {Array.from(
                        { length: Math.max(1, nextMatch.best_of) },
                        (_, i) => i + 1
                      ).map((gNum) => {
                        const codeRow = codes.find(
                          (c) =>
                            c.match_id === nextMatch.id && c.game_number === gNum
                        );
                        const busyKey = `${nextMatch.id}-${gNum}`;
                        return (
                          <div
                            key={busyKey}
                            className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-black/40 border border-white/10 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#c89b3c] tabular-nums">
                                Game {gNum}
                              </span>
                              {codeRow ? (
                                <>
                                  <code className="px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[#7cd438] font-mono text-[11px]">
                                    {codeRow.code}
                                  </code>
                                  {codeRow.provider === "placeholder" && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#2a2210] border border-[#c89b3c]/50 text-[9px] font-bold uppercase text-[#f0c020]">
                                      Preview Code
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-[#a6a89e] text-[11px]">
                                  Not generated yet
                                </span>
                              )}
                            </div>
                            {codeRow ? (
                              <button
                                type="button"
                                onClick={() => handleCopyCode(codeRow.code)}
                                className="xp-btn text-[11px] px-2.5 py-1"
                              >
                                {copiedCode === codeRow.code ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#7cd438]" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={generatingKey === busyKey}
                                onClick={() =>
                                  handleGenerateCode(nextMatch.id, gNum)
                                }
                                className="xp-btn xp-btn-primary text-[11px] px-2.5 py-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>
                                  {generatingKey === busyKey
                                    ? "Generating..."
                                    : "Generate Code"}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Block 2: Roster Panel */}
          <div className="lg:col-span-4 xp-panel p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
              <Users className="w-4 h-4 text-[#f0c020] shrink-0" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020] truncate">
                Roster
              </h2>
            </div>

            <Link
              href={`/stats/team/${encodeURIComponent(
                myTeam.id
              )}${seasonQuery}`}
              prefetch={false}
              className="xp-inset p-3 flex items-center justify-between gap-3 hover:border-[#f0c020]/70 hover:bg-[#f0c020]/5 transition group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {myTeam.logo_url && (
                  <img
                    src={myTeam.logo_url}
                    alt={myTeam.name}
                    className="w-10 h-10 object-contain shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#f0ede0] group-hover:text-[#f0c020] transition truncate">
                    {myTeam.name}
                  </div>
                  <div className="text-[11px] text-[#a6a89e]">
                    {myDiv?.name ?? "Division"}
                    {myStat
                      ? ` · ${
                          myStat.seed != null ? `#${myStat.seed} · ` : ""
                        }${myStat.wins}W - ${myStat.losses}L`
                      : ""}
                  </div>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#a6a89e] group-hover:text-[#f0c020] shrink-0" />
            </Link>

            <div className="space-y-1">
              {myRoster.map((slot, idx) => {
                const meta = getRoleMeta(slot.role as LeagueRole);
                const pHref = resolvePlayerHref(slot.name);
                const displayName = slot.name.split("#")[0].trim();
                return (
                  <div
                    key={`${slot.role}-${idx}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-black/35 border border-white/10 text-xs"
                  >
                    <img
                      src={meta.icon}
                      alt={meta.label}
                      className="w-4 h-4 object-contain shrink-0"
                    />
                    <span className="text-[10px] font-bold uppercase text-[#a6a89e] w-14 shrink-0">
                      {meta.label}
                    </span>
                    {pHref ? (
                      <Link
                        href={pHref}
                        prefetch={false}
                        className="font-bold text-[#f0ede0] hover:text-[#f0c020] hover:underline truncate"
                      >
                        {displayName}
                      </Link>
                    ) : (
                      <span className="font-bold text-[#c7c5b8] truncate">
                        {displayName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Block 3: Full Upcoming Schedule */}
        <div className="xp-panel p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#f0c020]" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
                Schedule ({myMatches.length})
              </h2>
            </div>
          </div>

          {remainingSchedule.length === 0 ? (
            <div className="text-xs text-[#a6a89e] py-2">
              {nextMatch
                ? "No additional scheduled matches beyond the spotlight match above."
                : "No scheduled matches found."}
            </div>
          ) : (
            <div className="space-y-1.5">
              {remainingSchedule.map((m) => {
                const opp = resolveOpponent(m);
                const matchCodes = codes.filter((c) => c.match_id === m.id);
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-black/35 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-black/60 border border-white/15 text-[10px] font-bold text-[#c89b3c] shrink-0">
                        {m.round_label} · Bo{m.best_of}
                      </span>
                      {opp?.logo_url && (
                        <img
                          src={opp.logo_url}
                          alt={opp.name}
                          className="w-5 h-5 object-contain shrink-0"
                        />
                      )}
                      <span className="font-bold text-[#f0ede0] truncate">
                        vs {opp?.name ?? "TBD"}
                      </span>
                      {m.scheduled_at && (
                        <span className="text-[11px] text-[#a6a89e] hidden sm:inline">
                          <LocalTimestamp iso={m.scheduled_at} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canManageCodes &&
                        (matchCodes.length > 0 ? (
                          <span className="text-[10px] text-[#7cd438] font-bold">
                            {matchCodes.length} code(s) ready
                          </span>
                        ) : (
                          m.status !== "completed" && (
                            <button
                              type="button"
                              disabled={generatingKey === `${m.id}-1`}
                              onClick={() => handleGenerateCode(m.id, 1)}
                              className="xp-btn text-[11px] px-2 py-0.5"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Gen G1 Code</span>
                            </button>
                          )
                        ))}
                      {opp && (
                        <Link
                          href={`/stats/team/${encodeURIComponent(
                            opp.id
                          )}${seasonQuery}`}
                          prefetch={false}
                          className="xp-btn text-[11px] px-2.5 py-0.5"
                        >
                          Scout &rarr;
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RetroWindow>
  );
}

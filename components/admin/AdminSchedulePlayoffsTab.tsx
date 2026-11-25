"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type {
  Division,
  DivisionPlayoffBracket,
  PlayoffBracketFormat,
  PlayoffBracketSeedSlot,
  Season,
  SeasonConfigBackup,
  SeasonMatch,
  Team,
} from "@/types/database";
import {
  buildStandardPlayoffBracket,
  getSeedCountForFormat,
} from "@/utils/playoffBrackets";
import { Calendar, Plus, RotateCcw, Save, Trash2, Trophy } from "lucide-react";

interface AdminSchedulePlayoffsTabProps {
  season: Season;
  divisions: Division[];
  selectedDivId: string;
  teams: Team[];
  matches: SeasonMatch[];
  backups: SeasonConfigBackup[];
  currentUserId: string;
  busy: boolean;
  onSavePlayoffBracket: (
    season: Season,
    divisionId: string,
    divisionName: string,
    bracket: DivisionPlayoffBracket | null
  ) => Promise<void>;
  onRevalidate: () => void;
  onRefresh: () => Promise<void>;
  onStatusMsg: (msg: string) => void;
}

function generateRoundRobinPairings(
  teamIds: string[]
): { roundNumber: number; teamAId: string; teamBId: string }[] {
  if (teamIds.length < 2) return [];
  const pool: (string | null)[] = [...teamIds];
  if (pool.length % 2 === 1) pool.push(null);
  const n = pool.length;
  const totalRounds = n - 1;
  const result: { roundNumber: number; teamAId: string; teamBId: string }[] = [];

  for (let r = 0; r < totalRounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = pool[i];
      const b = pool[n - 1 - i];
      if (a && b) {
        result.push({
          roundNumber: r + 1,
          teamAId: r % 2 === 0 ? a : b,
          teamBId: r % 2 === 0 ? b : a,
        });
      }
    }
    const fixed = pool[0];
    const last = pool.pop()!;
    pool.splice(1, 0, last);
    pool[0] = fixed;
  }

  return result;
}

export function AdminSchedulePlayoffsTab({
  season,
  divisions,
  selectedDivId,
  teams,
  matches,
  backups,
  currentUserId,
  busy,
  onSavePlayoffBracket,
  onRevalidate,
  onRefresh,
  onStatusMsg,
}: AdminSchedulePlayoffsTabProps) {
  const supabase = createClient();
  const [localBusy, setLocalBusy] = useState(false);

  // Add match form state
  const [newStage, setNewStage] = useState<"regular" | "playoffs">("regular");
  const [newRoundNum, setNewRoundNum] = useState<number>(1);
  const [newBestOf, setNewBestOf] = useState<number>(
    season.default_best_of ?? 1
  );
  const [newTeamAId, setNewTeamAId] = useState<string>("");
  const [newTeamBId, setNewTeamBId] = useState<string>("");
  const [newScheduledAt, setNewScheduledAt] = useState<string>("");

  // Playoff bracket draft state per division
  const [bracketFormat, setBracketFormat] =
    useState<PlayoffBracketFormat>("4-team");
  const [seedTeamIds, setSeedTeamIds] = useState<string[]>(["", "", "", ""]);

  const activeDiv =
    divisions.find((d) => d.id === selectedDivId) ?? divisions[0] ?? null;

  const savedBracket = activeDiv
    ? season.playoff_brackets?.[activeDiv.id] ?? null
    : null;

  useEffect(() => {
    const fmt = savedBracket?.format ?? "4-team";
    const cnt = getSeedCountForFormat(fmt);
    setBracketFormat(fmt);
    setSeedTeamIds(
      Array.from({ length: cnt }, (_, idx) => {
        return savedBracket?.seeds.find((sd) => sd.seed === idx + 1)?.teamId ?? "";
      })
    );
  }, [activeDiv?.id, savedBracket]);

  useEffect(() => {
    setNewBestOf(season.default_best_of ?? 1);
  }, [season.id, season.default_best_of]);

  if (!activeDiv) {
    return (
      <div className="xp-panel p-6 text-center text-xs text-[#a6a89e]">
        Add divisions to this season before configuring schedules or playoffs.
      </div>
    );
  }

  const divId = activeDiv.id;
  const divName = activeDiv.name;

  const divTeams = [...teams]
    .filter((t) => t.division_id === divId && t.is_active)
    .sort((a, b) => a.default_order - b.default_order || a.name.localeCompare(b.name));
  const teamById = new Map(divTeams.map((t) => [t.id, t]));

  const divMatches = matches
    .filter((m) => m.season_id === season.id && m.division_id === divId)
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage === "regular" ? -1 : 1;
      return a.round_number - b.round_number;
    });

  const divBackups = backups
    .filter(
      (b) =>
        b.season_id === season.id &&
        (b.division_id === divId || b.division_id === null)
    )
    .slice(0, 10);

  const isDisabled = busy || localBusy;
  const roundTerm = season.stats_round_label?.trim() || "Round";

  async function saveBackupSnapshot(
    type: "schedule" | "playoff_bracket",
    label: string,
    payload: unknown
  ) {
    await supabase.from("season_config_backups").insert({
      season_id: season.id,
      division_id: divId,
      backup_type: type,
      label,
      payload,
      created_by: currentUserId,
    });
  }

  async function handleGenerateRoundRobin() {
    if (divTeams.length < 2) {
      onStatusMsg("Need at least 2 active teams in this division.");
      return;
    }
    const regularExisting = divMatches.filter((m) => m.stage === "regular");
    if (
      regularExisting.length > 0 &&
      !window.confirm(
        `Replace ${regularExisting.length} existing regular-season matches for ${divName}? (A backup snapshot will be saved first.)`
      )
    ) {
      return;
    }

    setLocalBusy(true);
    try {
      if (regularExisting.length > 0) {
        await saveBackupSnapshot(
          "schedule",
          `Before Round Robin (${divName})`,
          regularExisting
        );
        const { error: delErr } = await supabase
          .from("season_matches")
          .delete()
          .eq("season_id", season.id)
          .eq("division_id", divId)
          .eq("stage", "regular");
        if (delErr) throw new Error(delErr.message);
      }

      const pairings = generateRoundRobinPairings(divTeams.map((t) => t.id));
      const rows = pairings.map((p) => ({
        season_id: season.id,
        division_id: divId,
        stage: "regular" as const,
        round_number: p.roundNumber,
        round_label: `${roundTerm} ${p.roundNumber}`,
        best_of: season.default_best_of ?? 1,
        team_a_id: p.teamAId,
        team_b_id: p.teamBId,
        status: "scheduled" as const,
      }));

      const { error: insErr } = await supabase
        .from("season_matches")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);

      onStatusMsg(
        `Generated ${rows.length} regular-season matches for ${divName}.`
      );
      onRevalidate();
      await onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate schedule";
      onStatusMsg(
        msg.includes("relation")
          ? "Error: Run migration 038_schedule_captains_tournaments.sql first."
          : `Error: ${msg}`
      );
    } finally {
      setLocalBusy(false);
    }
  }

  async function handleAddMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamAId || !newTeamBId || newTeamAId === newTeamBId) {
      onStatusMsg("Select two different teams.");
      return;
    }
    setLocalBusy(true);
    try {
      const label =
        newStage === "playoffs"
          ? `Playoffs R${newRoundNum}`
          : `${roundTerm} ${newRoundNum}`;
      const { error } = await supabase.from("season_matches").insert({
        season_id: season.id,
        division_id: divId,
        stage: newStage,
        round_number: newRoundNum,
        round_label: label,
        best_of: newBestOf,
        team_a_id: newTeamAId,
        team_b_id: newTeamBId,
        scheduled_at: newScheduledAt
          ? new Date(newScheduledAt).toISOString()
          : null,
        status: "scheduled",
      });
      if (error) throw new Error(error.message);
      setNewTeamAId("");
      setNewTeamBId("");
      setNewScheduledAt("");
      onStatusMsg(`Added ${label} match.`);
      await onRefresh();
    } catch (err) {
      onStatusMsg(
        `Error: ${err instanceof Error ? err.message : "Failed to add match"}`
      );
    } finally {
      setLocalBusy(false);
    }
  }

  async function handleUpdateMatch(
    matchId: string,
    patch: Partial<Pick<SeasonMatch, "status" | "best_of" | "scheduled_at">>
  ) {
    setLocalBusy(true);
    const { error } = await supabase
      .from("season_matches")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", matchId);
    if (error) {
      onStatusMsg(`Error: ${error.message}`);
    } else {
      await onRefresh();
    }
    setLocalBusy(false);
  }

  async function handleDeleteMatch(matchId: string) {
    setLocalBusy(true);
    const { error } = await supabase
      .from("season_matches")
      .delete()
      .eq("id", matchId);
    if (error) {
      onStatusMsg(`Error: ${error.message}`);
    } else {
      onStatusMsg("Deleted scheduled match.");
      await onRefresh();
    }
    setLocalBusy(false);
  }

  async function handleSaveBracketWithBackup() {
    const seedCount = getSeedCountForFormat(bracketFormat);
    if (seedTeamIds.some((id) => !id)) {
      onStatusMsg(`Error: Select all ${seedCount} seed teams before saving.`);
      return;
    }
    if (new Set(seedTeamIds).size !== seedCount) {
      onStatusMsg("Error: Each seed must be a different team.");
      return;
    }

    const confirmedSeeds: PlayoffBracketSeedSlot[] = seedTeamIds.map(
      (tid, idx) => {
        const tm = teamById.get(tid);
        return {
          seed: idx + 1,
          teamId: tid,
          teamName: tm?.name ?? tid,
          logoUrl: tm?.logo_url ?? null,
        };
      }
    );
    const nextBracket = buildStandardPlayoffBracket(
      bracketFormat,
      confirmedSeeds
    );

    if (savedBracket) {
      await saveBackupSnapshot(
        "playoff_bracket",
        `Before updating ${savedBracket.format} (${divName})`,
        savedBracket
      );
    }
    await onSavePlayoffBracket(season, divId, divName, nextBracket);
  }

  async function handleClearBracketWithBackup() {
    if (savedBracket) {
      await saveBackupSnapshot(
        "playoff_bracket",
        `Before clearing ${savedBracket.format} (${divName})`,
        savedBracket
      );
    }
    await onSavePlayoffBracket(season, divId, divName, null);
  }

  async function handleRestoreBackup(backup: SeasonConfigBackup) {
    if (!window.confirm(`Restore backup "${backup.label || backup.backup_type}"?`)) {
      return;
    }
    setLocalBusy(true);
    try {
      if (backup.backup_type === "playoff_bracket") {
        await onSavePlayoffBracket(
          season,
          divId,
          divName,
          backup.payload as DivisionPlayoffBracket
        );
      } else if (backup.backup_type === "schedule" && Array.isArray(backup.payload)) {
        await supabase
          .from("season_matches")
          .delete()
          .eq("season_id", season.id)
          .eq("division_id", divId)
          .eq("stage", "regular");
        const restoreRows = (backup.payload as SeasonMatch[]).map((m) => ({
          season_id: season.id,
          division_id: divId,
          stage: m.stage,
          round_number: m.round_number,
          round_label: m.round_label,
          best_of: m.best_of,
          team_a_id: m.team_a_id,
          team_b_id: m.team_b_id,
          scheduled_at: m.scheduled_at,
          status: m.status,
          bracket_slot_id: m.bracket_slot_id,
        }));
        if (restoreRows.length > 0) {
          const { error } = await supabase
            .from("season_matches")
            .insert(restoreRows);
          if (error) throw new Error(error.message);
        }
        onStatusMsg(`Restored ${restoreRows.length} scheduled matches.`);
        onRevalidate();
        await onRefresh();
      }
    } catch (err) {
      onStatusMsg(
        `Error: ${err instanceof Error ? err.message : "Failed to restore backup"}`
      );
    } finally {
      setLocalBusy(false);
    }
  }

  const seedCount = getSeedCountForFormat(bracketFormat);
  const previewSlots: PlayoffBracketSeedSlot[] = seedTeamIds.map((tid, idx) => {
    const tm = teamById.get(tid);
    return {
      seed: idx + 1,
      teamId: tid,
      teamName: tm?.name ?? `Seed #${idx + 1}`,
      logoUrl: tm?.logo_url ?? null,
    };
  });
  const round1Matches = buildStandardPlayoffBracket(
    bracketFormat,
    previewSlots
  ).matches.filter((m) => m.roundOrder === 1 && m.bracketSide !== "lower");

  return (
    <div className="space-y-4">
      {/* Match Schedule Section */}
      <div className="xp-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-[#f0c020]" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
              Match Schedule
            </h3>
            <span className="text-[11px] text-[#a6a89e]">
              ({divTeams.length} teams · {divMatches.length} scheduled matches)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {divisions.some(
              (d) =>
                d.id !== activeDiv.id &&
                matches.some(
                  (m) => m.season_id === season.id && m.division_id === d.id
                )
            ) && (
              <select
                value=""
                disabled={isDisabled}
                onChange={async (e) => {
                  const srcDivId = e.target.value;
                  if (!srcDivId) return;
                  const srcDiv = divisions.find((d) => d.id === srcDivId);
                  const srcMatches = matches.filter(
                    (m) =>
                      m.season_id === season.id && m.division_id === srcDivId
                  );
                  if (srcMatches.length === 0) return;
                  if (
                    divMatches.length > 0 &&
                    !window.confirm(
                      `Copy ${srcMatches.length} match slots from ${srcDiv?.name ?? "selected division"} into ${divName}? (Existing schedule will be backed up first.)`
                    )
                  ) {
                    return;
                  }
                  setLocalBusy(true);
                  try {
                    if (divMatches.length > 0) {
                      await saveBackupSnapshot(
                        "schedule",
                        `Before copying from ${srcDiv?.name ?? "division"}`,
                        divMatches
                      );
                      await supabase
                        .from("season_matches")
                        .delete()
                        .eq("season_id", season.id)
                        .eq("division_id", divId);
                    }
                    const copyRows = srcMatches.map((m) => ({
                      season_id: season.id,
                      division_id: divId,
                      stage: m.stage,
                      round_number: m.round_number,
                      round_label: m.round_label,
                      best_of: m.best_of,
                      scheduled_at: m.scheduled_at,
                      status: "scheduled" as const,
                    }));
                    const { error } = await supabase
                      .from("season_matches")
                      .insert(copyRows);
                    if (error) throw new Error(error.message);
                    onStatusMsg(
                      `Copied ${copyRows.length} match slots from ${srcDiv?.name ?? "division"} into ${divName} (assign teams below).`
                    );
                    await onRefresh();
                  } catch (err) {
                    onStatusMsg(
                      `Error: ${
                        err instanceof Error
                          ? err.message
                          : "Failed to copy schedule"
                      }`
                    );
                  } finally {
                    setLocalBusy(false);
                  }
                }}
                className="xp-inset px-2 py-1 text-xs"
              >
                <option value="">Copy schedule from...</option>
                {divisions
                  .filter(
                    (d) =>
                      d.id !== activeDiv.id &&
                      matches.some(
                        (m) =>
                          m.season_id === season.id && m.division_id === d.id
                      )
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            )}
            <button
              type="button"
              disabled={isDisabled || divTeams.length < 2}
              onClick={handleGenerateRoundRobin}
              className="xp-btn xp-btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Auto-Generate Round Robin</span>
            </button>
          </div>
        </div>

        {/* Add individual match */}
        <form
          onSubmit={handleAddMatch}
          className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end xp-inset p-2.5"
        >
          <div>
            <label className="block text-[10px] font-bold text-[#c7c5b8]">
              Stage
            </label>
            <select
              value={newStage}
              onChange={(e) =>
                setNewStage(e.target.value as "regular" | "playoffs")
              }
              className="w-full xp-inset px-2 py-1 text-xs"
            >
              <option value="regular">Regular</option>
              <option value="playoffs">Playoffs</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#c7c5b8]">
              {roundTerm} #
            </label>
            <input
              type="number"
              min={1}
              value={newRoundNum}
              onChange={(e) => setNewRoundNum(Math.max(1, Number(e.target.value)))}
              className="w-full xp-inset px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#c7c5b8]">
              Team A
            </label>
            <select
              value={newTeamAId}
              onChange={(e) => setNewTeamAId(e.target.value)}
              className="w-full xp-inset px-2 py-1 text-xs"
            >
              <option value="">Select Team A</option>
              {divTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#c7c5b8]">
              Team B
            </label>
            <select
              value={newTeamBId}
              onChange={(e) => setNewTeamBId(e.target.value)}
              className="w-full xp-inset px-2 py-1 text-xs"
            >
              <option value="">Select Team B</option>
              {divTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#c7c5b8]">
              Format / Date
            </label>
            <div className="flex gap-1">
              <select
                value={newBestOf}
                onChange={(e) => setNewBestOf(Number(e.target.value))}
                className="w-16 xp-inset px-1 py-1 text-xs"
              >
                <option value={1}>Bo1</option>
                <option value={3}>Bo3</option>
                <option value={5}>Bo5</option>
              </select>
              <input
                type="datetime-local"
                value={newScheduledAt}
                onChange={(e) => setNewScheduledAt(e.target.value)}
                className="flex-1 min-w-0 xp-inset px-1.5 py-1 text-[11px]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isDisabled}
            className="xp-btn xp-btn-primary text-xs justify-center py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Match</span>
          </button>
        </form>

        {/* Matches List */}
        {divMatches.length === 0 ? (
          <div className="text-xs text-[#a6a89e] text-center py-4 xp-inset">
            No scheduled matches yet. Use <strong>Auto-Generate Round Robin</strong> or add matches above.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {divMatches.map((m) => {
              const tA = m.team_a_id ? teamById.get(m.team_a_id) : null;
              const tB = m.team_b_id ? teamById.get(m.team_b_id) : null;
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-black/35 border border-white/10 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-[10px] font-bold text-[#c89b3c] shrink-0">
                      {m.round_label}
                    </span>
                    <span className="font-bold text-[#f0ede0] truncate">
                      {tA?.name ?? "TBD"} <span className="text-[#a6a89e]">vs</span>{" "}
                      {tB?.name ?? "TBD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={m.best_of}
                      disabled={isDisabled}
                      onChange={(e) =>
                        handleUpdateMatch(m.id, {
                          best_of: Number(e.target.value),
                        })
                      }
                      className="xp-inset px-1.5 py-0.5 text-[11px]"
                    >
                      <option value={1}>Bo1</option>
                      <option value={3}>Bo3</option>
                      <option value={5}>Bo5</option>
                    </select>
                    <select
                      value={m.status}
                      disabled={isDisabled}
                      onChange={(e) =>
                        handleUpdateMatch(m.id, {
                          status: e.target.value as SeasonMatch["status"],
                        })
                      }
                      className="xp-inset px-1.5 py-0.5 text-[11px]"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDeleteMatch(m.id)}
                      className="xp-btn px-1.5 py-0.5 text-[11px] text-[#ff857a]"
                      title="Delete match"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Playoff Bracket Builder Section */}
      <div className="xp-panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#f0c020]" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
              Playoff Bracket
            </h3>
          </div>
          <select
            value={bracketFormat}
            onChange={(e) => {
              const nextFmt = e.target.value as PlayoffBracketFormat;
              const nextCnt = getSeedCountForFormat(nextFmt);
              setBracketFormat(nextFmt);
              setSeedTeamIds((prev) =>
                Array.from({ length: nextCnt }, (_, idx) => prev[idx] ?? "")
              );
            }}
            className="xp-inset px-2.5 py-1 text-xs"
          >
            <option value="4-team">4-Team Single Elim (Semifinals → Finals)</option>
            <option value="6-team">6-Team Single Elim (Top 2 Bye)</option>
            <option value="8-team">8-Team Single Elim (QF → SF → Finals)</option>
            <option value="4-team-double">4-Team Double Elim (Upper + Lower)</option>
            <option value="8-team-double">8-Team Double Elim (Upper + Lower)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Left Pane: Seeds List */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
              Seeds
            </div>
            <div className="space-y-1.5">
              {seedTeamIds.slice(0, seedCount).map((tid, idx) => (
                <div key={`seed-${idx + 1}`} className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#f0c020] w-6 shrink-0 tabular-nums">
                    #{idx + 1}
                  </span>
                  <select
                    value={tid}
                    onChange={(e) => {
                      const next = [...seedTeamIds];
                      next[idx] = e.target.value;
                      setSeedTeamIds(next);
                    }}
                    className={`w-full xp-inset px-2 py-1 text-xs ${
                      tid ? "!border-[#7cd438]/60" : ""
                    }`}
                  >
                    <option value="">— Select Seed #{idx + 1} Team —</option>
                    {divTeams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Right Pane: Round 1 Matchup Preview List */}
          <div className="rounded border border-white/10 bg-black/35 px-3 py-2.5 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#a6a89e]">
              Round 1 Matchup Preview
            </div>
            <div className="space-y-1.5">
              {round1Matches.map((m) => {
                const tA = m.teamAId ? teamById.get(m.teamAId) : null;
                const tB = m.teamBId ? teamById.get(m.teamBId) : null;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-black/50 border border-white/15 text-xs text-[#e5e2d0]"
                  >
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="text-[#f0c020] font-black tabular-nums shrink-0">
                        #{m.teamASeed}
                      </span>
                      {tA?.logo_url && (
                        <img
                          src={tA.logo_url}
                          alt={tA.name}
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                      <span className="font-bold truncate">{tA?.name || "TBD"}</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#a6a89e] shrink-0">
                      vs
                    </span>
                    <span className="inline-flex items-center gap-1.5 min-w-0 justify-end">
                      <span className="text-[#f0c020] font-black tabular-nums shrink-0">
                        #{m.teamBSeed}
                      </span>
                      {tB?.logo_url && (
                        <img
                          src={tB.logo_url}
                          alt={tB.name}
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                      <span className="font-bold truncate">{tB?.name || "TBD"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {savedBracket && (
            <button
              type="button"
              disabled={isDisabled}
              onClick={handleClearBracketWithBackup}
              className="xp-btn text-xs text-[#ff857a]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Bracket</span>
            </button>
          )}
          <button
            type="button"
            disabled={isDisabled}
            onClick={handleSaveBracketWithBackup}
            className="xp-btn xp-btn-primary text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Bracket</span>
          </button>
        </div>

        {/* Config Backups & Restore */}
        {divBackups.length > 0 && (
          <details className="pt-2 border-t border-white/10 text-xs">
            <summary className="cursor-pointer text-[#a6a89e] hover:text-[#f0c020] font-semibold select-none">
              Backups &amp; Restore ({divBackups.length})
            </summary>
            <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto">
              {divBackups.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-black/30 border border-white/10"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#f0ede0] truncate">
                      {b.label || b.backup_type}
                    </div>
                    <div className="text-[10px] text-[#a6a89e]">
                      {new Date(b.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleRestoreBackup(b)}
                    className="xp-btn text-[11px] px-2.5 py-1 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

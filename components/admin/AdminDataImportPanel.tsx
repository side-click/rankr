"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { LEAGUE_ROLES } from "@/utils/roles";
import type { Season, Team } from "@/types/database";
import { FileSpreadsheet, Plus, Upload } from "lucide-react";

interface BulkTeamRosterImporterProps {
  divisionId: string;
  existingTeamCount: number;
  busy: boolean;
  onRevalidate: () => void;
  onRefresh: () => Promise<void>;
  onStatusMsg: (msg: string) => void;
}

export function BulkTeamRosterImporter({
  divisionId,
  existingTeamCount,
  busy,
  onRevalidate,
  onRefresh,
  onStatusMsg,
}: BulkTeamRosterImporterProps) {
  const supabase = createClient();
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);

  const parsedTeams = useMemo(() => {
    return rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.includes("\t")
          ? line.split("\t")
          : line.split(",");
        const clean = parts.map((p) => p.trim());
        const name = clean[0] ?? "";
        const players = clean.slice(1, 6);
        return { name, players };
      })
      .filter((t) => Boolean(t.name));
  }, [rawText]);

  async function handleImport() {
    if (!divisionId || parsedTeams.length === 0) return;
    setImporting(true);
    const rows = parsedTeams.map((t, idx) => ({
      division_id: divisionId,
      name: t.name,
      captain: t.players[0] ? t.players[0].split("#")[0].trim() : null,
      roster: LEAGUE_ROLES.map((r, rIdx) => ({
        role: r.key,
        name: t.players[rIdx] || `Player ${rIdx + 1}`,
        is_captain: rIdx === 0,
      })),
      default_order: existingTeamCount + idx + 1,
      is_active: true,
    }));

    const { error } = await supabase.from("teams").insert(rows);
    if (error) {
      onStatusMsg(`Error importing teams: ${error.message}`);
    } else {
      setRawText("");
      onStatusMsg(`Imported ${rows.length} teams into division.`);
      onRevalidate();
      await onRefresh();
    }
    setImporting(false);
  }

  return (
    <details className="xp-panel p-3 text-xs">
      <summary className="cursor-pointer font-extrabold uppercase tracking-wider text-[#f0c020] select-none flex items-center gap-2">
        <Plus className="w-3.5 h-3.5" />
        <span>Bulk Import Teams &amp; Rosters (CSV / Paste)</span>
      </summary>
      <div className="pt-3 space-y-2.5">
        <p className="text-[11px] text-[#a6a89e]">
          Paste one team per line: <code>Team Name, Top, Jungle, Mid, Bot, Support</code>
        </p>
        <textarea
          rows={5}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={"Checkmates, Beniona#NA1, Jungle#NA1, Mid#NA1, Zafa#NA1, Supp#NA1"}
          className="w-full xp-inset p-2 text-xs font-mono"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#c7c5b8]">
            {parsedTeams.length} teams ready to import
          </span>
          <button
            type="button"
            disabled={busy || importing || parsedTeams.length === 0}
            onClick={handleImport}
            className="xp-btn xp-btn-primary text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? "Importing..." : `Import ${parsedTeams.length} Teams`}</span>
          </button>
        </div>
      </div>
    </details>
  );
}

interface MatchStatsUploaderProps {
  season: Season;
  teams: Team[];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onStatusMsg: (msg: string) => void;
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function MatchStatsUploader({
  season,
  busy,
  onRefresh,
  onStatusMsg,
}: MatchStatsUploaderProps) {
  const [rawInput, setRawInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const parsedPayload = useMemo(() => {
    const trimmed = rawInput.trim();
    if (!trimmed) return { rows: [], gamesCount: 0, error: null as string | null };

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed);
        const matches = Array.isArray(json) ? json : [json];
        const rows: Record<string, unknown>[] = [];
        for (const m of matches) {
          const info = m?.info;
          const gameId = String(info?.gameId ?? m?.metadata?.matchId ?? "").trim();
          if (!gameId || !Array.isArray(info?.participants)) continue;
          const duration = Number(info.gameDuration ?? 0);
          for (const p of info.participants) {
            rows.push({
              game_id: gameId,
              match_label: String(info.gameName || gameId),
              team_name: String(p.teamId === 100 ? "Blue" : "Red"),
              player_name: p.riotIdGameName
                ? `${p.riotIdGameName}#${p.riotIdTagline || "NA1"}`
                : String(p.summonerName || ""),
              champion: String(p.championName || ""),
              role: String(p.teamPosition || p.individualPosition || "mid").toLowerCase(),
              side: p.teamId === 100 ? "Blue" : "Red",
              win: Boolean(p.win),
              game_length: duration,
              kills: Number(p.kills ?? 0),
              deaths: Number(p.deaths ?? 0),
              assists: Number(p.assists ?? 0),
              gold: Number(p.goldEarned ?? 0),
              cs: Number(p.totalMinionsKilled ?? 0) + Number(p.neutralMinionsKilled ?? 0),
              damage_dealt: Number(p.totalDamageDealtToChampions ?? 0),
              vision_score: Number(p.visionScore ?? 0),
            });
          }
        }
        const gamesCount = new Set(rows.map((r) => r.game_id)).size;
        return { rows, gamesCount, error: null };
      } catch {
        return { rows: [], gamesCount: 0, error: "Invalid Match-V5 JSON format" };
      }
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { rows: [], gamesCount: 0, error: "Need header row + at least 1 data row" };
    }
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const headers = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase());
    const colIdx = (aliases: string[]) =>
      headers.findIndex((h) => aliases.some((a) => h.includes(a)));

    const idxGame = colIdx(["gameid", "game_id", "game id"]);
    const idxMatch = colIdx(["match", "round", "week"]);
    const idxTeam = colIdx(["team"]);
    const idxPlayer = colIdx(["player", "summoner", "riot"]);
    const idxChamp = colIdx(["champ"]);
    const idxRole = colIdx(["role", "pos", "lane"]);
    const idxK = colIdx(["kills", "kill"]);
    const idxD = colIdx(["deaths", "death"]);
    const idxA = colIdx(["assists", "assist"]);
    const idxGold = colIdx(["gold"]);
    const idxCs = colIdx(["cs"]);
    const idxDmg = colIdx(["damage", "dmg"]);
    const idxVis = colIdx(["vision"]);
    const idxLen = colIdx(["length", "duration", "time"]);
    const idxWin = colIdx(["win", "result"]);
    const idxSide = colIdx(["side"]);

    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i], delim);
      const get = (idx: number) => (idx >= 0 ? cells[idx] ?? "" : "");
      const playerName = get(idxPlayer);
      if (!playerName) continue;
      const winRaw = get(idxWin).toLowerCase();
      rows.push({
        game_id: get(idxGame) || get(idxMatch) || `upload-${i}`,
        match_label: get(idxMatch) || get(idxGame) || "Uploaded Match",
        team_name: get(idxTeam) || "Unknown",
        player_name: playerName,
        champion: get(idxChamp) || "Unknown",
        role: (get(idxRole) || "mid").toLowerCase(),
        side: get(idxSide).toLowerCase() === "red" ? "Red" : "Blue",
        win: winRaw === "1" || winRaw === "true" || winRaw === "w" || winRaw === "win",
        game_length: Number(get(idxLen) || 0),
        kills: Number(get(idxK) || 0),
        deaths: Number(get(idxD) || 0),
        assists: Number(get(idxA) || 0),
        gold: Number(get(idxGold) || 0),
        cs: Number(get(idxCs) || 0),
        damage_dealt: Number(get(idxDmg) || 0),
        vision_score: Number(get(idxVis) || 0),
        row_order: i,
      });
    }
    const gamesCount = new Set(rows.map((r) => r.game_id)).size;
    return { rows, gamesCount, error: null };
  }, [rawInput]);

  async function handleUpload() {
    if (parsedPayload.rows.length === 0) return;
    setUploading(true);
    try {
      const res = await fetch("/api/admin/import-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId: season.id,
          rows: parsedPayload.rows,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        insertedCount?: number;
        gamesCount?: number;
      };
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
      setRawInput("");
      onStatusMsg(
        `Uploaded ${json.insertedCount ?? parsedPayload.rows.length} rows (${json.gamesCount ?? parsedPayload.gamesCount} games) into ${season.name}.`
      );
      await onRefresh();
    } catch (err) {
      onStatusMsg(
        `Error: ${err instanceof Error ? err.message : "Failed to import match data"}`
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <details className="xp-panel p-3 text-xs">
      <summary className="cursor-pointer font-extrabold uppercase tracking-wider text-[#f0c020] select-none flex items-center gap-2">
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span>Upload Match Stats (CSV or Match-V5 JSON → Supabase Native)</span>
      </summary>
      <div className="pt-3 space-y-2.5">
        <div className="space-y-1 text-[11px] text-[#a6a89e]">
          <p>
            For seasons using the <strong>Supabase Native</strong> stats provider (instead of Google Sheets): imports participant rows into{" "}
            <code>league_game_participants</code> for <strong>{season.name}</strong> (deduplicated by Game ID).
          </p>
          <p>
            <strong>CSV/TSV headers:</strong>{" "}
            <code>game_id, match, team, player, champion, role, kills, deaths, assists, gold, cs, damage, vision, length, win, side</code>
          </p>
          <p>
            <strong>Riot Match-V5 JSON:</strong> Paste a Match-V5 JSON object or array (with <code>info.participants</code>).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="xp-btn text-xs cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Choose File (.csv, .tsv, .json)</span>
            <input
              type="file"
              accept=".csv,.tsv,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFileName(file.name);
                  setRawInput(await file.text());
                }
              }}
              className="hidden"
            />
          </label>
          <span className="text-[11px] text-[#a6a89e]">
            {fileName || "No file chosen"}
          </span>
        </div>
        <textarea
          rows={5}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Paste CSV (with headers) or Riot Match-V5 JSON..."
          className="w-full xp-inset p-2 text-xs font-mono"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#c7c5b8]">
            {parsedPayload.error ? (
              <span className="text-[#ff857a]">{parsedPayload.error}</span>
            ) : (
              `${parsedPayload.rows.length} rows (${parsedPayload.gamesCount} games) parsed`
            )}
          </span>
          <button
            type="button"
            disabled={busy || uploading || parsedPayload.rows.length === 0}
            onClick={handleUpload}
            className="xp-btn xp-btn-primary text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? "Uploading..." : "Upload to Supabase Native"}</span>
          </button>
        </div>
      </div>
    </details>
  );
}

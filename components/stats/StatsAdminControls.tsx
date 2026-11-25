"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Megaphone,
  RefreshCw,
  Users,
} from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { MatchDraftForm } from "@/components/stats/MatchDraftForm";
import { sanitizeExternalUrl } from "@/utils/sanitizeUrl";
import type { DraftImportSummary } from "@/utils/draftImporter";
import type {
  DraftIntegrityIssue,
  IncompleteDataGame,
  UnrosteredSheetPlayer,
} from "@/utils/leagueStats";
import type { AggregatedPlayerStats } from "@/utils/riotStatsAggregation";

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

export interface AdminControlsSheetSummary {
  rowCount: number;
  matchCount: number;
  unrosteredPlayers: UnrosteredSheetPlayer[];
  missingDraftGames: { gameId: string; matchLabel: string }[];
  incompleteDataGames: IncompleteDataGame[];
  draftIntegrityIssues: DraftIntegrityIssue[];
}

interface StatsAdminControlsProps {
  seasonId: string | null;
  ddVersion: string;
  missingTable: boolean;
  sheetData: AdminControlsSheetSummary | null;
  sheetLoading: boolean;
  sheetError: string | null;
  setSheetError: (err: string | null) => void;
  importingDrafts: boolean;
  draftImportResult: DraftImportSummary | null;
  setDraftImportResult: (res: DraftImportSummary | null) => void;
  showIncompleteDetails: boolean;
  setShowIncompleteDetails: React.Dispatch<React.SetStateAction<boolean>>;
  missingDataPlayers: AggregatedPlayerStats[];
  statsNotice: string | null;
  noticeDraft: string;
  setNoticeDraft: (next: string) => void;
  savingNotice: boolean;
  noticeError: string | null;
  onOpenUnrosteredModal: () => void;
  onImportMissingDrafts: () => void;
  onRefreshSheet: () => void;
  onSaveNotice: (nextNotice: string | null) => void;
}

export function StatsAdminControls({
  seasonId,
  ddVersion,
  missingTable,
  sheetData,
  sheetLoading,
  sheetError,
  setSheetError,
  importingDrafts,
  draftImportResult,
  setDraftImportResult,
  showIncompleteDetails,
  setShowIncompleteDetails,
  missingDataPlayers,
  statsNotice,
  noticeDraft,
  setNoticeDraft,
  savingNotice,
  noticeError,
  onOpenUnrosteredModal,
  onImportMissingDrafts,
  onRefreshSheet,
  onSaveNotice,
}: StatsAdminControlsProps) {
  return (
    <>
      <RetroWindow title="Admin Controls" theme="xp">
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center">
              <Link
                href="/admin"
                prefetch={false}
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
                  onClick={onOpenUnrosteredModal}
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
                disabled={importingDrafts || sheetLoading}
                onClick={onImportMissingDrafts}
                title="Auto-import missing drafts from configured Schedule / Draft Links Google Sheet tab"
                className="xp-btn text-xs justify-center disabled:opacity-50"
              >
                <Download
                  className={`w-3.5 h-3.5 text-[#f0c020] ${
                    importingDrafts ? "animate-pulse" : ""
                  }`}
                />
                <span>
                  {importingDrafts ? "Importing Drafts..." : "Import Drafts"}
                </span>
              </button>
              <button
                type="button"
                disabled={sheetLoading}
                onClick={onRefreshSheet}
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

          {sheetData && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {sheetData.missingDraftGames.length === 0 &&
              sheetData.incompleteDataGames.length === 0 &&
              sheetData.draftIntegrityIssues.length === 0 &&
              sheetData.unrosteredPlayers.length === 0 &&
              missingDataPlayers.length === 0 ? (
                <span className="px-2.5 py-1 rounded bg-[#143320]/90 border border-[#3a804d] text-[#7cd438] font-bold">
                  &#10003; All Datasets Aligned ({sheetData.matchCount} games &middot;
                  100% draft coverage &middot; no duplicates)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-[#2a2210]/90 border border-[#c89b3c]/50 text-[#f0c020] font-bold">
                  Dataset Audit:{" "}
                  {[
                    sheetData.missingDraftGames.length > 0 &&
                      `${sheetData.missingDraftGames.length} missing drafts`,
                    sheetData.draftIntegrityIssues.length > 0 &&
                      `${sheetData.draftIntegrityIssues.length} draft mismatches/duplicates`,
                    sheetData.incompleteDataGames.length > 0 &&
                      `${sheetData.incompleteDataGames.length} incomplete rows`,
                    sheetData.unrosteredPlayers.length > 0 &&
                      `${sheetData.unrosteredPlayers.length} unrostered`,
                    missingDataPlayers.length > 0 &&
                      `${missingDataPlayers.length} 0-game players`,
                  ]
                    .filter(Boolean)
                    .join(" \u2022 ")}
                </span>
              )}
            </div>
          )}

          {draftImportResult && (
            <div className="p-2.5 bg-black/40 border border-[#c89b3c]/50 rounded text-[11px] text-[#e8e5d8] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#f0c020]">
                  Draft Import Summary: {draftImportResult.imported.length}{" "}
                  imported, {draftImportResult.alreadyCompleteCount}/
                  {draftImportResult.totalSheetGames} already complete
                </span>
                <button
                  type="button"
                  onClick={() => setDraftImportResult(null)}
                  className="text-[#a6a89e] hover:text-white"
                >
                  Dismiss
                </button>
              </div>
              {draftImportResult.warnings.length > 0 && (
                <div className="text-[#ff857a] space-y-0.5">
                  <div className="font-bold">
                    Warnings / Validation Skips ({draftImportResult.warnings.length}):
                  </div>
                  {draftImportResult.warnings.map((w) => (
                    <div key={w.gameId}>
                      {"\u2022"} {w.matchLabel} ({w.gameId}): {w.reason}
                    </div>
                  ))}
                </div>
              )}
              {draftImportResult.manualReview.length > 0 && (
                <div className="text-[#f0c020] space-y-0.5">
                  <div className="font-bold">
                    Manual Entry Needed (drafter.lol / blocked:{" "}
                    {draftImportResult.manualReview.length}):
                  </div>
                  {draftImportResult.manualReview.map((m) => {
                    const safeUrl = sanitizeExternalUrl(m.url);
                    return (
                      <div key={m.gameId} className="truncate">
                        {"\u2022"} {m.matchLabel} ({m.gameId}):{" "}
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {m.url}
                          </a>
                        ) : (
                          <span>{m.url}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {draftImportResult.unmatched.length > 0 && (
                <div className="text-[#a6a89e]">
                  Unmatched on schedule tab ({draftImportResult.unmatched.length}):{" "}
                  {draftImportResult.unmatched
                    .map((u) => `${u.matchLabel} (${u.gameId})`)
                    .join(", ")}
                </div>
              )}
            </div>
          )}

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

          {sheetData && sheetData.draftIntegrityIssues.length > 0 && (
            <div className="px-3 py-2 bg-[#451717]/90 border border-[#9e3535] rounded text-[11px] text-[#ff857a] space-y-1">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>{sheetData.draftIntegrityIssues.length}</strong> draft
                  dataset integrity{" "}
                  {sheetData.draftIntegrityIssues.length === 1
                    ? "issue"
                    : "issues"}{" "}
                  detected:
                </span>
              </div>
              {sheetData.draftIntegrityIssues.map((d) => (
                <div key={`${d.gameId}-${d.issue}`} className="pl-5">
                  {"\u2022"} <strong>{d.matchLabel}</strong> ({d.gameId}): {d.issue}
                </div>
              ))}
            </div>
          )}

          {sheetData && sheetData.incompleteDataGames.length > 0 && (() => {
            const incomplete = sheetData.incompleteDataGames;
            const preview = incomplete
              .slice(0, 6)
              .map((g) => g.matchLabel)
              .join(", ");
            const remainder = incomplete.length - 6;
            return (
              <div className="px-3 py-2 bg-[#2a2210]/80 border border-[#c89b3c]/50 rounded text-[11px] text-[#f0c020] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <strong>{incomplete.length}</strong>{" "}
                      {incomplete.length === 1 ? "game has" : "games have"}{" "}
                      incomplete data fields: {preview}
                      {remainder > 0 ? ` +${remainder} more` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIncompleteDetails((v) => !v)}
                    className="xp-btn px-2 py-0.5 text-[10px] shrink-0"
                  >
                    {showIncompleteDetails ? "Hide Details" : "Review Fields"}
                  </button>
                </div>
                {showIncompleteDetails && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border-t border-white/10 pt-1.5 text-[10px] text-[#e8e5d8]">
                    {incomplete.map((g) => (
                      <div key={g.gameId} className="flex flex-wrap gap-x-2">
                        <span className="font-bold text-[#f0c020]">
                          {g.matchLabel}
                        </span>
                        <span className="text-[#a6a89e]">({g.gameId}):</span>
                        <span>{g.issues.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <MatchDraftForm
            seasonId={seasonId}
            ddVersion={ddVersion}
            onSaved={onRefreshSheet}
            onError={(msg) => setSheetError(msg)}
          />

          <div className="p-2.5 bg-black/30 border border-white/10 rounded space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase text-[#f0c020] flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Stats Dashboard Broadcast Notice</span>
              </div>
              {statsNotice && (
                <span className="text-[10px] text-[#7cd438] font-bold">
                  {"\u25cf"} Live on /stats
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={noticeDraft}
                onChange={(e) => setNoticeDraft(e.target.value)}
                maxLength={280}
                placeholder="e.g., Playoff Week 1 stats are still being collected — recent matches may be incomplete."
                className="flex-1 xp-inset px-2.5 py-1.5 text-xs"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={savingNotice}
                  onClick={() => onSaveNotice(noticeDraft)}
                  className="xp-btn xp-btn-primary text-xs"
                >
                  {savingNotice ? "Saving..." : "Publish Notice"}
                </button>
                {statsNotice && (
                  <button
                    type="button"
                    disabled={savingNotice}
                    onClick={() => onSaveNotice(null)}
                    className="xp-btn xp-btn-danger text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {noticeError && (
              <div className="text-[11px] text-[#ff857a] font-bold">
                {noticeError}
              </div>
            )}
          </div>
        </div>
      </RetroWindow>

      {missingTable && (
        <RetroWindow title="Setup Required \u2014 Create Stats Cache Table" theme="xp">
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
    </>
  );
}

"use client";

import React from "react";
import { Check, Plus, Save, Trash2, Upload } from "lucide-react";
import type {
  League,
  Season,
  SeasonRosterType,
  SeasonStructure,
} from "@/types/database";

interface AdminSeasonsTabProps {
  busy: boolean;
  isSiteAdmin: boolean;
  leagues: League[];
  setLeagues: React.Dispatch<React.SetStateAction<League[]>>;
  seasons: Season[];
  setSeasons: React.Dispatch<React.SetStateAction<Season[]>>;
  newLeagueName: string;
  setNewLeagueName: (v: string) => void;
  newLeagueShortName: string;
  setNewLeagueShortName: (v: string) => void;
  newSeasonLeagueId: string;
  setNewSeasonLeagueId: (v: string) => void;
  newSeasonName: string;
  setNewSeasonName: (v: string) => void;
  onAddLeague: (e: React.FormEvent) => void;
  onSaveLeague: (league: League) => void;
  onDeleteLeague: (league: League) => void;
  onLeagueLogoUpload: (leagueId: string, file: File) => void;
  onAddSeason: (e: React.FormEvent) => void;
  onSaveSeason: (season: Season) => void;
  onToggleSeasonActive: (season: Season) => void;
  onDeleteSeason: (season: Season) => void;
}

export function AdminSeasonsTab({
  busy,
  isSiteAdmin,
  leagues,
  setLeagues,
  seasons,
  setSeasons,
  newLeagueName,
  setNewLeagueName,
  newLeagueShortName,
  setNewLeagueShortName,
  newSeasonLeagueId,
  setNewSeasonLeagueId,
  newSeasonName,
  setNewSeasonName,
  onAddLeague,
  onSaveLeague,
  onDeleteLeague,
  onLeagueLogoUpload,
  onAddSeason,
  onSaveSeason,
  onToggleSeasonActive,
  onDeleteSeason,
}: AdminSeasonsTabProps) {
  const activeLeagueId = newSeasonLeagueId || leagues[0]?.id || "";
  const leagueSeasons = seasons.filter((s) => s.league_id === activeLeagueId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Leagues */}
      <div className="xp-panel p-3 space-y-3">
        <h2 className="font-bold text-xs uppercase text-[#f0c020]">Leagues</h2>
        <div className="space-y-2">
          {leagues.map((l) => (
            <div key={l.id} className="xp-inset p-2 space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-8 h-8 shrink-0 bg-black/30 border border-white/10 p-0.5 flex items-center justify-center">
                  {l.logo_url ? (
                    <img
                      src={l.logo_url}
                      alt={l.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[9px] text-[#7e8781]">LOGO</span>
                  )}
                </div>
                <input
                  type="text"
                  value={l.name}
                  onChange={(e) =>
                    setLeagues((prev) =>
                      prev.map((item) =>
                        item.id === l.id
                          ? { ...item, name: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="League Name"
                  className="flex-1 min-w-[120px] bg-transparent border border-white/10 px-2 py-1 text-xs font-bold focus:outline-none focus:border-[#c89b3c]"
                />
                <input
                  type="text"
                  value={l.short_name ?? ""}
                  onChange={(e) =>
                    setLeagues((prev) =>
                      prev.map((item) =>
                        item.id === l.id
                          ? { ...item, short_name: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Abbr."
                  className="w-16 shrink-0 bg-transparent border border-white/10 px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-[#c89b3c]"
                  title="Short abbreviation (e.g. SCDL)"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSaveLeague(l)}
                    className="xp-btn text-[11px] px-2 py-1"
                    title="Save League"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteLeague(l)}
                    className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                    title="Delete League"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.logo_url ?? ""}
                  onChange={(e) =>
                    setLeagues((prev) =>
                      prev.map((item) =>
                        item.id === l.id
                          ? { ...item, logo_url: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Logo URL"
                  className="flex-1 min-w-0 bg-transparent border border-white/10 px-2 py-1 text-[11px] text-[#c7c5b8] focus:outline-none focus:border-[#c89b3c]"
                />
                <label className="xp-btn text-[11px] px-2 py-1 cursor-pointer shrink-0">
                  <Upload className="w-3 h-3" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onLeagueLogoUpload(l.id, f);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        {isSiteAdmin && (
          <form onSubmit={onAddLeague} className="flex flex-wrap gap-2 pt-2">
            <input
              type="text"
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder="e.g. LCS Amateur"
              className="flex-1 min-w-[140px] xp-inset px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={newLeagueShortName}
              onChange={(e) => setNewLeagueShortName(e.target.value)}
              placeholder="Abbr. (e.g. LCSA)"
              className="w-28 xp-inset px-2 py-1 text-xs uppercase"
            />
            <button type="submit" disabled={busy} className="xp-btn text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Add League</span>
            </button>
          </form>
        )}
      </div>

      {/* Seasons */}
      <div className="xp-panel p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-xs uppercase text-[#f0c020]">
            Seasons
          </h2>
          <select
            value={activeLeagueId}
            onChange={(e) => setNewSeasonLeagueId(e.target.value)}
            className="xp-inset px-2 py-1 text-xs font-bold"
            aria-label="Filter seasons by league"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {leagueSeasons.length === 0 ? (
            <div className="xp-inset p-3 text-xs text-[#a6a89e]">
              No seasons in this league yet.
            </div>
          ) : (
            leagueSeasons.map((s) => {
              const league = leagues.find((l) => l.id === s.league_id);
              const provider = s.stats_provider ?? "google_sheet";
              const isGoogleSheet = provider === "google_sheet";
              const hasSheetId = Boolean(s.stats_sheet_id?.trim());
              const hasSheetGids = (s.stats_sheet_gids ?? []).length > 0;
              const hasPlayoffGids = (s.stats_playoff_gids ?? []).length > 0;
              const hasScheduleGid = Boolean(s.stats_schedule_gid?.trim());
              const hasRegRounds =
                s.regular_season_rounds != null && s.regular_season_rounds > 0;
              const hasRoundLabel = Boolean(s.stats_round_label?.trim());
              const hasCreditsLabel = Boolean(s.stats_credits_label?.trim());
              const hasCreditsUrl = Boolean(s.stats_credits_url?.trim());
              const hasCreditsAttr = Boolean(
                s.stats_credits_attribution?.trim()
              );

              return (
                <div key={s.id} className="xp-inset p-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase text-[#a6a89e]">
                      {league?.name ?? "League"}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-xs border ${
                        s.is_active
                          ? "bg-[#173b24] text-[#7cd438] border-[#3a804d]"
                          : "bg-[#451717] text-[#ff857a] border-[#9e3535]"
                      }`}
                    >
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) =>
                        setSeasons((prev) =>
                          prev.map((item) =>
                            item.id === s.id
                              ? { ...item, name: e.target.value }
                              : item
                          )
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent border border-white/10 px-2 py-1 text-xs font-bold focus:outline-none focus:border-[#c89b3c]"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSaveSeason(s)}
                      className="xp-btn text-[11px] px-2 py-1"
                      title="Save Season Name"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onToggleSeasonActive(s)}
                      className={`xp-btn text-[11px] py-1 ${
                        s.is_active ? "xp-btn-danger" : "xp-btn-primary"
                      }`}
                    >
                      {s.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDeleteSeason(s)}
                      className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                      title="Delete Season"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <details className="pt-1 border-t border-white/10 text-[11px]">
                    <summary className="cursor-pointer text-[#a6a89e] hover:text-[#f0c020] font-semibold select-none">
                      Data Sources &amp; Credits
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Roster Type
                        </label>
                        <select
                          value={s.roster_type ?? "draft"}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      roster_type: e.target
                                        .value as SeasonRosterType,
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full xp-inset px-2 py-1 text-xs"
                        >
                          <option value="draft">Draft League</option>
                          <option value="premade">Premade Teams</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Season Structure
                        </label>
                        <select
                          value={s.season_structure ?? "regular_playoffs"}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      season_structure: e.target
                                        .value as SeasonStructure,
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full xp-inset px-2 py-1 text-xs"
                        >
                          <option value="regular_playoffs">
                            Regular Season + Playoffs
                          </option>
                          <option value="regular_only">
                            Regular Season Only
                          </option>
                          <option value="bracket_only">
                            Bracket / Playoffs Only
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Default Series
                        </label>
                        <select
                          value={s.default_best_of ?? 1}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      default_best_of: Number(e.target.value),
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full xp-inset px-2 py-1 text-xs"
                        >
                          <option value={1}>Best of 1</option>
                          <option value={3}>Best of 3</option>
                          <option value={5}>Best of 5</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Stats Provider
                        </label>
                        <select
                          value={provider}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      stats_provider: e.target
                                        .value as Season["stats_provider"],
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full xp-inset px-2 py-1 text-xs"
                        >
                          <option value="google_sheet">Google Sheet CSV</option>
                          <option value="supabase_native">
                            Supabase Native (league_game_participants)
                          </option>
                          <option value="none">None (Solo/Duo only)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Google Sheet ID
                          {isGoogleSheet && hasSheetId && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          disabled={!isGoogleSheet}
                          value={s.stats_sheet_id ?? ""}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? { ...item, stats_sheet_id: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="1tdi8ftaQ50sYS92H39YybU29..."
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            !isGoogleSheet
                              ? "opacity-45 cursor-not-allowed"
                              : hasSheetId
                              ? "!border-[#7cd438]/60"
                              : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Sheet Tab GIDs (comma-separated)
                          {isGoogleSheet && hasSheetGids && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          disabled={!isGoogleSheet}
                          value={(s.stats_sheet_gids ?? []).join(", ")}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      stats_sheet_gids: e.target.value
                                        .split(",")
                                        .map((g) => g.trim())
                                        .filter(Boolean),
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="1733612942, 1849724071"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            !isGoogleSheet
                              ? "opacity-45 cursor-not-allowed"
                              : hasSheetGids
                              ? "!border-[#7cd438]/60"
                              : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Playoff Tab GIDs (Optional, comma-separated)
                          {isGoogleSheet && hasPlayoffGids && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          disabled={!isGoogleSheet}
                          value={(s.stats_playoff_gids ?? []).join(", ")}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      stats_playoff_gids: e.target.value
                                        .split(",")
                                        .map((g) => g.trim())
                                        .filter(Boolean),
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g., 987654321"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            !isGoogleSheet
                              ? "opacity-45 cursor-not-allowed"
                              : hasPlayoffGids
                              ? "!border-[#7cd438]/60"
                              : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Schedule / Draft Links Tab GID (Optional)
                          {isGoogleSheet && hasScheduleGid && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          disabled={!isGoogleSheet}
                          value={s.stats_schedule_gid ?? ""}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      stats_schedule_gid: e.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g., 728267243"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            !isGoogleSheet
                              ? "opacity-45 cursor-not-allowed"
                              : hasScheduleGid
                              ? "!border-[#7cd438]/60"
                              : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Regular Season Rounds (Optional cutoff)
                          {provider !== "none" && hasRegRounds && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="number"
                          min={1}
                          disabled={provider === "none"}
                          value={s.regular_season_rounds ?? ""}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            const num = val ? Number(val) : null;
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      regular_season_rounds:
                                        num && Number.isFinite(num)
                                          ? num
                                          : null,
                                    }
                                  : item
                              )
                            );
                          }}
                          placeholder="e.g., 7 (Round 8+ = Playoffs)"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            provider === "none"
                              ? "opacity-45 cursor-not-allowed"
                              : hasRegRounds
                              ? "!border-[#7cd438]/60"
                              : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Series / Round Term (Optional)
                          {hasRoundLabel && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          value={s.stats_round_label ?? ""}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? { ...item, stats_round_label: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g., Round, Week, Match (default: Round)"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            hasRoundLabel ? "!border-[#7cd438]/60" : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Credits Link Label
                          {hasCreditsLabel && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          value={s.stats_credits_label ?? ""}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      stats_credits_label: e.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="e.g. SCDL 4.5 Master Google Sheet"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            hasCreditsLabel ? "!border-[#7cd438]/60" : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Credits URL (optional override)
                          {hasCreditsUrl && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          value={s.stats_credits_url ?? ""}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? { ...item, stats_credits_url: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            hasCreditsUrl ? "!border-[#7cd438]/60" : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#c7c5b8]">
                          Credits Attribution
                          {hasCreditsAttr && (
                            <Check className="w-3 h-3 text-[#7cd438] inline ml-1" />
                          )}
                        </label>
                        <input
                          type="text"
                          value={s.stats_credits_attribution ?? ""}
                          onChange={(e) =>
                            setSeasons((prev) =>
                              prev.map((item) =>
                                item.id === s.id
                                  ? {
                                      ...item,
                                      stats_credits_attribution: e.target.value,
                                    }
                                  : item
                              )
                            )
                          }
                          placeholder="the SCDL Admin Team (special thanks to Pandora)"
                          className={`w-full xp-inset px-2 py-1 text-xs ${
                            hasCreditsAttr ? "!border-[#7cd438]/60" : ""
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSaveSeason(s)}
                          className="xp-btn xp-btn-primary text-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Config</span>
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              );
            })
          )}
        </div>
        <form onSubmit={onAddSeason} className="flex gap-2 pt-2">
          <input
            type="text"
            value={newSeasonName}
            onChange={(e) => setNewSeasonName(e.target.value)}
            placeholder="e.g. Season 5"
            className="flex-1 xp-inset px-2 py-1 text-xs"
          />
          <button type="submit" disabled={busy} className="xp-btn text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Season</span>
          </button>
        </form>
      </div>
    </div>
  );
}

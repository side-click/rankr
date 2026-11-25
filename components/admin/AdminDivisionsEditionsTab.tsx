"use client";

import React from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
  Users,
} from "lucide-react";
import type { Division, DivisionTheme, Edition } from "@/types/database";

interface AdminDivisionsEditionsTabProps {
  mode: "divisions" | "editions";
  busy: boolean;
  seasonDivisions: Division[];
  setDivisions: React.Dispatch<React.SetStateAction<Division[]>>;
  filteredEditions: Edition[];
  setEditions: React.Dispatch<React.SetStateAction<Edition[]>>;
  themes: DivisionTheme[];
  setThemes: React.Dispatch<React.SetStateAction<DivisionTheme[]>>;
  newDivName: string;
  setNewDivName: (v: string) => void;
  newDivTheme: string;
  setNewDivTheme: (v: string) => void;
  newEditionName: string;
  setNewEditionName: (v: string) => void;
  newEditionPlayersOnly: boolean;
  setNewEditionPlayersOnly: (v: boolean) => void;
  newThemeName: string;
  setNewThemeName: (v: string) => void;
  newThemePrimary: string;
  setNewThemePrimary: (v: string) => void;
  newThemeSecondary: string;
  setNewThemeSecondary: (v: string) => void;
  newThemeText: string;
  setNewThemeText: (v: string) => void;
  onAddDivision: (e: React.FormEvent) => void;
  onSaveDivision: (division: Division) => void;
  onDeleteDivision: (division: Division) => void;
  onDivisionLogoUpload: (divisionId: string, file: File) => void;
  onAddEdition: (e: React.FormEvent) => void;
  onSaveEdition: (ed: Edition) => void;
  onDeleteEdition: (ed: Edition) => void;
  onMoveEdition: (index: number, direction: -1 | 1) => void;
  onToggleEditionPlayersOnly: (ed: Edition) => void;
  onToggleEditionOpen: (ed: Edition) => void;
  onToggleEditionArchived: (ed: Edition) => void;
  onSaveTheme: (theme: DivisionTheme) => void;
  onDeleteTheme: (theme: DivisionTheme) => void;
  onThemeLogoUpload: (themeKey: string, file: File) => void;
  onAddTheme: (e: React.FormEvent) => void;
}

export function AdminDivisionsEditionsTab({
  mode,
  busy,
  seasonDivisions,
  setDivisions,
  filteredEditions,
  setEditions,
  themes,
  setThemes,
  newDivName,
  setNewDivName,
  newDivTheme,
  setNewDivTheme,
  newEditionName,
  setNewEditionName,
  newEditionPlayersOnly,
  setNewEditionPlayersOnly,
  newThemeName,
  setNewThemeName,
  newThemePrimary,
  setNewThemePrimary,
  newThemeSecondary,
  setNewThemeSecondary,
  newThemeText,
  setNewThemeText,
  onAddDivision,
  onSaveDivision,
  onDeleteDivision,
  onDivisionLogoUpload,
  onAddEdition,
  onSaveEdition,
  onDeleteEdition,
  onMoveEdition,
  onToggleEditionPlayersOnly,
  onToggleEditionOpen,
  onToggleEditionArchived,
  onSaveTheme,
  onDeleteTheme,
  onThemeLogoUpload,
  onAddTheme,
}: AdminDivisionsEditionsTabProps) {
  return (
    <div className="space-y-4">
      {mode === "divisions" && (
        <>
          <div className="xp-panel p-3 space-y-3">
            <h2 className="font-bold text-xs uppercase text-[#f0c020]">
              Divisions
            </h2>
            {seasonDivisions.length === 0 && (
              <div className="px-3 py-2 rounded bg-[#2a2210]/90 border border-[#c89b3c]/50 text-xs text-[#f0c020] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  At least one division is required before you can add teams,
                  schedules, or rankings for this season. For a single-division
                  league, create one division (e.g. named after your league).
                </span>
              </div>
            )}
            <div className="space-y-2">
              {seasonDivisions.length === 0 ? (
                <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                  No divisions in this season yet.
                </div>
              ) : (
              seasonDivisions.map((d) => (
                <div key={d.id} className="xp-inset p-2 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 shrink-0 bg-black/30 border border-white/10 p-0.5 flex items-center justify-center">
                      {d.logo_url ? (
                        <img
                          src={d.logo_url}
                          alt={d.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[9px] text-[#7e8781]">LOGO</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) =>
                        setDivisions((prev) =>
                          prev.map((item) =>
                            item.id === d.id
                              ? { ...item, name: e.target.value }
                              : item
                          )
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent border border-white/10 px-2 py-1 text-xs font-bold focus:outline-none focus:border-[#c89b3c]"
                    />
                    <select
                      value={d.theme_key}
                      onChange={(e) =>
                        setDivisions((prev) =>
                          prev.map((item) =>
                            item.id === d.id
                              ? { ...item, theme_key: e.target.value }
                              : item
                          )
                        )
                      }
                      className="bg-[#1a201e] border border-white/10 px-1.5 py-1 text-[11px] shrink-0"
                    >
                      {themes.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={d.logo_url ?? ""}
                      onChange={(e) =>
                        setDivisions((prev) =>
                          prev.map((item) =>
                            item.id === d.id
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
                          if (f) onDivisionLogoUpload(d.id, f);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSaveDivision(d)}
                      className="xp-btn xp-btn-primary text-[11px] px-2 py-1 shrink-0"
                      title="Save Division"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDeleteDivision(d)}
                      className="xp-btn xp-btn-danger text-[11px] px-2 py-1 shrink-0"
                      title="Delete Division"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={onAddDivision} className="flex flex-wrap gap-2 pt-2">
            <input
              type="text"
              value={newDivName}
              onChange={(e) => setNewDivName(e.target.value)}
              placeholder="e.g. Baron Division"
              className="flex-1 xp-inset px-2 py-1 text-xs"
            />
            <select
              value={newDivTheme}
              onChange={(e) => setNewDivTheme(e.target.value)}
              className="xp-inset px-2 py-1 text-xs"
            >
              {themes.length === 0 ? (
                <option value="">Default Theme</option>
              ) : (
                themes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
            <button type="submit" disabled={busy} className="xp-btn text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Division</span>
            </button>
          </form>
        </div>
        </>
      )}

      {mode === "editions" && (
        <div className="xp-panel p-3 space-y-3">
          <div>
            <h2 className="font-bold text-xs uppercase text-[#f0c020]">
              Editions
            </h2>
            <p className="text-[11px] text-[#a6a89e] mt-0.5">
              <strong className="text-[#f0c020]">IMPORTANT:</strong> Order
              editions chronologically from earliest (top) to latest (bottom) for
              accurate change tracking.
            </p>
          </div>
          <div className="space-y-2">
            {filteredEditions.length === 0 ? (
              <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                No editions in this season yet.
              </div>
            ) : (
              filteredEditions.map((ed, idx) => (
                <div
                  key={ed.id}
                  className="xp-inset p-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1 text-xs"
                >
                  <div className="flex flex-col gap-0.5 shrink-0 order-1 sm:order-1">
                    <button
                      type="button"
                      disabled={busy || idx === 0}
                      onClick={() => onMoveEdition(idx, -1)}
                      className="xp-btn !px-1 !py-0.5 text-[10px] leading-none"
                      title="Move Up"
                    >
                      <ArrowUp className="w-2.5 h-2.5 shrink-0" />
                    </button>
                    <button
                      type="button"
                      disabled={busy || idx === filteredEditions.length - 1}
                      onClick={() => onMoveEdition(idx, 1)}
                      className="xp-btn !px-1 !py-0.5 text-[10px] leading-none"
                      title="Move Down"
                    >
                      <ArrowDown className="w-2.5 h-2.5 shrink-0" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={ed.name}
                    onChange={(e) =>
                      setEditions((prev) =>
                        prev.map((item) =>
                          item.id === ed.id
                            ? { ...item, name: e.target.value }
                            : item
                        )
                      )
                    }
                    className="flex-1 min-w-0 bg-transparent border border-white/10 px-2 py-1 text-xs font-bold focus:outline-none focus:border-[#c89b3c] order-2 sm:order-2"
                  />

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleEditionPlayersOnly(ed)}
                    className={`xp-btn !px-1.5 !py-1 justify-center shrink-0 order-5 sm:order-3 ml-auto sm:ml-0 ${
                      ed.is_players_only
                        ? "!border-[#c89b3c] !bg-[#2a2210] text-[#f0c020]"
                        : "text-[#a6a89e]"
                    }`}
                    title={
                      ed.is_players_only
                        ? "Players-Only Edition (Draft Day / Team Rankings Disabled). Click to allow Teams & Players."
                        : "All Rankings Edition (Teams & Players). Click to mark Players-Only."
                    }
                  >
                    {ed.is_players_only ? (
                      <User className="w-3.5 h-3.5 shrink-0 text-[#f0c020]" />
                    ) : (
                      <Users className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSaveEdition(ed)}
                    className="xp-btn !px-1.5 !py-1 shrink-0 order-6 sm:order-4"
                    title="Save Edition Name"
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <span
                    className={`w-16 text-center shrink-0 px-1 py-0.5 text-[9px] font-bold uppercase rounded-xs border order-3 sm:order-5 ${
                      ed.is_archived
                        ? "bg-[#2b322f] text-[#a6a89e] border-[#4a5450]"
                        : ed.is_open
                        ? "bg-[#173b24] text-[#7cd438] border-[#3a804d]"
                        : "bg-[#451717] text-[#ff857a] border-[#9e3535]"
                    }`}
                  >
                    {ed.is_archived
                      ? "Archived"
                      : ed.is_open
                      ? "Open"
                      : "Locked"}
                  </span>

                  <div className="basis-full h-0 sm:hidden order-4" />

                  <button
                    type="button"
                    disabled={busy || Boolean(ed.is_archived)}
                    onClick={() => onToggleEditionOpen(ed)}
                    className={`xp-btn text-[11px] !px-2 !py-1 w-14 justify-center shrink-0 order-7 sm:order-6 ${
                      ed.is_open && !ed.is_archived
                        ? "xp-btn-danger"
                        : "xp-btn-primary"
                    } disabled:opacity-40`}
                    title={
                      ed.is_archived
                        ? "Unarchive first to unlock"
                        : ed.is_open
                        ? "Lock publishing (drafts still allowed)"
                        : "Unlock publishing"
                    }
                  >
                    {ed.is_open && !ed.is_archived ? "Lock" : "Unlock"}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleEditionArchived(ed)}
                    className={`xp-btn text-[11px] !px-2 !py-1 w-[92px] justify-center shrink-0 order-8 sm:order-7 ${
                      ed.is_archived ? "xp-btn-primary" : ""
                    }`}
                    title={
                      ed.is_archived
                        ? "Unarchive edition"
                        : "Archive past edition (disables drafts & edits)"
                    }
                  >
                    <Archive className="w-3 h-3 shrink-0" />
                    <span>{ed.is_archived ? "Unarchive" : "Archive"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteEdition(ed)}
                    className="xp-btn xp-btn-danger !px-1.5 !py-1 shrink-0 order-9 sm:order-8"
                    title="Delete Edition"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={onAddEdition}
            className="flex flex-wrap items-center gap-2 pt-2"
          >
            <input
              type="text"
              value={newEditionName}
              onChange={(e) => setNewEditionName(e.target.value)}
              placeholder="e.g. Draft Day or Week 1"
              className="flex-1 min-w-[140px] xp-inset px-2 py-1 text-xs"
            />
            <label
              className="flex items-center gap-1.5 text-[11px] text-[#c7c5b8] cursor-pointer px-1.5 py-1 xp-inset select-none"
              title="Restrict this edition to Player Tier Lists only (e.g. pre-draft before teams exist)"
            >
              <input
                type="checkbox"
                checked={newEditionPlayersOnly}
                onChange={(e) => setNewEditionPlayersOnly(e.target.checked)}
              />
              <User className="w-3 h-3 text-[#f0c020]" />
              <span>Players-Only</span>
            </label>
            <button type="submit" disabled={busy} className="xp-btn text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Edition</span>
            </button>
          </form>
        </div>
      )}

      {/* Division Themes (shown under Divisions tab) */}
      {mode === "divisions" && (
      <div className="xp-panel p-3 space-y-3">
        <h2 className="font-bold text-xs uppercase text-[#f0c020]">
          Division Themes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {themes.map((th) => (
            <div
              key={th.key}
              style={{
                borderLeftWidth: "4px",
                borderLeftColor: th.primary_color,
              }}
              className="xp-inset p-2.5 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2">
                {th.default_logo_url ? (
                  <img
                    src={th.default_logo_url}
                    alt={th.name}
                    className="w-8 h-8 object-contain shrink-0"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: th.primary_color }}
                    className="w-8 h-8 rounded-xs shrink-0 border border-white/20"
                  />
                )}
                <input
                  type="text"
                  value={th.name}
                  onChange={(e) =>
                    setThemes((prev) =>
                      prev.map((item) =>
                        item.key === th.key
                          ? { ...item, name: e.target.value }
                          : item
                      )
                    )
                  }
                  style={{ color: th.accent_text_color }}
                  className="flex-1 bg-transparent border border-white/10 px-2 py-1 font-bold focus:outline-none focus:border-[#c89b3c]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSaveTheme(th)}
                  className="xp-btn xp-btn-primary text-[11px] px-2 py-1"
                  title="Save Theme"
                >
                  <Save className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeleteTheme(th)}
                  className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                  title="Delete Theme"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-[#c7c5b8]">
                  <span>Primary</span>
                  <input
                    type="color"
                    value={th.primary_color}
                    onChange={(e) =>
                      setThemes((prev) =>
                        prev.map((item) =>
                          item.key === th.key
                            ? { ...item, primary_color: e.target.value }
                            : item
                        )
                      )
                    }
                    className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-[#c7c5b8]">
                  <span>Secondary</span>
                  <input
                    type="color"
                    value={th.secondary_color}
                    onChange={(e) =>
                      setThemes((prev) =>
                        prev.map((item) =>
                          item.key === th.key
                            ? { ...item, secondary_color: e.target.value }
                            : item
                        )
                      )
                    }
                    className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-[#c7c5b8]">
                  <span>Text</span>
                  <input
                    type="color"
                    value={th.accent_text_color}
                    onChange={(e) =>
                      setThemes((prev) =>
                        prev.map((item) =>
                          item.key === th.key
                            ? { ...item, accent_text_color: e.target.value }
                            : item
                        )
                      )
                    }
                    className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={th.default_logo_url ?? ""}
                  onChange={(e) =>
                    setThemes((prev) =>
                      prev.map((item) =>
                        item.key === th.key
                          ? { ...item, default_logo_url: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="Default Logo URL"
                  className="flex-1 bg-transparent border border-white/10 px-2 py-1 text-[11px] text-[#c7c5b8] focus:outline-none focus:border-[#c89b3c]"
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
                      if (f) onThemeLogoUpload(th.key, f);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={onAddTheme}
          className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 pt-2 border-t border-white/10"
        >
          <input
            type="text"
            value={newThemeName}
            onChange={(e) => setNewThemeName(e.target.value)}
            placeholder="New Theme Name (e.g. Herald Theme)"
            className="w-full sm:w-auto sm:flex-1 min-w-[180px] xp-inset px-2 py-1 text-xs"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-1 text-[11px] text-[#c7c5b8]">
              <span>Primary</span>
              <input
                type="color"
                value={newThemePrimary}
                onChange={(e) => setNewThemePrimary(e.target.value)}
                className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-[#c7c5b8]">
              <span>Secondary</span>
              <input
                type="color"
                value={newThemeSecondary}
                onChange={(e) => setNewThemeSecondary(e.target.value)}
                className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-[#c7c5b8]">
              <span>Text</span>
              <input
                type="color"
                value={newThemeText}
                onChange={(e) => setNewThemeText(e.target.value)}
                className="w-6 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
              />
            </label>
            <button type="submit" disabled={busy} className="xp-btn text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Theme</span>
            </button>
          </div>
        </form>
      </div>
      )}
    </div>
  );
}

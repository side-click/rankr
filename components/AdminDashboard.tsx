"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type {
  AllowedDiscordUser,
  AppSettings,
  Division,
  DivisionTheme,
  Edition,
  League,
  Profile,
  RankingType,
  Season,
  SeasonPlayer,
  Team,
} from "@/types/database";
import { RetroWindow } from "@/components/RetroWindow";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import {
  CAPTAIN_ICON,
  LEAGUE_ROLES,
  normalizeRoster,
  type LeagueRole,
} from "@/utils/roles";
import { DEFAULT_DIVISION_THEMES } from "@/utils/themes";
import {
  Archive,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Ban,
  Check,
  ExternalLink,
  Lock,
  Plus,
  Power,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";

interface AdminPublishedBallot {
  id: string;
  title: string | null;
  status: string;
  ranking_type?: RankingType;
  tier_variant?: string | null;
  published_at: string | null;
  user_id: string;
  season_id: string | null;
  division_id: string | null;
  edition_id: string | null;
  division_name_snapshot: string | null;
  edition_name_snapshot: string | null;
  profiles?:
    | Pick<Profile, "id" | "username" | "discord_id" | "is_banned">
    | Pick<Profile, "id" | "username" | "discord_id" | "is_banned">[]
    | null;
}

interface ConflictingBallotInfo {
  id: string;
  title: string | null;
  status: "draft" | "published";
  updated_at: string;
  published_at: string | null;
}

interface AdminDashboardProps {
  currentUserId: string;
  initialLeagues: League[];
  initialSeasons: Season[];
  initialDivisions: Division[];
  initialThemes: DivisionTheme[];
  initialEditions: Edition[];
  initialTeams: Team[];
  initialSeasonPlayers: SeasonPlayer[];
  initialAppSettings: AppSettings;
  initialProfiles: Profile[];
  initialPublishedBallots: AdminPublishedBallot[];
  initialAllowedUsers: AllowedDiscordUser[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AdminDashboard({
  currentUserId,
  initialLeagues,
  initialSeasons,
  initialDivisions,
  initialThemes,
  initialEditions,
  initialTeams,
  initialSeasonPlayers,
  initialAppSettings,
  initialProfiles,
  initialPublishedBallots,
  initialAllowedUsers,
}: AdminDashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const validTabs = ["seasons", "editions", "teams", "players", "moderation"] as const;
  type AdminTab = (typeof validTabs)[number];
  const initialTabParam = searchParams.get("tab");
  const [tab, setTab] = useState<AdminTab>(
    validTabs.includes(initialTabParam as AdminTab)
      ? (initialTabParam as AdminTab)
      : "seasons"
  );

  function handleSelectTab(nextTab: AdminTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "seasons") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons);
  const [divisions, setDivisions] = useState<Division[]>(initialDivisions);
  const [themes, setThemes] = useState<DivisionTheme[]>(
    initialThemes.length > 0
      ? initialThemes
      : Object.values(DEFAULT_DIVISION_THEMES)
  );
  const [editions, setEditions] = useState<Edition[]>(initialEditions);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [seasonPlayers, setSeasonPlayers] =
    useState<SeasonPlayer[]>(initialSeasonPlayers);
  const [appSettings, setAppSettings] =
    useState<AppSettings>(initialAppSettings);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [publishedBallots, setPublishedBallots] = useState<
    AdminPublishedBallot[]
  >(initialPublishedBallots);
  const [allowedUsers, setAllowedUsers] =
    useState<AllowedDiscordUser[]>(initialAllowedUsers);
  const [newAllowedDiscordId, setNewAllowedDiscordId] = useState("");
  const [newAllowedLabel, setNewAllowedLabel] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showAllowlist, setShowAllowlist] = useState(false);
  const [allowlistSearch, setAllowlistSearch] = useState("");
  const [movingBallot, setMovingBallot] = useState<AdminPublishedBallot | null>(
    null
  );
  const [targetEditionId, setTargetEditionId] = useState("");
  const [moveTitle, setMoveTitle] = useState("");
  const [conflictBallot, setConflictBallot] =
    useState<ConflictingBallotInfo | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [confirmOverwriteChecked, setConfirmOverwriteChecked] = useState(false);
  const [altModal, setAltModal] = useState<{
    teamId: string;
    teamName: string;
    slotIdx: number;
    playerName: string;
    alts: string[];
  } | null>(null);
  const [altInput, setAltInput] = useState("");

  const allowedIdSet = useMemo(
    () => new Set(allowedUsers.map((u) => u.discord_id)),
    [allowedUsers]
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    initialSeasons.find((s) => s.is_active)?.id ?? initialSeasons[0]?.id ?? ""
  );
  const seasonDivisions = useMemo(
    () => divisions.filter((d) => d.season_id === selectedSeasonId),
    [divisions, selectedSeasonId]
  );
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(
    divisionsForInit(initialDivisions, initialSeasons)
  );

  function divisionsForInit(divs: Division[], seas: Season[]) {
    const firstSeasonId =
      seas.find((s) => s.is_active)?.id ?? seas[0]?.id ?? "";
    return divs.find((d) => d.season_id === firstSeasonId)?.id ?? "";
  }

  // Ensure selectedDivisionId never leaks from another season
  useEffect(() => {
    if (seasonDivisions.length === 0) {
      if (selectedDivisionId !== "") setSelectedDivisionId("");
    } else if (!seasonDivisions.some((d) => d.id === selectedDivisionId)) {
      setSelectedDivisionId(seasonDivisions[0].id);
    }
  }, [selectedSeasonId, seasonDivisions, selectedDivisionId]);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueShortName, setNewLeagueShortName] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonLeagueId, setNewSeasonLeagueId] = useState(
    initialLeagues[0]?.id ?? ""
  );
  const [newDivName, setNewDivName] = useState("");
  const [newDivTheme, setNewDivTheme] = useState<string>("baron");
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemePrimary, setNewThemePrimary] = useState("#6b2d8b");
  const [newThemeSecondary, setNewThemeSecondary] = useState("#00b8c9");
  const [newThemeText, setNewThemeText] = useState("#c77dff");
  const [newEditionName, setNewEditionName] = useState("");
  const [newEditionPlayersOnly, setNewEditionPlayersOnly] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newSinglePlayerName, setNewSinglePlayerName] = useState("");
  const [newSinglePlayerRole, setNewSinglePlayerRole] = useState<LeagueRole>("top");
  const [bulkPasteByRole, setBulkPasteByRole] = useState<Record<LeagueRole, string>>({
    top: "",
    jungle: "",
    mid: "",
    bot: "",
    support: "",
  });

  async function refreshAll() {
    const [l, s, d, th, e, t, sp, cfg, prof, bal, allow] = await Promise.all([
      supabase.from("leagues").select("*").order("created_at", { ascending: true }),
      supabase.from("seasons").select("*").order("created_at", { ascending: false }),
      supabase.from("divisions").select("*").order("name"),
      supabase.from("division_themes").select("*").order("name"),
      supabase.from("editions").select("*").order("sort_order", { ascending: true }),
      supabase.from("teams").select("*").order("default_order", { ascending: true }),
      supabase
        .from("season_players")
        .select("*")
        .order("name", { ascending: true }),
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("rankings")
        .select(
          "id, title, status, ranking_type, published_at, user_id, season_id, division_id, edition_id, division_name_snapshot, edition_name_snapshot, profiles ( id, username, discord_id, is_banned )"
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50),
      supabase
        .from("allowed_discord_users")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (l.data) setLeagues(l.data);
    if (s.data) setSeasons(s.data);
    if (d.data) setDivisions(d.data);
    if (th.data && th.data.length > 0) setThemes(th.data);
    if (e.data) setEditions(e.data);
    if (t.data) setTeams(t.data);
    if (sp.data) setSeasonPlayers(sp.data);
    if (cfg.data) setAppSettings(cfg.data);
    if (prof.data) setProfiles(prof.data);
    if (bal.data) setPublishedBallots(bal.data);
    if (allow.data) setAllowedUsers(allow.data);
    router.refresh();
  }

  async function handleAddLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("leagues").insert({
      name: newLeagueName.trim(),
      short_name: newLeagueShortName.trim() || null,
      slug: slugify(newLeagueName),
      theme_key: "scdl",
    });
    if (!error) {
      setNewLeagueName("");
      setNewLeagueShortName("");
      setStatusMsg("League created.");
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleSaveLeague(league: League) {
    if (!league.name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("leagues")
      .update({
        name: league.name.trim(),
        short_name: league.short_name?.trim() || null,
        logo_url: league.logo_url?.trim() || null,
        slug: slugify(league.name),
      })
      .eq("id", league.id);
    setStatusMsg(error ? `Error: ${error.message}` : `Saved ${league.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleLeagueLogoUpload(leagueId: string, file: File) {
    setBusy(true);
    setStatusMsg(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `league-${leagueId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("team-logos")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setStatusMsg(`Upload failed: ${uploadErr.message}`);
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
    setLeagues((prev) =>
      prev.map((l) => (l.id === leagueId ? { ...l, logo_url: pub.publicUrl } : l))
    );
    setStatusMsg("League logo uploaded. Click Save.");
    setBusy(false);
  }

  async function handleSaveTeam(team: Team) {
    setBusy(true);
    setStatusMsg(null);
    const normalized = normalizeRoster(team.roster, team.captain);
    const captainSlot = normalized.find((s) => s.is_captain);
    const derivedCaptain = captainSlot?.name
      ? captainSlot.name.split("#")[0].trim()
      : team.captain;

    const { error } = await supabase
      .from("teams")
      .update({
        name: team.name,
        captain: derivedCaptain || null,
        logo_url: team.logo_url,
        roster: normalized,
        default_order: team.default_order,
        is_active: team.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", team.id);

    setStatusMsg(error ? `Error: ${error.message}` : `Saved ${team.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleLogoUpload(teamId: string, file: File) {
    setBusy(true);
    setStatusMsg(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${teamId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("team-logos")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setStatusMsg(`Upload failed: ${uploadErr.message}`);
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, logo_url: pub.publicUrl } : t))
    );
    setStatusMsg("Logo uploaded. Click Save Team.");
    setBusy(false);
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDivisionId || !newTeamName.trim()) return;
    setBusy(true);
    const divTeams = teams.filter((t) => t.division_id === selectedDivisionId);
    const { error } = await supabase.from("teams").insert({
      division_id: selectedDivisionId,
      name: newTeamName.trim(),
      captain: null,
      roster: LEAGUE_ROLES.map((r, i) => ({
        role: r.key,
        name: `Player ${i + 1}`,
        is_captain: false,
      })),
      default_order: divTeams.length + 1,
    });
    if (!error) {
      setNewTeamName("");
      setStatusMsg("Team added.");
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleAddSeason(e: React.FormEvent) {
    e.preventDefault();
    const targetLeagueId = newSeasonLeagueId || leagues[0]?.id;
    if (!newSeasonName.trim() || !targetLeagueId) return;
    setBusy(true);
    const { error } = await supabase.from("seasons").insert({
      league_id: targetLeagueId,
      name: newSeasonName.trim(),
      slug: slugify(newSeasonName),
      is_active: false,
    });
    if (!error) {
      setNewSeasonName("");
      setStatusMsg("Season created (inactive by default).");
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleSaveSeason(season: Season) {
    if (!season.name.trim()) return;
    setBusy(true);
    const fullPayload: Record<string, unknown> = {
      name: season.name.trim(),
      slug: slugify(season.name),
      is_active: season.is_active,
      stats_provider: season.stats_provider ?? "google_sheet",
      stats_sheet_id: season.stats_sheet_id?.trim() || null,
      stats_sheet_gids:
        season.stats_sheet_gids && season.stats_sheet_gids.length > 0
          ? season.stats_sheet_gids.map((g) => g.trim()).filter(Boolean)
          : null,
      stats_credits_label: season.stats_credits_label?.trim() || null,
      stats_credits_url: season.stats_credits_url?.trim() || null,
      stats_credits_attribution:
        season.stats_credits_attribution?.trim() || null,
    };
    let { error } = await supabase
      .from("seasons")
      .update(fullPayload)
      .eq("id", season.id);
    if (error && error.message.includes("column")) {
      const fallback = await supabase
        .from("seasons")
        .update({
          name: season.name.trim(),
          slug: slugify(season.name),
          is_active: season.is_active,
        })
        .eq("id", season.id);
      error = fallback.error;
    }
    setStatusMsg(error ? `Error: ${error.message}` : `Saved ${season.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleSeasonActive(season: Season) {
    setBusy(true);
    await supabase
      .from("seasons")
      .update({ is_active: !season.is_active })
      .eq("id", season.id);
    await refreshAll();
    setBusy(false);
  }


  async function handleAddDivision(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSeasonId || !newDivName.trim()) return;
    setBusy(true);
    const matchedTheme = themes.find((t) => t.key === newDivTheme);
    const logoUrl = matchedTheme?.default_logo_url ?? null;
    const { error } = await supabase.from("divisions").insert({
      season_id: selectedSeasonId,
      name: newDivName.trim(),
      slug: slugify(newDivName),
      logo_url: logoUrl,
      theme_key: newDivTheme,
    });
    if (!error) {
      setNewDivName("");
      setStatusMsg("Division created.");
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleSaveDivision(division: Division) {
    if (!division.name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("divisions")
      .update({
        name: division.name.trim(),
        slug: slugify(division.name),
        logo_url: division.logo_url?.trim() || null,
        theme_key: division.theme_key,
      })
      .eq("id", division.id);
    setStatusMsg(
      error ? `Error: ${error.message}` : `Saved ${division.name}.`
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleDivisionLogoUpload(divisionId: string, file: File) {
    setBusy(true);
    setStatusMsg(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `division-${divisionId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("team-logos")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setStatusMsg(`Upload failed: ${uploadErr.message}`);
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
    setDivisions((prev) =>
      prev.map((d) =>
        d.id === divisionId ? { ...d, logo_url: pub.publicUrl } : d
      )
    );
    setStatusMsg("Division logo uploaded. Click Save.");
    setBusy(false);
  }

  async function handleSaveTheme(theme: DivisionTheme) {
    if (!theme.name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("division_themes").upsert({
      key: theme.key,
      name: theme.name.trim(),
      primary_color: theme.primary_color,
      secondary_color: theme.secondary_color,
      accent_text_color: theme.accent_text_color,
      default_logo_url: theme.default_logo_url?.trim() || null,
    });
    setStatusMsg(
      error ? `Error: ${error.message}` : `Saved ${theme.name}.`
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleThemeLogoUpload(themeKey: string, file: File) {
    setBusy(true);
    setStatusMsg(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `theme-${themeKey}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("team-logos")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setStatusMsg(`Upload failed: ${uploadErr.message}`);
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
    setThemes((prev) =>
      prev.map((t) =>
        t.key === themeKey ? { ...t, default_logo_url: pub.publicUrl } : t
      )
    );
    setStatusMsg("Theme logo uploaded. Click Save.");
    setBusy(false);
  }

  async function handleAddTheme(e: React.FormEvent) {
    e.preventDefault();
    if (!newThemeName.trim()) return;
    const key = slugify(newThemeName);
    if (!key) return;
    setBusy(true);
    const { error } = await supabase.from("division_themes").insert({
      key,
      name: newThemeName.trim(),
      primary_color: newThemePrimary,
      secondary_color: newThemeSecondary,
      accent_text_color: newThemeText,
      default_logo_url: null,
    });
    if (!error) {
      setNewThemeName("");
      setStatusMsg("Theme created.");
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleDeleteTheme(theme: DivisionTheme) {
    if (theme.key === "baron" || theme.key === "dragon") return;
    if (!confirm(`Delete theme "${theme.name}"?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("division_themes")
      .delete()
      .eq("key", theme.key);
    setStatusMsg(error ? `Error: ${error.message}` : "Theme deleted.");
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleKillSwitch() {
    const nextMode = !appSettings.maintenance_mode;
    if (
      nextMode &&
      !confirm(
        "Enable the Global Kill Switch? Non-admin users will see the offline maintenance screen and cannot publish."
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      maintenance_mode: nextMode,
      maintenance_message: appSettings.maintenance_message,
      updated_at: new Date().toISOString(),
    });
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : nextMode
        ? "Kill switch ENABLED — App is offline for non-admins."
        : "Kill switch DISABLED — App is back online."
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleSaveMaintenanceMessage() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      maintenance_mode: appSettings.maintenance_mode,
      maintenance_message: appSettings.maintenance_message.trim(),
      updated_at: new Date().toISOString(),
    });
    setStatusMsg(
      error ? `Error: ${error.message}` : "Maintenance message saved."
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleAllowlistMode() {
    const nextRequire = !appSettings.require_allowlist;
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      maintenance_mode: appSettings.maintenance_mode,
      maintenance_message: appSettings.maintenance_message,
      require_allowlist: nextRequire,
      updated_at: new Date().toISOString(),
    });
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : nextRequire
        ? "Discord Allowlist ENABLED — only allowlisted Discord IDs & admins can sign in and rank."
        : "Discord Allowlist DISABLED — anyone can sign in with Discord."
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleAddAllowedUser(discordId: string, label?: string | null) {
    const trimmed = discordId.trim();
    if (!trimmed) return;
    setBusy(true);
    const { error } = await supabase.from("allowed_discord_users").upsert({
      discord_id: trimmed,
      label: label?.trim() || null,
      added_by: currentUserId,
    });
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setNewAllowedDiscordId("");
      setNewAllowedLabel("");
      setStatusMsg(`Allowlisted Discord ID ${trimmed}.`);
      await refreshAll();
    }
    setBusy(false);
  }

  async function handleRemoveAllowedUser(discordId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("allowed_discord_users")
      .delete()
      .eq("discord_id", discordId);
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : `Removed Discord ID ${discordId} from allowlist.`
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleBanUser(target: Profile) {
    if (target.id === currentUserId) return;
    const nextBanned = !target.is_banned;
    let reason: string | null = null;
    if (nextBanned) {
      const input = prompt(
        `Ban "${target.username}"? Enter an optional reason (or leave blank):`,
        target.ban_reason ?? ""
      );
      if (input === null) return;
      reason = input.trim() || null;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        is_banned: nextBanned,
        ban_reason: nextBanned ? reason : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id);
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : nextBanned
        ? `Banned ${target.username}.`
        : `Unbanned ${target.username}.`
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleAdminDeleteBallot(ballot: AdminPublishedBallot) {
    if (
      !confirm(
        `Permanently delete "${ballot.title || "this ranking"}"? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("rankings")
      .delete()
      .eq("id", ballot.id);
    setStatusMsg(
      error ? `Error: ${error.message}` : "Published ranking deleted."
    );
    await refreshAll();
    setBusy(false);
  }

  async function checkTargetEditionConflict(
    ballot: AdminPublishedBallot,
    nextEditionId: string
  ) {
    if (!nextEditionId) {
      setConflictBallot(null);
      return;
    }
    const rankingType = ballot.ranking_type ?? "team";
    setCheckingConflict(true);
    let query = supabase
      .from("rankings")
      .select("id, title, status, updated_at, published_at")
      .eq("user_id", ballot.user_id)
      .eq("edition_id", nextEditionId)
      .eq("ranking_type", rankingType)
      .neq("id", ballot.id);

    if (ballot.division_id) {
      query = query.eq("division_id", ballot.division_id);
    } else {
      query = query.is("division_id", null);
    }
    if (rankingType === "player" && ballot.tier_variant) {
      query = query.eq("tier_variant", ballot.tier_variant);
    }

    const { data } = await query.maybeSingle();
    setConflictBallot((data as ConflictingBallotInfo | null) ?? null);
    setCheckingConflict(false);
  }

  function buildMovedTitle(
    ballot: AdminPublishedBallot,
    nextEdition: Edition | undefined
  ) {
    if (!nextEdition) return ballot.title ?? "";
    const oldEd = ballot.edition_name_snapshot;
    if (ballot.title && oldEd && ballot.title.includes(oldEd)) {
      return ballot.title.replace(oldEd, nextEdition.name);
    }
    if (ballot.ranking_type === "player") {
      return `${
        ballot.division_name_snapshot || "All Divisions"
      } Player Tier List — ${nextEdition.name}`;
    }
    if (ballot.division_name_snapshot) {
      return `${ballot.division_name_snapshot} Team Power Rankings — ${nextEdition.name}`;
    }
    return ballot.title ?? nextEdition.name;
  }

  function getEligibleTargetEditions(ballot: AdminPublishedBallot) {
    const rankingType = ballot.ranking_type ?? "team";
    return editions
      .filter(
        (e) =>
          e.season_id === ballot.season_id &&
          e.id !== ballot.edition_id &&
          (rankingType === "player" || !e.is_players_only)
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async function openMoveEditionModal(ballot: AdminPublishedBallot) {
    const seasonEds = getEligibleTargetEditions(ballot);
    const firstTarget = seasonEds[0];
    setMovingBallot(ballot);
    setTargetEditionId(firstTarget?.id ?? "");
    setMoveTitle(buildMovedTitle(ballot, firstTarget));
    setConflictBallot(null);
    setConfirmOverwriteChecked(false);
    if (firstTarget) {
      await checkTargetEditionConflict(ballot, firstTarget.id);
    }
  }

  async function handleTargetEditionChange(nextEditionId: string) {
    setTargetEditionId(nextEditionId);
    setConfirmOverwriteChecked(false);
    if (!movingBallot) return;
    const nextEd = editions.find((e) => e.id === nextEditionId);
    setMoveTitle(buildMovedTitle(movingBallot, nextEd));
    await checkTargetEditionConflict(movingBallot, nextEditionId);
  }

  async function handleConfirmMoveEdition() {
    if (!movingBallot || !targetEditionId) return;
    const targetEd = editions.find((e) => e.id === targetEditionId);
    if (!targetEd) return;
    if ((movingBallot.ranking_type ?? "team") === "team" && targetEd.is_players_only) {
      setStatusMsg(
        `Cannot move a Team Power Ranking into Players-Only edition "${targetEd.name}".`
      );
      return;
    }

    if (conflictBallot) {
      if (!confirmOverwriteChecked) return;
      const author = Array.isArray(movingBallot.profiles)
        ? movingBallot.profiles[0]
        : movingBallot.profiles;
      const confirmedSecond = confirm(
        `FINAL WARNING: Permanently DELETE ${
          author?.username ?? "this user"
        }'s existing ${conflictBallot.status.toUpperCase()} ranking "${
          conflictBallot.title || targetEd.name
        }" in ${targetEd.name} and replace it with this ranking? This cannot be undone.`
      );
      if (!confirmedSecond) return;
    }

    setBusy(true);
    try {
      if (conflictBallot) {
        const { error: delErr } = await supabase
          .from("rankings")
          .delete()
          .eq("id", conflictBallot.id);
        if (delErr) {
          setStatusMsg(`Error removing conflicting ranking: ${delErr.message}`);
          setBusy(false);
          return;
        }
      }

      const { error: updErr } = await supabase
        .from("rankings")
        .update({
          edition_id: targetEd.id,
          edition_name_snapshot: targetEd.name,
          title: moveTitle.trim() || movingBallot.title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", movingBallot.id);

      if (updErr) {
        setStatusMsg(`Error moving ranking: ${updErr.message}`);
      } else {
        setStatusMsg(
          `Moved ranking to ${targetEd.name}${
            conflictBallot ? " (overwrote existing version)" : ""
          }.`
        );
        setMovingBallot(null);
        await refreshAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddEdition(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSeasonId || !newEditionName.trim()) return;
    setBusy(true);
    const seasonEds = editions.filter((ed) => ed.season_id === selectedSeasonId);
    const nextOrder =
      seasonEds.length > 0
        ? Math.max(...seasonEds.map((ed) => ed.sort_order)) + 1
        : 0;
    const { error } = await supabase.from("editions").insert({
      season_id: selectedSeasonId,
      name: newEditionName.trim(),
      slug: slugify(newEditionName),
      sort_order: nextOrder,
      is_open: true,
      is_players_only: newEditionPlayersOnly,
    });
    if (!error) {
      setNewEditionName("");
      setNewEditionPlayersOnly(false);
      setStatusMsg("Edition created.");
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleToggleEditionPlayersOnly(ed: Edition) {
    const nextVal = !Boolean(ed.is_players_only);
    setBusy(true);
    const { error } = await supabase
      .from("editions")
      .update({ is_players_only: nextVal })
      .eq("id", ed.id);
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : nextVal
        ? `Set ${ed.name} to Players-Only (Draft Day / pre-team player tier lists only).`
        : `Set ${ed.name} to allow both Team Power Rankings and Player Tier Lists.`
    );
    await refreshAll();
    setBusy(false);
  }

  async function handleAddSinglePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSeasonId || !newSinglePlayerName.trim()) return;
    const trimmed = newSinglePlayerName.trim();
    const existingForSeason = seasonPlayers.filter(
      (p) => p.season_id === selectedSeasonId
    );
    if (
      existingForSeason.some(
        (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setStatusMsg(`"${trimmed}" is already in this season's player pool.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("season_players").insert({
      season_id: selectedSeasonId,
      name: trimmed,
      role: newSinglePlayerRole,
    });
    if (!error) {
      setNewSinglePlayerName("");
      setStatusMsg(`Added ${trimmed} (${newSinglePlayerRole}).`);
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleBulkAddRolePlayers(role: LeagueRole) {
    if (!selectedSeasonId) return;
    const raw = bulkPasteByRole[role] ?? "";
    const parsed = raw
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;

    const existingForSeason = seasonPlayers.filter(
      (p) => p.season_id === selectedSeasonId
    );
    const seen = new Set(
      existingForSeason.map((p) => p.name.trim().toLowerCase())
    );

    const toInsert: {
      season_id: string;
      name: string;
      role: LeagueRole;
    }[] = [];
    let skipped = 0;

    for (const name of parsed) {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      toInsert.push({
        season_id: selectedSeasonId,
        name,
        role,
      });
    }

    if (toInsert.length === 0) {
      setStatusMsg(
        `No new players added (${skipped} already existed in this season pool).`
      );
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("season_players").insert(toInsert);
    if (!error) {
      setBulkPasteByRole((prev) => ({ ...prev, [role]: "" }));
      setStatusMsg(
        `Added ${toInsert.length} ${role} player${
          toInsert.length === 1 ? "" : "s"
        }${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""}.`
      );
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleDeleteSeasonPlayer(player: SeasonPlayer) {
    setBusy(true);
    const { error } = await supabase
      .from("season_players")
      .delete()
      .eq("id", player.id);
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : `Removed ${player.name} from pool.`
    );
    await refreshAll();
    setBusy(false);
  }

  async function handleClearRolePlayers(role: LeagueRole, roleLabel: string) {
    if (!selectedSeasonId) return;
    const count = seasonPlayers.filter(
      (p) => p.season_id === selectedSeasonId && p.role === role
    ).length;
    if (count === 0) return;
    if (
      !window.confirm(
        `Remove all ${count} ${roleLabel} players from this season's pool?`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("season_players")
      .delete()
      .eq("season_id", selectedSeasonId)
      .eq("role", role);
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : `Cleared ${count} ${roleLabel} players from season pool.`
    );
    await refreshAll();
    setBusy(false);
  }

  async function handlePullPlayersFromTeams() {
    if (!selectedSeasonId) return;
    const divIds = new Set(
      divisions
        .filter((d) => d.season_id === selectedSeasonId)
        .map((d) => d.id)
    );
    const seasonTeams = teams.filter((t) => divIds.has(t.division_id));
    if (seasonTeams.length === 0) {
      setStatusMsg("No assigned teams found in this season.");
      return;
    }

    const existingForSeason = seasonPlayers.filter(
      (p) => p.season_id === selectedSeasonId
    );
    const seen = new Set(
      existingForSeason.map((p) => p.name.trim().toLowerCase())
    );

    const toInsert: {
      season_id: string;
      division_id: string;
      team_id: string;
      name: string;
      role: LeagueRole;
      is_captain: boolean;
    }[] = [];

    for (const team of seasonTeams) {
      const roster = normalizeRoster(team.roster, team.captain);
      for (const slot of roster) {
        const name = slot.name.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        toInsert.push({
          season_id: selectedSeasonId,
          division_id: team.division_id,
          team_id: team.id,
          name,
          role: slot.role,
          is_captain: Boolean(slot.is_captain),
        });
      }
    }

    if (toInsert.length === 0) {
      setStatusMsg("All assigned team players are already in the season pool.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("season_players").insert(toInsert);
    if (!error) {
      setStatusMsg(
        `Pulled ${toInsert.length} assigned team player${
          toInsert.length === 1 ? "" : "s"
        } into the season pool.`
      );
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleStripPlayerTaglines() {
    if (!selectedSeasonId) return;
    const toUpdate = filteredSeasonPlayers
      .map((p) => ({
        id: p.id,
        oldName: p.name,
        newName: p.name.replace(/\s*#.*$/, "").trim(),
      }))
      .filter((item) => item.newName.length > 0 && item.newName !== item.oldName);

    if (toUpdate.length === 0) {
      setStatusMsg("No player names contain #taglines to strip.");
      return;
    }

    if (
      !window.confirm(
        `Strip #taglines from ${toUpdate.length} player${
          toUpdate.length === 1 ? "" : "s"
        } in this season's pool?`
      )
    ) {
      return;
    }

    setBusy(true);
    const results = await Promise.all(
      toUpdate.map((item) =>
        supabase
          .from("season_players")
          .update({ name: item.newName })
          .eq("id", item.id)
      )
    );
    const firstErr = results.find((r) => r.error)?.error;
    setStatusMsg(
      firstErr
        ? `Error: ${firstErr.message}`
        : `Stripped #taglines from ${toUpdate.length} player${
            toUpdate.length === 1 ? "" : "s"
          }.`
    );
    await refreshAll();
    setBusy(false);
  }

  async function handleSaveEdition(ed: Edition) {
    if (!ed.name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("editions")
      .update({
        name: ed.name.trim(),
        slug: slugify(ed.name),
      })
      .eq("id", ed.id);
    setStatusMsg(error ? `Error: ${error.message}` : `Saved ${ed.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleMoveEdition(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= filteredEditions.length) return;
    const a = filteredEditions[index];
    const b = filteredEditions[targetIdx];

    setBusy(true);
    setStatusMsg(null);
    const { error: e1 } = await supabase
      .from("editions")
      .update({ sort_order: -999999 })
      .eq("id", a.id);
    const { error: e2 } = !e1
      ? await supabase
          .from("editions")
          .update({ sort_order: a.sort_order })
          .eq("id", b.id)
      : { error: e1 };
    const { error: e3 } = !e2
      ? await supabase
          .from("editions")
          .update({ sort_order: b.sort_order })
          .eq("id", a.id)
      : { error: e2 };

    setStatusMsg(e3 ? `Error: ${e3.message}` : "Edition order updated.");
    await refreshAll();
    setBusy(false);
  }


  async function handleDeleteLeague(league: League) {
    if (
      !window.confirm(
        `Delete league "${league.name}" and its seasons/divisions/teams? Existing published rankings will be preserved.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("leagues").delete().eq("id", league.id);
    setStatusMsg(error ? `Error: ${error.message}` : `Deleted ${league.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleDeleteSeason(season: Season) {
    if (
      !window.confirm(
        `Delete season "${season.name}" and its divisions/editions/teams? Existing published rankings will be preserved.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("seasons").delete().eq("id", season.id);
    setStatusMsg(error ? `Error: ${error.message}` : `Deleted ${season.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleDeleteDivision(division: Division) {
    if (
      !window.confirm(
        `Delete division "${division.name}" and its teams? Existing published rankings will be preserved.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("divisions")
      .delete()
      .eq("id", division.id);
    setStatusMsg(
      error ? `Error: ${error.message}` : `Deleted ${division.name}.`
    );
    await refreshAll();
    setBusy(false);
  }


  async function handleDeleteTeam(team: Team) {
    if (
      !window.confirm(
        `Delete team "${team.name}"? Existing published rankings will keep their snapshot.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    setStatusMsg(error ? `Error: ${error.message}` : `Deleted ${team.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleDeleteEdition(ed: Edition) {
    if (
      !window.confirm(
        `Delete edition "${ed.name}"? Existing published rankings will be preserved.`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("editions").delete().eq("id", ed.id);
    setStatusMsg(error ? `Error: ${error.message}` : `Deleted ${ed.name}.`);
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleEditionOpen(ed: Edition) {
    setBusy(true);
    await supabase
      .from("editions")
      .update({ is_open: !ed.is_open })
      .eq("id", ed.id);
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleEditionArchived(ed: Edition) {
    const nextArchived = !ed.is_archived;
    setBusy(true);
    const { error } = await supabase
      .from("editions")
      .update({
        is_archived: nextArchived,
        ...(nextArchived ? { is_open: false } : {}),
      })
      .eq("id", ed.id);
    setStatusMsg(
      error
        ? `Error: ${error.message}`
        : nextArchived
        ? `Archived ${ed.name} (drafts & edits disabled).`
        : `Unarchived ${ed.name} (remains locked until unlocked).`
    );
    await refreshAll();
    setBusy(false);
  }


  const filteredTeams = selectedDivisionId
    ? teams.filter((t) => t.division_id === selectedDivisionId)
    : [];
  const filteredEditions = editions
    .filter((e) => e.season_id === selectedSeasonId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const filteredSeasonPlayers = selectedSeasonId
    ? seasonPlayers.filter((p) => p.season_id === selectedSeasonId)
    : [];

  return (
    <RetroWindow
      title="Admin Console"
      theme="scdl"
      statusText={statusMsg ?? undefined}
    >
      <div className="flex flex-wrap gap-1.5 mb-4 pb-2 border-b border-white/10">
        {(
          [
            ["seasons", "Setup Seasons"],
            ["editions", "Setup Divisions and Editions"],
            ["teams", "Setup Teams"],
            ["players", "Setup Players"],
            ["moderation", "Moderation & Safety"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => handleSelectTab(key)}
            className={`xp-btn text-xs ${tab === key ? "xp-btn-primary" : ""}`}
          >
            {label}
          </button>
        ))}
        <Link
          href="/admin/stats"
          className="xp-btn text-xs sm:ml-auto border-[#c89b3c]/70 text-[#f0c020]"
        >
          <span>Stats Dashboard</span>
        </Link>
      </div>

      {(tab === "editions" || tab === "teams" || tab === "players") && (
        <div className="xp-panel p-3 mb-4 flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#a6a89e]">
              Season
            </label>
            <select
              value={selectedSeasonId}
              onChange={(e) => {
                const nextSeasonId = e.target.value;
                setSelectedSeasonId(nextSeasonId);
                const firstDiv = divisions.find(
                  (d) => d.season_id === nextSeasonId
                );
                setSelectedDivisionId(firstDiv?.id ?? "");
              }}
              className="xp-inset px-2 py-1 text-xs font-bold mt-0.5"
            >
              {seasons.map((s) => {
                const league = leagues.find((l) => l.id === s.league_id);
                const prefix =
                  league?.short_name ||
                  (league?.slug === "scdl" ? "SCDL" : league?.name);
                return (
                  <option key={s.id} value={s.id}>
                    {prefix ? `${prefix}: ` : ""}
                    {s.name} {!s.is_active ? "(Inactive)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {tab === "teams" && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#a6a89e]">
                Division
              </label>
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                disabled={seasonDivisions.length === 0}
                className="xp-inset px-2 py-1 text-xs font-bold mt-0.5"
              >
                {seasonDivisions.length === 0 ? (
                  <option value="">No divisions in this season</option>
                ) : (
                  seasonDivisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: TEAMS */}
      {tab === "teams" && (
        <div className="space-y-4">
          {!selectedDivisionId ? (
            <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
              Create a division for this season under &quot;Setup Divisions and
              Editions&quot; before adding teams.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTeams.map((team) => (
                  <div key={team.id} className="xp-panel p-3 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 shrink-0 xp-inset p-1 flex items-center justify-center">
                        {team.logo_url ? (
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-[#7e8781]">
                            LOGO
                          </span>
                        )}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#c7c5b8]">
                            Team Name
                          </label>
                          <input
                            type="text"
                            value={team.name}
                            onChange={(e) =>
                              setTeams((prev) =>
                                prev.map((t) =>
                                  t.id === team.id
                                    ? { ...t, name: e.target.value }
                                    : t
                                )
                              )
                            }
                            className="w-full xp-inset px-2 py-1 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#c7c5b8]">
                            Captain
                          </label>
                          <input
                            type="text"
                            value={team.captain ?? ""}
                            onChange={(e) =>
                              setTeams((prev) =>
                                prev.map((t) =>
                                  t.id === team.id
                                    ? { ...t, captain: e.target.value }
                                    : t
                                )
                              )
                            }
                            className="w-full xp-inset px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={team.logo_url ?? ""}
                            onChange={(e) =>
                              setTeams((prev) =>
                                prev.map((t) =>
                                  t.id === team.id
                                    ? { ...t, logo_url: e.target.value }
                                    : t
                                )
                              )
                            }
                            placeholder="Logo URL"
                            className="flex-1 xp-inset px-2 py-1 text-[11px]"
                          />
                          <label className="xp-btn text-[11px] px-2 py-1 cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleLogoUpload(team.id, f);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#c7c5b8] mb-1.5">
                        Roster (Top / Jungle / Mid / Bot / Support)
                      </label>
                      <div className="space-y-1.5">
                        {normalizeRoster(team.roster, team.captain).map(
                          (slot, sIdx) => {
                            const roleMeta = LEAGUE_ROLES[sIdx];
                            return (
                              <div
                                key={roleMeta.key}
                                className="xp-inset px-2 py-1 flex items-center gap-2"
                              >
                                <img
                                  src={roleMeta.icon}
                                  alt={roleMeta.label}
                                  title={roleMeta.label}
                                  className="w-4 h-4 object-contain shrink-0"
                                />
                                <input
                                  type="text"
                                  value={slot.name}
                                  onChange={(e) => {
                                    const updatedName = e.target.value;
                                    setTeams((prev) =>
                                      prev.map((t) => {
                                        if (t.id !== team.id) return t;
                                        const nextRoster = normalizeRoster(
                                          t.roster,
                                          t.captain
                                        ).map((r, idx) =>
                                          idx === sIdx
                                            ? { ...r, name: updatedName }
                                            : r
                                        );
                                        return { ...t, roster: nextRoster };
                                      })
                                    );
                                  }}
                                  placeholder={roleMeta.label}
                                  className="flex-1 min-w-0 bg-transparent text-xs font-mono focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAltInput("");
                                    setAltModal({
                                      teamId: team.id,
                                      teamName: team.name,
                                      slotIdx: sIdx,
                                      playerName: slot.name || roleMeta.label,
                                      alts: [...(slot.alt_accounts ?? [])],
                                    });
                                  }}
                                  title={
                                    slot.alt_accounts?.length
                                      ? `Alt accounts: ${slot.alt_accounts.join(", ")}`
                                      : "Add alt Riot ID for official match stats"
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 cursor-pointer transition ${
                                    slot.alt_accounts?.length
                                      ? "bg-[#2a2210] border-[#c89b3c]/70 text-[#f0c020]"
                                      : "bg-black/30 border-white/15 text-[#a6a89e] hover:text-white hover:border-white/30"
                                  }`}
                                >
                                  {slot.alt_accounts?.length
                                    ? `Alt (${slot.alt_accounts.length})`
                                    : "+Alt"}
                                </button>
                                <label
                                  className="inline-flex items-center gap-1 cursor-pointer shrink-0 text-[10px] text-[#c7c5b8]"
                                  title="Set as Team Captain"
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(slot.is_captain)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setTeams((prev) =>
                                        prev.map((t) => {
                                          if (t.id !== team.id) return t;
                                          const nextRoster = normalizeRoster(
                                            t.roster,
                                            t.captain
                                          ).map((r, idx) => ({
                                            ...r,
                                            is_captain:
                                              idx === sIdx ? checked : false,
                                          }));
                                          const capName = checked
                                            ? slot.name.split("#")[0].trim()
                                            : "";
                                          return {
                                            ...t,
                                            captain: capName || null,
                                            roster: nextRoster,
                                          };
                                        })
                                      );
                                    }}
                                    className="accent-[#f0c020]"
                                  />
                                  <img
                                    src={CAPTAIN_ICON}
                                    alt="Captain"
                                    className="w-3.5 h-3.5 object-contain"
                                  />
                                </label>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteTeam(team)}
                        className="xp-btn xp-btn-danger text-xs"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveTeam(team)}
                        className="xp-btn xp-btn-primary text-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Team</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddTeam}
                className="xp-panel p-3 flex flex-wrap items-end gap-2"
              >
                <div>
                  <label className="block text-[10px] font-bold text-[#c7c5b8]">
                    New Team Name
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Team Name"
                    className="xp-inset px-2 py-1 text-xs"
                  />
                </div>
                <button type="submit" disabled={busy} className="xp-btn text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Team</span>
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* TAB: SETUP PLAYERS (Season-wide Pre-Draft / Draft Pool) */}
      {tab === "players" && (
        <div className="space-y-4">
          {!selectedSeasonId ? (
            <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
              Create or select a season before adding players.
            </div>
          ) : (
            <>
              <div className="xp-panel p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Season Player Pool ({filteredSeasonPlayers.length} players)
                  </h2>
                  <p className="text-[11px] text-[#a6a89e] mt-0.5">
                    Pre-draft &amp; season-wide player pool organized by role
                    (used for Draft Day / All-Divisions Player Tier Lists before
                    teams exist).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePullPlayersFromTeams()}
                    className="xp-btn xp-btn-primary text-xs"
                    title="Copy roster players from all divisions/teams in this season into this pool (skips duplicates)"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Pull from Assigned Teams</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || filteredSeasonPlayers.length === 0}
                    onClick={() => void handleStripPlayerTaglines()}
                    className="xp-btn xp-btn-danger text-xs"
                    title="Remove #tagline suffixes (e.g. #NA1) from all players in this season's pool"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Strip #Taglines</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleAddSinglePlayer}
                className="xp-panel p-3 flex flex-wrap items-end gap-2"
              >
                <div>
                  <label className="block text-[10px] font-bold text-[#c7c5b8]">
                    Player Name
                  </label>
                  <input
                    type="text"
                    value={newSinglePlayerName}
                    onChange={(e) => setNewSinglePlayerName(e.target.value)}
                    placeholder="Summoner#NA1"
                    className="xp-inset px-2 py-1 text-xs w-48"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#c7c5b8]">
                    Role
                  </label>
                  <select
                    value={newSinglePlayerRole}
                    onChange={(e) =>
                      setNewSinglePlayerRole(e.target.value as LeagueRole)
                    }
                    className="xp-inset px-2 py-1 text-xs"
                  >
                    {LEAGUE_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={busy || !newSinglePlayerName.trim()}
                  className="xp-btn text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Player</span>
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {LEAGUE_ROLES.map((role) => {
                  const rolePlayers = filteredSeasonPlayers.filter(
                    (p) => p.role === role.key
                  );
                  return (
                    <div
                      key={role.key}
                      className="xp-panel p-3 space-y-2.5 flex flex-col"
                    >
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <img
                            src={role.icon}
                            alt={role.label}
                            className="w-4 h-4 object-contain"
                          />
                          <h3 className="font-bold text-xs uppercase text-[#f0c020]">
                            {role.label}
                          </h3>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#14171d] border border-white/15 rounded-xs text-[#d6d3c4]">
                            {rolePlayers.length}
                          </span>
                        </div>
                        {rolePlayers.length > 0 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleClearRolePlayers(role.key, role.label)
                            }
                            className="xp-btn xp-btn-danger text-[10px] px-1.5 py-0.5"
                            title={`Clear all ${role.label} players`}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="xp-inset p-2 min-h-[96px] max-h-48 overflow-y-auto flex flex-wrap content-start gap-1.5">
                        {rolePlayers.length === 0 ? (
                          <span className="text-[11px] text-[#7e8781] italic">
                            No {role.label} players added yet.
                          </span>
                        ) : (
                          rolePlayers.map((pl) => (
                            <span
                              key={pl.id}
                              className="inline-flex items-center gap-1 bg-[#1e232d] border border-[#3a4149] rounded-xs px-2 py-0.5 text-[11px] font-bold text-[#f0ede0]"
                            >
                              {pl.is_captain && (
                                <img
                                  src={CAPTAIN_ICON}
                                  alt="Captain"
                                  className="w-3 h-3 object-contain"
                                />
                              )}
                              <span>{pl.name}</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleDeleteSeasonPlayer(pl)}
                                className="text-[#a6a89e] hover:text-[#ff857a]"
                                title={`Remove ${pl.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <div className="space-y-1.5 pt-1 mt-auto">
                        <textarea
                          rows={3}
                          value={bulkPasteByRole[role.key] ?? ""}
                          onChange={(e) =>
                            setBulkPasteByRole((prev) => ({
                              ...prev,
                              [role.key]: e.target.value,
                            }))
                          }
                          placeholder={`Bulk paste ${role.label} players (one per line or comma-separated)...`}
                          className="w-full xp-inset px-2 py-1.5 text-[11px] resize-y"
                        />
                        <button
                          type="button"
                          disabled={
                            busy || !(bulkPasteByRole[role.key] ?? "").trim()
                          }
                          onClick={() => void handleBulkAddRolePlayers(role.key)}
                          className="xp-btn text-[11px] w-full justify-center"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to {role.label}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: SETUP SEASONS (Leagues & Seasons) */}
      {tab === "seasons" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Leagues */}
          <div className="xp-panel p-3 space-y-3">
            <h2 className="font-bold text-xs uppercase text-[#f0c020]">
              Leagues
            </h2>
            <div className="space-y-2">
              {leagues.map((l) => (
                <div
                  key={l.id}
                  className="xp-inset p-2 space-y-2 text-xs"
                >
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
                        onClick={() => handleSaveLeague(l)}
                        className="xp-btn text-[11px] px-2 py-1"
                        title="Save League"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteLeague(l)}
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
                          if (f) handleLeagueLogoUpload(l.id, f);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddLeague} className="flex flex-wrap gap-2 pt-2">
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
          </div>

          {/* Seasons */}
          <div className="xp-panel p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                Seasons
              </h2>
              <select
                value={newSeasonLeagueId || leagues[0]?.id || ""}
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
              {(() => {
                const activeLeagueId = newSeasonLeagueId || leagues[0]?.id || "";
                const leagueSeasons = seasons.filter(
                  (s) => s.league_id === activeLeagueId
                );
                if (leagueSeasons.length === 0) {
                  return (
                    <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                      No seasons in this league yet.
                    </div>
                  );
                }
                return leagueSeasons.map((s) => {
                  const league = leagues.find((l) => l.id === s.league_id);
                  return (
                    <div
                      key={s.id}
                      className="xp-inset p-2 space-y-1.5 text-xs"
                    >
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
                          onClick={() => handleSaveSeason(s)}
                          className="xp-btn text-[11px] px-2 py-1"
                          title="Save Season Name"
                        >
                          <Save className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleSeasonActive(s)}
                          className={`xp-btn text-[11px] py-1 ${
                            s.is_active ? "xp-btn-danger" : "xp-btn-primary"
                          }`}
                        >
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteSeason(s)}
                          className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                          title="Delete Season"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <details className="pt-1 border-t border-white/10 text-[11px]">
                        <summary className="cursor-pointer text-[#a6a89e] hover:text-[#f0c020] font-semibold select-none">
                          Stats &amp; Credits Source (
                          {s.stats_provider ?? "google_sheet"}
                          {s.stats_sheet_id ? " • sheet linked" : ""})
                        </summary>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#c7c5b8]">
                              Stats Provider
                            </label>
                            <select
                              value={s.stats_provider ?? "google_sheet"}
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
                              <option value="google_sheet">
                                Google Sheet CSV
                              </option>
                              <option value="supabase_native">
                                Supabase Native (league_game_participants)
                              </option>
                              <option value="none">None (Solo/Duo only)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#c7c5b8]">
                              Google Sheet ID
                            </label>
                            <input
                              type="text"
                              value={s.stats_sheet_id ?? ""}
                              onChange={(e) =>
                                setSeasons((prev) =>
                                  prev.map((item) =>
                                    item.id === s.id
                                      ? {
                                          ...item,
                                          stats_sheet_id: e.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              placeholder="1tdi8ftaQ50sYS92H39YybU29..."
                              className="w-full xp-inset px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#c7c5b8]">
                              Sheet Tab GIDs (comma-separated)
                            </label>
                            <input
                              type="text"
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
                              className="w-full xp-inset px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#c7c5b8]">
                              Credits Link Label
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
                              className="w-full xp-inset px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#c7c5b8]">
                              Credits URL (optional override)
                            </label>
                            <input
                              type="text"
                              value={s.stats_credits_url ?? ""}
                              onChange={(e) =>
                                setSeasons((prev) =>
                                  prev.map((item) =>
                                    item.id === s.id
                                      ? {
                                          ...item,
                                          stats_credits_url: e.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              className="w-full xp-inset px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#c7c5b8]">
                              Credits Attribution
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
                                          stats_credits_attribution:
                                            e.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              placeholder="the SCDL Admin Team (special thanks to Pandora)"
                              className="w-full xp-inset px-2 py-1 text-xs"
                            />
                          </div>
                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleSaveSeason(s)}
                              className="xp-btn xp-btn-primary text-xs"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Stats &amp; Credits Config</span>
                            </button>
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                });
              })()}
            </div>
            <form
              onSubmit={handleAddSeason}
              className="flex flex-wrap gap-2 pt-2"
            >
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
      )}

      {/* TAB 3: SETUP DIVISIONS AND EDITIONS */}
      {tab === "editions" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Divisions */}
            <div className="lg:col-span-5 xp-panel p-3 space-y-3">
            <h2 className="font-bold text-xs uppercase text-[#f0c020]">
              Divisions
            </h2>
            <div className="space-y-2">
              {seasonDivisions.length === 0 ? (
                <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                  No divisions in this season yet.
                </div>
              ) : (
                seasonDivisions.map((d) => (
                  <div
                    key={d.id}
                    className="xp-inset p-2 space-y-2 text-xs"
                  >
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
                            if (f) handleDivisionLogoUpload(d.id, f);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveDivision(d)}
                        className="xp-btn xp-btn-primary text-[11px] px-2 py-1 shrink-0"
                        title="Save Division"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteDivision(d)}
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
            <form
              onSubmit={handleAddDivision}
              className="flex flex-wrap gap-2 pt-2"
            >
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
                {themes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy} className="xp-btn text-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Division</span>
              </button>
            </form>
          </div>

          {/* Right: Editions */}
          <div className="lg:col-span-7 xp-panel p-3 space-y-3">
            <div>
              <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                Editions
              </h2>
              <p className="text-[11px] text-[#a6a89e] mt-0.5">
                <strong className="text-[#f0c020]">IMPORTANT:</strong> Order
                editions chronologically from earliest (top) to latest (bottom)
                for accurate change tracking.
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
                        onClick={() => handleMoveEdition(idx, -1)}
                        className="xp-btn !px-1 !py-0.5 text-[10px] leading-none"
                        title="Move Up"
                      >
                        <ArrowUp className="w-2.5 h-2.5 shrink-0" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || idx === filteredEditions.length - 1}
                        onClick={() => handleMoveEdition(idx, 1)}
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
                      onClick={() => void handleToggleEditionPlayersOnly(ed)}
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
                      onClick={() => handleSaveEdition(ed)}
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
                      {ed.is_archived ? "Archived" : ed.is_open ? "Open" : "Locked"}
                    </span>

                    <div className="basis-full h-0 sm:hidden order-4" />

                    <button
                      type="button"
                      disabled={busy || Boolean(ed.is_archived)}
                      onClick={() => handleToggleEditionOpen(ed)}
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
                      onClick={() => handleToggleEditionArchived(ed)}
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
                      onClick={() => handleDeleteEdition(ed)}
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
              onSubmit={handleAddEdition}
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
          </div>

          {/* Bottom: Division Themes */}
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
                      onClick={() => handleSaveTheme(th)}
                      className="xp-btn xp-btn-primary text-[11px] px-2 py-1"
                      title="Save Theme"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                    {th.key !== "baron" && th.key !== "dragon" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDeleteTheme(th)}
                        className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                        title="Delete Theme"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
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
                          if (f) handleThemeLogoUpload(th.key, f);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddTheme}
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
        </div>
      )}

      {/* TAB 4: MODERATION & SAFETY */}
      {tab === "moderation" && (
        <div className="space-y-4">
          {/* Global Kill Switch */}
          <div className="xp-panel p-3 space-y-3 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-5 h-5 ${
                    appSettings.maintenance_mode
                      ? "text-[#ff857a]"
                      : "text-[#7cd438]"
                  }`}
                />
                <div>
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Global Kill Switch
                  </h2>
                  <p className="text-[11px] text-[#a6a89e]">
                    Temporarily take Rankr offline for all non-admin users while
                    you adjust safety measures.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleToggleKillSwitch}
                className={`xp-btn text-xs ${
                  appSettings.maintenance_mode
                    ? "xp-btn-primary"
                    : "xp-btn-danger"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {appSettings.maintenance_mode
                    ? "Disable Kill Switch (Go Online)"
                    : "Enable Kill Switch (Go Offline)"}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={appSettings.maintenance_message}
                onChange={(e) =>
                  setAppSettings((prev) => ({
                    ...prev,
                    maintenance_message: e.target.value,
                  }))
                }
                placeholder="Maintenance message shown to users..."
                className="flex-1 min-w-[220px] xp-inset px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveMaintenanceMessage}
                className="xp-btn text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Message</span>
              </button>
            </div>
          </div>

          {/* Discord Allowlist (Invite-Only Authoring) */}
          <div className="xp-panel p-3 space-y-3 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lock
                  className={`w-5 h-5 ${
                    appSettings.require_allowlist
                      ? "text-[#f0c020]"
                      : "text-[#a6a89e]"
                  }`}
                />
                <div>
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Discord Allowlist (Invite-Only Authoring)
                  </h2>
                  <p className="text-[11px] text-[#a6a89e]">
                    Everyone can still browse and view ballot links, but only
                    allowlisted Discord IDs (and admins) can sign in to rank or
                    edit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleToggleAllowlistMode}
                className={`xp-btn text-xs ${
                  appSettings.require_allowlist ? "xp-btn-primary" : ""
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>
                  {appSettings.require_allowlist
                    ? "Allowlist Active (Click to Open)"
                    : "Require Allowlist"}
                </span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddAllowedUser(newAllowedDiscordId, newAllowedLabel);
              }}
              className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10"
            >
              <input
                type="text"
                value={newAllowedDiscordId}
                onChange={(e) => setNewAllowedDiscordId(e.target.value)}
                placeholder="Discord User ID (e.g. 123456789012345678)"
                className="flex-1 min-w-[200px] xp-inset px-2.5 py-1.5 text-xs font-mono"
              />
              <input
                type="text"
                value={newAllowedLabel}
                onChange={(e) => setNewAllowedLabel(e.target.value)}
                placeholder="Label / Name (optional)"
                className="w-48 xp-inset px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={busy || !newAllowedDiscordId.trim()}
                className="xp-btn xp-btn-primary text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Discord ID</span>
              </button>
            </form>

            {allowedUsers.length > 0 && (
              <div className="pt-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllowlist((prev) => !prev)}
                    className="xp-btn text-xs"
                  >
                    <span>
                      {showAllowlist
                        ? `Hide Allowlisted IDs (${allowedUsers.length})`
                        : `Show Allowlisted IDs (${allowedUsers.length})`}
                    </span>
                  </button>
                  <Link href="/admin/users" className="xp-btn text-xs">
                    <span>Manage on Users Log →</span>
                  </Link>
                </div>

                {showAllowlist && (
                  <div className="xp-inset p-2 space-y-2">
                    <input
                      type="text"
                      value={allowlistSearch}
                      onChange={(e) => setAllowlistSearch(e.target.value)}
                      placeholder="Filter allowlist by name or Discord ID..."
                      className="w-full xp-inset px-2.5 py-1 text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {allowedUsers
                        .filter((entry) => {
                          const q = allowlistSearch.trim().toLowerCase();
                          if (!q) return true;
                          const matchedProfile = profiles.find(
                            (p) => p.discord_id === entry.discord_id
                          );
                          const displayName = (
                            entry.label ||
                            matchedProfile?.username ||
                            ""
                          ).toLowerCase();
                          return (
                            displayName.includes(q) ||
                            entry.discord_id.toLowerCase().includes(q)
                          );
                        })
                        .map((entry) => {
                          const matchedProfile = profiles.find(
                            (p) => p.discord_id === entry.discord_id
                          );
                          const displayName =
                            entry.label ||
                            matchedProfile?.username ||
                            "Approved";
                          const shortId =
                            entry.discord_id.length > 4
                              ? `#${entry.discord_id.slice(-4)}`
                              : entry.discord_id;
                          return (
                            <div
                              key={entry.discord_id}
                              title={`Discord ID: ${entry.discord_id}`}
                              className="xp-panel px-2 py-1 text-[11px] flex items-center gap-1.5"
                            >
                              <span className="font-bold text-[#f0ede0]">
                                {displayName}
                              </span>
                              <code className="text-[10px] text-[#a6a89e] font-mono">
                                {shortId}
                              </code>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleRemoveAllowedUser(entry.discord_id)
                                }
                                className="text-[#ff857a] hover:text-white ml-0.5"
                                title={`Remove ${entry.discord_id} from allowlist`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Published Rankings Moderation */}
            <div className="lg:col-span-6 xp-panel p-3 flex flex-col justify-between gap-2.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Recent Published Rankings ({Math.min(publishedBallots.length, 4)} of {publishedBallots.length})
                  </h2>
                </div>
                <div className="space-y-1.5">
                {publishedBallots.length === 0 ? (
                  <div className="xp-inset p-3 text-xs text-[#a6a89e]">
                    No published rankings found.
                  </div>
                ) : (
                  publishedBallots.slice(0, 4).map((b) => {
                    const author = Array.isArray(b.profiles)
                      ? b.profiles[0]
                      : b.profiles;
                    return (
                      <div
                        key={b.id}
                        className="xp-inset p-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              title={
                                b.ranking_type === "player"
                                  ? "Player Tier List"
                                  : "Team Power Rankings"
                              }
                              className="w-5 h-5 rounded bg-[#2a2210] border border-[#c89b3c]/70 inline-flex items-center justify-center shrink-0"
                            >
                              {b.ranking_type === "player" ? (
                                <User className="w-3 h-3 text-[#f0c020]" />
                              ) : (
                                <TeamGroupIcon className="w-3 h-3 text-[#f0c020]" />
                              )}
                            </span>
                            <span className="font-bold text-[#f0ede0] truncate">
                              {b.title || "Untitled Ranking"}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#a6a89e] truncate">
                            By {author?.username ?? "Unknown"}
                            {author?.is_banned ? " (BANNED)" : ""} •{" "}
                            {b.published_at
                              ? new Date(b.published_at).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {b.season_id && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void openMoveEditionModal(b)}
                              className="xp-btn text-[11px] px-2 py-1"
                              title="Move / Force-Overwrite to Different Edition"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                          )}
                          <Link
                            href={
                              b.ranking_type === "player"
                                ? `/tierlist/${b.id}`
                                : `/rankings/${b.id}`
                            }
                            className="xp-btn text-[11px] px-2 py-1"
                            title="View Ranking"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAdminDeleteBallot(b)}
                            className="xp-btn xp-btn-danger text-[11px] px-2 py-1"
                            title="Delete Published Ranking"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
              <Link
                href="/admin/publishings"
                className="xp-btn text-xs w-full justify-center"
              >
                <span>View All Publishings Log ({publishedBallots.length}) →</span>
              </Link>
            </div>

            {/* Discord User Moderation / Bans */}
            <div className="lg:col-span-6 xp-panel p-3 flex flex-col justify-between gap-2.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-xs uppercase text-[#f0c020]">
                    Users ({Math.min(profiles.length, 4)} of {profiles.length})
                  </h2>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user or Discord ID..."
                    className="xp-inset px-2 py-1 text-xs w-48"
                  />
                </div>
                <div className="space-y-1.5">
                  {profiles
                    .filter((p) => {
                      const q = userSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.username.toLowerCase().includes(q) ||
                        (p.discord_id ?? "").toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 4)
                    .map((p) => (
                    <div
                      key={p.id}
                      className="xp-inset p-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {p.avatar_url && (
                          <img
                            src={p.avatar_url}
                            alt={p.username}
                            className="w-6 h-6 rounded-xs object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#f0ede0] truncate">
                              {p.username}
                            </span>
                            {p.is_admin && (
                              <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#2d5a3f] text-[#7cd438] rounded-xs">
                                Admin
                              </span>
                            )}
                            {!p.is_admin &&
                              p.discord_id &&
                              allowedIdSet.has(p.discord_id) && (
                                <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#1f3d5a] text-[#7cc4ff] rounded-xs">
                                  Allowed
                                </span>
                              )}
                            {p.is_banned && (
                              <span className="px-1 py-0.5 text-[9px] font-bold uppercase bg-[#451717] text-[#ff857a] rounded-xs">
                                Banned
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#a6a89e] truncate">
                            Discord ID: {p.discord_id ?? "N/A"}
                            {p.ban_reason ? ` • Reason: ${p.ban_reason}` : ""}
                          </div>
                        </div>
                      </div>
                      {p.id !== currentUserId && !p.is_admin && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.discord_id &&
                            (allowedIdSet.has(p.discord_id) ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleRemoveAllowedUser(p.discord_id!)
                                }
                                className="xp-btn text-[11px] px-2 py-1"
                                title="Remove from allowlist"
                              >
                                <X className="w-3 h-3" />
                                <span>Revoke</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleAddAllowedUser(p.discord_id!, p.username)
                                }
                                className="xp-btn xp-btn-primary text-[11px] px-2 py-1"
                                title="Approve Discord user for ranking"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                            ))}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggleBanUser(p)}
                            className={`xp-btn text-[11px] px-2 py-1 ${
                              p.is_banned ? "xp-btn-primary" : "xp-btn-danger"
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{p.is_banned ? "Unban" : "Ban"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {profiles.length > 4 && (
                <Link
                  href="/admin/users"
                  className="xp-btn text-xs w-full justify-center"
                >
                  <span>View All Users Log ({profiles.length}) →</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {movingBallot && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => !busy && setMovingBallot(null)}
        >
          <div
            className="w-full max-w-md xp-window overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="xp-titlebar px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#f0c020]" />
                <span>Move / Overwrite Edition</span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMovingBallot(null)}
                className="text-white/80 hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3.5 bg-[#1a1c23] text-xs text-[#d6d3c4]">
              <div className="xp-inset p-2.5 space-y-1">
                <div className="font-bold text-[#f0ede0] truncate">
                  {movingBallot.title || "Untitled Ranking"}
                </div>
                <div className="text-[11px] text-[#a6a89e]">
                  Current Edition:{" "}
                  <strong className="text-[#f0c020]">
                    {movingBallot.edition_name_snapshot || "Unknown"}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#c7c5b8] mb-1">
                  Target Edition
                </label>
                <select
                  value={targetEditionId}
                  disabled={busy}
                  onChange={(e) => void handleTargetEditionChange(e.target.value)}
                  className="w-full xp-inset px-2.5 py-1.5 text-xs font-bold"
                >
                  {getEligibleTargetEditions(movingBallot).map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name}{" "}
                      {ed.is_archived
                        ? "(Archived)"
                        : !ed.is_open
                        ? "(Locked)"
                        : "(Open)"}
                      {ed.is_players_only ? " [Players-Only]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#c7c5b8] mb-1">
                  Updated Title
                </label>
                <input
                  type="text"
                  value={moveTitle}
                  disabled={busy}
                  onChange={(e) => setMoveTitle(e.target.value)}
                  className="w-full xp-inset px-2.5 py-1.5 text-xs"
                />
              </div>

              {checkingConflict ? (
                <div className="xp-inset p-2.5 text-[11px] text-[#a6a89e]">
                  Checking target edition for existing rankings...
                </div>
              ) : conflictBallot ? (
                <div className="p-3 bg-[#451717] border border-[#ff857a] text-[#ffdeda] space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#ff857a]">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      OVERWRITE WARNING — Existing{" "}
                      {conflictBallot.status.toUpperCase()} Ranking Found!
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This user already has a{" "}
                    <strong>{conflictBallot.status}</strong> ranking in the
                    target edition:{" "}
                    <strong className="text-white">
                      {conflictBallot.title || "Untitled Ranking"}
                    </strong>{" "}
                    (updated{" "}
                    {new Date(
                      conflictBallot.published_at ?? conflictBallot.updated_at
                    ).toLocaleDateString()}
                    ). Moving this ranking will{" "}
                    <strong>permanently delete</strong> that existing version.
                  </p>
                  <label className="flex items-start gap-2 pt-1 cursor-pointer text-[11px] font-bold text-white">
                    <input
                      type="checkbox"
                      checked={confirmOverwriteChecked}
                      onChange={(e) =>
                        setConfirmOverwriteChecked(e.target.checked)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      I understand this will permanently overwrite and delete
                      the existing {conflictBallot.status} ranking.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="p-2.5 bg-[#3d3012] border border-[#8c6b16] text-[#f7d560] text-[11px]">
                  This will move the ranking to the selected edition (even if
                  that edition is locked or archived) and update its edition
                  snapshot.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMovingBallot(null)}
                  className="xp-btn text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    checkingConflict ||
                    !targetEditionId ||
                    (Boolean(conflictBallot) && !confirmOverwriteChecked)
                  }
                  onClick={() => void handleConfirmMoveEdition()}
                  className={`xp-btn text-xs ${
                    conflictBallot ? "xp-btn-danger" : "xp-btn-primary"
                  } disabled:opacity-40`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>
                    {busy
                      ? "Moving..."
                      : conflictBallot
                      ? "Force Overwrite Edition"
                      : "Move to Edition"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {altModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="xp-window xp-window-scdl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="xp-titlebar xp-titlebar-scdl flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[#f0c020]" />
                <span>
                  Alt Accounts — {altModal.playerName} ({altModal.teamName})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAltModal(null)}
                className="text-[#c7c5b8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs bg-[#171b19]">
              <p className="text-[11px] text-[#a6a89e]">
                Add any alt Riot IDs (e.g. <code>AltName#NA1</code>) this
                player used in official league matches. Only used to link match
                stats back to this rostered player.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={altInput}
                  onChange={(e) => setAltInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const clean = altInput.trim();
                      if (!clean) return;
                      setAltModal((prev) =>
                        prev &&
                        !prev.alts.some(
                          (a) => a.toLowerCase() === clean.toLowerCase()
                        )
                          ? { ...prev, alts: [...prev.alts, clean] }
                          : prev
                      );
                      setAltInput("");
                    }
                  }}
                  placeholder="RiotID#TAG"
                  className="flex-1 xp-inset px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = altInput.trim();
                    if (!clean) return;
                    setAltModal((prev) =>
                      prev &&
                      !prev.alts.some(
                        (a) => a.toLowerCase() === clean.toLowerCase()
                      )
                        ? { ...prev, alts: [...prev.alts, clean] }
                        : prev
                    );
                    setAltInput("");
                  }}
                  className="xp-btn text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {altModal.alts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {altModal.alts.map((alt) => (
                    <span
                      key={alt}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#2a2210] border border-[#c89b3c]/60 text-[11px] font-mono text-[#f0c020]"
                    >
                      <span>{alt}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAltModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  alts: prev.alts.filter((a) => a !== alt),
                                }
                              : prev
                          )
                        }
                        className="text-[#ff857a] hover:text-white cursor-pointer"
                        title="Remove alt"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-[#a6a89e] italic">
                  No alt accounts linked yet.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAltModal(null)}
                  className="xp-btn text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const targetTeam = teams.find(
                      (t) => t.id === altModal.teamId
                    );
                    if (!targetTeam) {
                      setAltModal(null);
                      return;
                    }
                    const cleanPending = altInput.trim();
                    const finalAlts =
                      cleanPending &&
                      !altModal.alts.some(
                        (a) => a.toLowerCase() === cleanPending.toLowerCase()
                      )
                        ? [...altModal.alts, cleanPending]
                        : altModal.alts;
                    const nextRoster = normalizeRoster(
                      targetTeam.roster,
                      targetTeam.captain
                    ).map((r, idx) =>
                      idx === altModal.slotIdx
                        ? {
                            ...r,
                            ...(finalAlts.length > 0
                              ? { alt_accounts: finalAlts }
                              : { alt_accounts: undefined }),
                          }
                        : r
                    );
                    const updatedTeam = { ...targetTeam, roster: nextRoster };
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === updatedTeam.id ? updatedTeam : t
                      )
                    );
                    setAltModal(null);
                    void handleSaveTeam(updatedTeam);
                  }}
                  className="xp-btn xp-btn-primary text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Alts</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RetroWindow>
  );
}

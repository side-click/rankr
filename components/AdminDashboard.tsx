"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type {
  AllowedDiscordUser,
  AppSettings,
  Division,
  DivisionPlayoffBracket,
  DivisionTheme,
  Edition,
  League,
  LeagueAllowedUser,
  LeagueOperator,
  Profile,
  Season,
  SeasonConfigBackup,
  SeasonMatch,
  SeasonPlayoffBrackets,
  SeasonPlayer,
  Team,
  TeamCaptain,
} from "@/types/database";
import { AdminDivisionsEditionsTab } from "@/components/admin/AdminDivisionsEditionsTab";
import {
  AdminModerationTab,
  type ModerationEventRow,
} from "@/components/admin/AdminModerationTab";
import { AdminPlayersTab } from "@/components/admin/AdminPlayersTab";
import { AdminSchedulePlayoffsTab } from "@/components/admin/AdminSchedulePlayoffsTab";
import { AdminSeasonsTab } from "@/components/admin/AdminSeasonsTab";
import { AdminTeamsTab } from "@/components/admin/AdminTeamsTab";
import { MatchStatsUploader } from "@/components/admin/AdminDataImportPanel";
import { RetroWindow } from "@/components/RetroWindow";
import {
  LEAGUE_ROLES,
  normalizeRoster,
  type LeagueRole,
} from "@/utils/roles";
import { DEFAULT_DIVISION_THEMES } from "@/utils/themes";
import {
  ArrowRightLeft,
  Ban,
  Eye,
  Plus,
  Power,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import {
  buildMovedRankingTitle,
  deleteAdminRanking,
  executeMoveRankingEdition,
  findTargetEditionConflict,
  getEligibleTargetEditions as computeEligibleTargetEditions,
  type AdminRankingItem,
  type ConflictingRankingInfo,
} from "@/utils/adminRankingActions";

type AdminPublishedBallot = AdminRankingItem;
type ConflictingBallotInfo = ConflictingRankingInfo;

interface AdminDashboardProps {
  currentUserId: string;
  isSiteAdmin: boolean;
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
  initialLeagueOperators: LeagueOperator[];
  initialLeagueAllowedUsers: LeagueAllowedUser[];
  initialTeamCaptains: TeamCaptain[];
  initialSeasonMatches: SeasonMatch[];
  initialSeasonBackups: SeasonConfigBackup[];
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
  isSiteAdmin,
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
  initialLeagueOperators,
  initialLeagueAllowedUsers,
  initialTeamCaptains,
  initialSeasonMatches,
  initialSeasonBackups,
}: AdminDashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const validTabs = [
    "seasons",
    "divisions",
    "editions",
    "players",
    "teams",
    "schedule",
    "moderation",
  ] as const;
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
  const [existingBlogIds, setExistingBlogIds] = useState<Set<string>>(
    () => new Set()
  );
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [publishedBallots, setPublishedBallots] = useState<
    AdminPublishedBallot[]
  >(initialPublishedBallots);
  const [allowedUsers, setAllowedUsers] =
    useState<AllowedDiscordUser[]>(initialAllowedUsers);
  const [leagueOperators, setLeagueOperators] =
    useState<LeagueOperator[]>(initialLeagueOperators);
  const [leagueAllowedUsers, setLeagueAllowedUsers] = useState<
    LeagueAllowedUser[]
  >(initialLeagueAllowedUsers);
  const [teamCaptains, setTeamCaptains] =
    useState<TeamCaptain[]>(initialTeamCaptains);
  const [seasonMatches, setSeasonMatches] =
    useState<SeasonMatch[]>(initialSeasonMatches);
  const [seasonBackups, setSeasonBackups] =
    useState<SeasonConfigBackup[]>(initialSeasonBackups);
  const [newCaptainDiscordByTeam, setNewCaptainDiscordByTeam] = useState<
    Record<string, string>
  >({});
  const [moderationEvents, setModerationEvents] = useState<
    ModerationEventRow[]
  >([]);
  const [previewRole, setPreviewRole] = useState<
    "operator" | "captain" | "public"
  >("operator");
  const [previewLeagueId, setPreviewLeagueId] = useState<string>(
    initialLeagues[0]?.id ?? ""
  );
  const [previewTeamId, setPreviewTeamId] = useState<string>(
    initialTeams[0]?.id ?? ""
  );
  const [previewBusy, setPreviewBusy] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationRules, setModerationRules] = useState<
    { id: string; term: string; rule_type: "allow" | "block" | "flag" }[]
  >([]);
  const [moderationRulesError, setModerationRulesError] = useState<
    string | null
  >(null);
  const [newRuleTerm, setNewRuleTerm] = useState("");
  const [newRuleType, setNewRuleType] = useState<"allow" | "block" | "flag">(
    "allow"
  );
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
  const [newThemePrimary, setNewThemePrimary] = useState("#dc2626");
  const [newThemeSecondary, setNewThemeSecondary] = useState("#16a34a");
  const [newThemeText, setNewThemeText] = useState("#2563eb");
  const [newEditionName, setNewEditionName] = useState("");
  const [newEditionPlayersOnly, setNewEditionPlayersOnly] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [bulkPasteByRole, setBulkPasteByRole] = useState<Record<LeagueRole, string>>({
    top: "",
    jungle: "",
    mid: "",
    bot: "",
    support: "",
  });

  async function loadModerationEvents() {
    setModerationLoading(true);
    setModerationError(null);
    setModerationRulesError(null);
    try {
      const leagueIds = leagues.map((l) => l.id).filter(Boolean);
      if (!isSiteAdmin && leagueIds.length === 0) {
        setModerationEvents([]);
        setExistingBlogIds(new Set());
        return;
      }

      const evQuery = supabase
        .from("moderation_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      const scopedEvQuery = !isSiteAdmin
        ? evQuery.in("league_id", leagueIds)
        : evQuery;

      const [evRes, rulesRes] = await Promise.all([
        scopedEvQuery,
        isSiteAdmin
          ? supabase
              .from("moderation_rules")
              .select("id, term, rule_type")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (evRes.error) {
        setModerationError(evRes.error.message);
      } else if (evRes.data) {
        setModerationEvents(evRes.data);
        const blogIds = Array.from(
          new Set(
            evRes.data
              .filter((e) => e.content_type === "blog" && e.content_id)
              .map((e) => e.content_id as string)
          )
        );
        if (blogIds.length > 0) {
          const { data: blogRows } = await supabase
            .from("blogs")
            .select("id")
            .in("id", blogIds);
          setExistingBlogIds(new Set((blogRows ?? []).map((b) => b.id)));
        } else {
          setExistingBlogIds(new Set());
        }
      }
      if (rulesRes.error) {
        setModerationRulesError(rulesRes.error.message);
      } else if (rulesRes.data) {
        setModerationRules(rulesRes.data);
      }
    } finally {
      setModerationLoading(false);
    }
  }

  async function handleModerateAlertContent(
    ev: ModerationEventRow,
    action: "unpublish" | "delete"
  ) {
    const label = ev.title_snapshot || ev.content_type;
    const prompt =
      action === "unpublish"
        ? `Unpublish "${label}" back to draft and resolve this alert?`
        : `Permanently DELETE "${label}" and resolve this alert? This cannot be undone.`;
    if (!window.confirm(prompt)) return;

    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/moderation/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id, action }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        resolved_at?: string;
      };
      if (!res.ok) {
        setStatusMsg(json.error || `Failed to ${action} content.`);
        return;
      }
      setModerationEvents((prev) =>
        prev.map((row) =>
          row.id === ev.id
            ? {
                ...row,
                resolved: true,
                resolved_at: json.resolved_at ?? new Date().toISOString(),
              }
            : row
        )
      );
      if (ev.content_id) {
        if (ev.content_type === "blog") {
          setExistingBlogIds((prev) => {
            const next = new Set(prev);
            next.delete(ev.content_id!);
            return next;
          });
        } else {
          setPublishedBallots((prev) =>
            prev.filter((b) => b.id !== ev.content_id)
          );
        }
      }
      setStatusMsg(
        action === "unpublish"
          ? `Unpublished "${label}" to draft and resolved alert.`
          : `Deleted "${label}" and resolved alert.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleStartViewAs() {
    setPreviewBusy(true);
    setStatusMsg(null);
    try {
      let payload: Record<string, string>;
      let redirectTo = "/";
      if (previewRole === "operator") {
        const league = leagues.find((l) => l.id === previewLeagueId);
        if (!league) {
          setStatusMsg("Select a league to preview as operator.");
          return;
        }
        payload = {
          mode: "operator",
          leagueId: league.id,
          label: league.short_name || league.name,
        };
        redirectTo = "/admin";
      } else if (previewRole === "captain") {
        const team = teams.find((t) => t.id === previewTeamId);
        if (!team) {
          setStatusMsg("Select a team to preview as captain.");
          return;
        }
        payload = {
          mode: "captain",
          teamId: team.id,
          label: team.name,
        };
        redirectTo = "/team-hub";
      } else {
        payload = { mode: "public", label: "Regular User" };
        redirectTo = "/";
      }

      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatusMsg(json.error || "Failed to start role preview.");
        return;
      }
      window.location.href = redirectTo;
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleAddModerationRule(e: React.FormEvent) {
    e.preventDefault();
    const clean = newRuleTerm.trim();
    if (!clean) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("moderation_rules")
      .insert({ term: clean, rule_type: newRuleType })
      .select("id, term, rule_type")
      .single();
    if (error) {
      setStatusMsg(`Rule error: ${error.message}`);
    } else if (data) {
      setModerationRules((prev) => [data, ...prev]);
      setNewRuleTerm("");
      setStatusMsg(`Added ${newRuleType} rule "${clean}".`);
    }
    setBusy(false);
  }

  async function handleDeleteModerationRule(ruleId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("moderation_rules")
      .delete()
      .eq("id", ruleId);
    if (!error) {
      setModerationRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
    setBusy(false);
  }

  useEffect(() => {
    if (tab === "moderation") {
      void loadModerationEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleToggleModerationResolved(
    evId: string,
    currentResolved: boolean
  ) {
    setBusy(true);
    const nextResolved = !currentResolved;
    const resolvedAt = nextResolved ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("moderation_events")
      .update({ resolved: nextResolved, resolved_at: resolvedAt })
      .eq("id", evId);
    if (!error) {
      setModerationEvents((prev) =>
        prev.map((row) =>
          row.id === evId
            ? { ...row, resolved: nextResolved, resolved_at: resolvedAt }
            : row
        )
      );
    }
    setBusy(false);
  }

  async function handleDeleteModerationEvent(evId: string, label: string) {
    if (
      !window.confirm(
        `Permanently remove the moderation alert for "${label}" from the log?`
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("moderation_events")
      .delete()
      .eq("id", evId);
    if (!error) {
      setModerationEvents((prev) => prev.filter((row) => row.id !== evId));
    }
    setBusy(false);
  }

  async function refreshAll() {
    const [
      l,
      s,
      d,
      th,
      e,
      t,
      sp,
      cfg,
      prof,
      bal,
      allow,
      lOps,
      lAllow,
      tCaps,
      sMatches,
      sBackups,
    ] = await Promise.all([
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
      supabase
        .from("league_operators")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("league_allowed_users")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("team_captains")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("season_matches")
        .select("*")
        .order("round_number", { ascending: true }),
      supabase
        .from("season_config_backups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60),
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
    if (!lOps.error && lOps.data) setLeagueOperators(lOps.data);
    if (!lAllow.error && lAllow.data) setLeagueAllowedUsers(lAllow.data);
    if (!tCaps.error && tCaps.data) setTeamCaptains(tCaps.data);
    if (!sMatches.error && sMatches.data) setSeasonMatches(sMatches.data);
    if (!sBackups.error && sBackups.data) setSeasonBackups(sBackups.data);
    router.refresh();
  }

  async function handleAddTeamCaptain(teamId: string, discordId: string) {
    const trimmed = discordId.trim();
    if (!trimmed) return;
    setBusy(true);
    const matchedProfile = profiles.find((p) => p.discord_id === trimmed);
    const { error } = await supabase.from("team_captains").upsert(
      {
        team_id: teamId,
        discord_id: trimmed,
        label: matchedProfile?.username || null,
        added_by: currentUserId,
      },
      { onConflict: "team_id,discord_id" }
    );
    if (error) {
      setStatusMsg(
        error.message.includes("relation")
          ? "Error: Run migration 038_schedule_captains_tournaments.sql first."
          : `Error: ${error.message}`
      );
    } else {
      setNewCaptainDiscordByTeam((prev) => ({ ...prev, [teamId]: "" }));
      setStatusMsg(`Added team captain ${trimmed}.`);
      await refreshAll();
    }
    setBusy(false);
  }

  async function handleRemoveTeamCaptain(captainId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("team_captains")
      .delete()
      .eq("id", captainId);
    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setStatusMsg("Removed team captain.");
      await refreshAll();
    }
    setBusy(false);
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
      revalidateStatsCache({ scope: "settings" });
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
    if (!error) revalidateStatsCache({ scope: "settings" });
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
      .upload(path, file, { upsert: true, cacheControl: "31536000" });

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

  function revalidateStatsCache(opts?: {
    seasonId?: string | null;
    scope?: "settings" | "content";
  }) {
    const payload: Record<string, string> = {};
    if (opts?.scope) {
      payload.scope = opts.scope;
    } else {
      const targetSeasonId = opts?.seasonId ?? selectedSeasonId;
      if (targetSeasonId) payload.seasonId = targetSeasonId;
    }
    fetch("/api/admin/revalidate-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
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
    if (!error) revalidateStatsCache();
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
      .upload(path, file, { upsert: true, cacheControl: "31536000" });

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
      revalidateStatsCache();
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
    const basePayload: Record<string, unknown> = {
      name: season.name.trim(),
      slug: slugify(season.name),
      is_active: season.is_active,
      stats_provider: season.stats_provider ?? "google_sheet",
      stats_sheet_id: season.stats_sheet_id?.trim() || null,
      stats_sheet_gids:
        season.stats_sheet_gids && season.stats_sheet_gids.length > 0
          ? season.stats_sheet_gids.map((g) => g.trim()).filter(Boolean)
          : null,
      stats_playoff_gids:
        season.stats_playoff_gids && season.stats_playoff_gids.length > 0
          ? season.stats_playoff_gids.map((g) => g.trim()).filter(Boolean)
          : null,
      stats_schedule_gid: season.stats_schedule_gid?.trim() || null,
      regular_season_rounds:
        typeof season.regular_season_rounds === "number" &&
        Number.isFinite(season.regular_season_rounds) &&
        season.regular_season_rounds > 0
          ? Math.floor(season.regular_season_rounds)
          : null,
      stats_round_label: season.stats_round_label?.trim() || null,
      stats_credits_label: season.stats_credits_label?.trim() || null,
      stats_credits_url: season.stats_credits_url?.trim() || null,
      stats_credits_attribution:
        season.stats_credits_attribution?.trim() || null,
    };
    const fullPayload: Record<string, unknown> = {
      ...basePayload,
      roster_type: season.roster_type ?? "draft",
      season_structure: season.season_structure ?? "regular_playoffs",
      default_best_of:
        typeof season.default_best_of === "number" &&
        [1, 3, 5].includes(season.default_best_of)
          ? season.default_best_of
          : 1,
    };
    let { error } = await supabase
      .from("seasons")
      .update(fullPayload)
      .eq("id", season.id);
    if (error && error.message.includes("column")) {
      const midFallback = await supabase
        .from("seasons")
        .update(basePayload)
        .eq("id", season.id);
      error = midFallback.error;
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
    }
    setStatusMsg(error ? `Error: ${error.message}` : `Saved ${season.name}.`);
    if (!error) revalidateStatsCache();
    await refreshAll();
    setBusy(false);
  }

  async function handleSavePlayoffBracket(
    season: Season,
    divisionId: string,
    divisionName: string,
    bracket: DivisionPlayoffBracket | null
  ) {
    setBusy(true);
    const nextBrackets: SeasonPlayoffBrackets = {
      ...(season.playoff_brackets ?? {}),
    };
    if (bracket) {
      nextBrackets[divisionId] = bracket;
    } else {
      delete nextBrackets[divisionId];
    }
    const payload =
      Object.keys(nextBrackets).length > 0 ? nextBrackets : null;

    const { error } = await supabase
      .from("seasons")
      .update({ playoff_brackets: payload })
      .eq("id", season.id);

    if (error) {
      if (
        error.message.includes("playoff_brackets") ||
        error.message.includes("column")
      ) {
        setStatusMsg(
          "Error: playoff_brackets column missing — run migration 034_season_playoff_brackets.sql in Supabase first."
        );
      } else {
        setStatusMsg(`Error saving playoff bracket: ${error.message}`);
      }
      setBusy(false);
      return;
    }

    setSeasons((prev) =>
      prev.map((item) =>
        item.id === season.id ? { ...item, playoff_brackets: payload } : item
      )
    );
    setStatusMsg(
      bracket
        ? `Saved ${bracket.format} playoff bracket for ${divisionName} (${season.name}).`
        : `Cleared playoff bracket for ${divisionName} (${season.name}).`
    );
    revalidateStatsCache();
    await refreshAll();
    setBusy(false);
  }


  async function handleToggleSeasonActive(season: Season) {
    setBusy(true);
    await supabase
      .from("seasons")
      .update({ is_active: !season.is_active })
      .eq("id", season.id);
    revalidateStatsCache();
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
      revalidateStatsCache();
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
    if (!error) revalidateStatsCache();
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
      .upload(path, file, { upsert: true, cacheControl: "31536000" });

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
    if (!error) revalidateStatsCache({ scope: "settings" });
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
      .upload(path, file, { upsert: true, cacheControl: "31536000" });

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
      revalidateStatsCache({ scope: "settings" });
      await refreshAll();
    } else {
      setStatusMsg(`Error: ${error.message}`);
    }
    setBusy(false);
  }

  async function handleDeleteTheme(theme: DivisionTheme) {
    if (!confirm(`Delete theme "${theme.name}"?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("division_themes")
      .delete()
      .eq("key", theme.key);
    setStatusMsg(error ? `Error: ${error.message}` : "Theme deleted.");
    if (!error) revalidateStatsCache({ scope: "settings" });
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
    if (!error) revalidateStatsCache({ scope: "settings" });
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
    if (!error) revalidateStatsCache({ scope: "settings" });
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
    if (!error) revalidateStatsCache({ scope: "settings" });
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
    const res = await deleteAdminRanking(supabase, ballot);
    setStatusMsg(res.statusMessage);
    if (res.ok) await refreshAll();
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
    setCheckingConflict(true);
    const conflict = await findTargetEditionConflict(
      supabase,
      ballot,
      nextEditionId
    );
    setConflictBallot(conflict);
    setCheckingConflict(false);
  }

  function getEligibleTargetEditions(ballot: AdminPublishedBallot) {
    return computeEligibleTargetEditions(ballot, editions);
  }

  async function openMoveEditionModal(ballot: AdminPublishedBallot) {
    const seasonEds = getEligibleTargetEditions(ballot);
    const firstTarget = seasonEds[0];
    setMovingBallot(ballot);
    setTargetEditionId(firstTarget?.id ?? "");
    setMoveTitle(buildMovedRankingTitle(ballot, firstTarget));
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
    setMoveTitle(buildMovedRankingTitle(movingBallot, nextEd));
    await checkTargetEditionConflict(movingBallot, nextEditionId);
  }

  async function handleConfirmMoveEdition() {
    if (!movingBallot || !targetEditionId) return;
    const targetEd = editions.find((e) => e.id === targetEditionId);
    if (!targetEd) return;

    setBusy(true);
    try {
      const res = await executeMoveRankingEdition(supabase, {
        movingRanking: movingBallot,
        targetEdition: targetEd,
        moveTitle,
        conflictRanking: conflictBallot,
        confirmOverwrite: confirmOverwriteChecked,
      });
      if (res.statusMessage) setStatusMsg(res.statusMessage);
      if (res.ok) {
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
    if (!error) revalidateStatsCache({ scope: "settings" });
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
    if (!error) revalidateStatsCache({ seasonId: season.id });
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
    if (!error) revalidateStatsCache({ seasonId: division.season_id });
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
    if (!error) revalidateStatsCache();
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


  const selectedSeason =
    seasons.find((s) => s.id === selectedSeasonId) ?? null;
  const selectedSeasonLeague =
    leagues.find((l) => l.id === selectedSeason?.league_id) ?? null;
  const isSelectedLeagueScdl = selectedSeasonLeague?.slug === "scdl";
  const visibleThemes = useMemo(
    () =>
      isSelectedLeagueScdl
        ? themes
        : themes.filter((t) => t.key !== "baron" && t.key !== "dragon"),
    [themes, isSelectedLeagueScdl]
  );
  useEffect(() => {
    if (visibleThemes.length === 0) {
      if (newDivTheme !== "") setNewDivTheme("");
    } else if (!visibleThemes.some((t) => t.key === newDivTheme)) {
      setNewDivTheme(visibleThemes[0].key);
    }
  }, [visibleThemes, newDivTheme]);
  const isSelectedSeasonDraft =
    (selectedSeason?.roster_type ?? "draft") === "draft";
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
      {isSiteAdmin && (
        <div className="mb-3 px-2.5 py-2 rounded bg-black/30 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[#f0c020] font-bold">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Preview As Role</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={previewRole}
              onChange={(e) =>
                setPreviewRole(
                  e.target.value as "operator" | "captain" | "public"
                )
              }
              className="xp-inset px-2 py-1 text-xs"
            >
              <option value="operator">League Operator</option>
              <option value="captain">Team Captain</option>
              <option value="public">Regular User</option>
            </select>
            {previewRole === "operator" && (
              <select
                value={previewLeagueId}
                onChange={(e) => setPreviewLeagueId(e.target.value)}
                className="xp-inset px-2 py-1 text-xs"
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.short_name ? `${l.short_name} — ${l.name}` : l.name}
                  </option>
                ))}
              </select>
            )}
            {previewRole === "captain" && (
              <select
                value={previewTeamId}
                onChange={(e) => setPreviewTeamId(e.target.value)}
                className="xp-inset px-2 py-1 text-xs max-w-[240px]"
              >
                {teams.map((t) => {
                  const div = divisions.find((d) => d.id === t.division_id);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {div ? ` (${div.name})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
            <button
              type="button"
              disabled={previewBusy}
              onClick={() => void handleStartViewAs()}
              className="xp-btn xp-btn-primary text-xs px-2.5 py-1"
            >
              {previewBusy ? "Starting..." : "Start Preview"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4 pb-2 border-b border-white/10">
        {(
          [
            ["seasons", "Seasons"],
            ["divisions", "Divisions"],
            ["editions", "Content Editions"],
            ["players", "Draft Player Pool"],
            ["teams", "Teams"],
            ["schedule", "Schedule & Playoffs"],
            ["moderation", isSiteAdmin ? "Moderation & Safety" : "League Access & Safety"],
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
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <Link
            href="/team-hub"
            className="xp-btn text-xs border-[#7cd438]/60 text-[#7cd438]"
          >
            <span>Team Hub (preview)</span>
          </Link>
          <Link
            href="/admin/stats"
            className="xp-btn text-xs border-[#c89b3c]/70 text-[#f0c020]"
          >
            <span>Stats Controls</span>
          </Link>
        </div>
      </div>

      {(tab === "divisions" ||
        tab === "editions" ||
        tab === "teams" ||
        tab === "schedule" ||
        tab === "players") && (
        <div className="xp-panel p-3 mb-4 flex flex-wrap items-end gap-3">
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

          {(tab === "teams" || tab === "schedule") && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#a6a89e]">
                Division
              </label>
              {seasonDivisions.length === 0 ? (
                <div className="mt-0.5 text-xs text-[#a6a89e] py-1">
                  No divisions in this season
                </div>
              ) : (
                <select
                  value={selectedDivisionId}
                  onChange={(e) => setSelectedDivisionId(e.target.value)}
                  className="xp-inset px-2 py-1 text-xs font-bold mt-0.5"
                >
                  {seasonDivisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {tab === "players" && (
            <div className="sm:ml-auto">
              <button
                type="button"
                disabled={
                  busy ||
                  !isSelectedSeasonDraft ||
                  filteredSeasonPlayers.length === 0
                }
                onClick={() => void handleStripPlayerTaglines()}
                className="xp-btn xp-btn-danger text-xs"
                title="Remove #tagline suffixes (e.g. #NA1) from all players in this season's draft pool"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Strip #Taglines</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: TEAMS */}
      {tab === "teams" && (
        <AdminTeamsTab
          busy={busy}
          selectedDivisionId={selectedDivisionId}
          filteredTeams={filteredTeams}
          setTeams={setTeams}
          teamCaptains={teamCaptains}
          profiles={profiles}
          newCaptainDiscordByTeam={newCaptainDiscordByTeam}
          setNewCaptainDiscordByTeam={setNewCaptainDiscordByTeam}
          newTeamName={newTeamName}
          setNewTeamName={setNewTeamName}
          onAddTeam={handleAddTeam}
          onSaveTeam={handleSaveTeam}
          onDeleteTeam={handleDeleteTeam}
          onLogoUpload={handleLogoUpload}
          onOpenAltModal={(payload) => {
            setAltInput("");
            setAltModal(payload);
          }}
          onAddTeamCaptain={handleAddTeamCaptain}
          onRemoveTeamCaptain={handleRemoveTeamCaptain}
          onRevalidate={() => revalidateStatsCache({ seasonId: selectedSeasonId })}
          onRefresh={refreshAll}
          onStatusMsg={(msg) => setStatusMsg(msg)}
        />
      )}

      {/* TAB: SCHEDULE & PLAYOFFS */}
      {tab === "schedule" && selectedSeason && (
        <div className="space-y-4">
          <AdminSchedulePlayoffsTab
            season={selectedSeason}
            divisions={seasonDivisions}
            selectedDivId={selectedDivisionId}
            teams={teams}
            matches={seasonMatches}
            backups={seasonBackups}
            currentUserId={currentUserId}
            busy={busy}
            onSavePlayoffBracket={handleSavePlayoffBracket}
            onRevalidate={() => revalidateStatsCache({ seasonId: selectedSeasonId })}
            onRefresh={refreshAll}
            onStatusMsg={(msg) => setStatusMsg(msg)}
          />
          <MatchStatsUploader
            season={selectedSeason}
            teams={teams}
            busy={busy}
            onRefresh={refreshAll}
            onStatusMsg={(msg) => setStatusMsg(msg)}
          />
        </div>
      )}

      {/* TAB: DRAFT PLAYER POOL */}
      {tab === "players" && (
        <AdminPlayersTab
          busy={busy}
          selectedSeasonId={selectedSeasonId}
          isDraftLeague={isSelectedSeasonDraft}
          filteredSeasonPlayers={filteredSeasonPlayers}
          bulkPasteByRole={bulkPasteByRole}
          setBulkPasteByRole={setBulkPasteByRole}
          onClearRolePlayers={(role, roleLabel) =>
            void handleClearRolePlayers(role, roleLabel)
          }
          onDeleteSeasonPlayer={(pl) => void handleDeleteSeasonPlayer(pl)}
          onBulkAddRolePlayers={(role) => void handleBulkAddRolePlayers(role)}
        />
      )}

      {/* TAB 2: SETUP SEASONS (Leagues & Seasons) */}
      {tab === "seasons" && (
        <AdminSeasonsTab
          busy={busy}
          isSiteAdmin={isSiteAdmin}
          leagues={leagues}
          setLeagues={setLeagues}
          seasons={seasons}
          setSeasons={setSeasons}
          newLeagueName={newLeagueName}
          setNewLeagueName={setNewLeagueName}
          newLeagueShortName={newLeagueShortName}
          setNewLeagueShortName={setNewLeagueShortName}
          newSeasonLeagueId={newSeasonLeagueId}
          setNewSeasonLeagueId={setNewSeasonLeagueId}
          newSeasonName={newSeasonName}
          setNewSeasonName={setNewSeasonName}
          onAddLeague={handleAddLeague}
          onSaveLeague={handleSaveLeague}
          onDeleteLeague={handleDeleteLeague}
          onLeagueLogoUpload={handleLeagueLogoUpload}
          onAddSeason={handleAddSeason}
          onSaveSeason={handleSaveSeason}
          onToggleSeasonActive={handleToggleSeasonActive}
          onDeleteSeason={handleDeleteSeason}
        />
      )}

      {/* TAB: DIVISIONS OR CONTENT EDITIONS */}
      {(tab === "divisions" || tab === "editions") && (
        <AdminDivisionsEditionsTab
          mode={tab === "divisions" ? "divisions" : "editions"}
          busy={busy}
          seasonDivisions={seasonDivisions}
          setDivisions={setDivisions}
          filteredEditions={filteredEditions}
          setEditions={setEditions}
          themes={visibleThemes}
          setThemes={setThemes}
          newDivName={newDivName}
          setNewDivName={setNewDivName}
          newDivTheme={newDivTheme}
          setNewDivTheme={setNewDivTheme}
          newEditionName={newEditionName}
          setNewEditionName={setNewEditionName}
          newEditionPlayersOnly={newEditionPlayersOnly}
          setNewEditionPlayersOnly={setNewEditionPlayersOnly}
          newThemeName={newThemeName}
          setNewThemeName={setNewThemeName}
          newThemePrimary={newThemePrimary}
          setNewThemePrimary={setNewThemePrimary}
          newThemeSecondary={newThemeSecondary}
          setNewThemeSecondary={setNewThemeSecondary}
          newThemeText={newThemeText}
          setNewThemeText={setNewThemeText}
          onAddDivision={handleAddDivision}
          onSaveDivision={handleSaveDivision}
          onDeleteDivision={handleDeleteDivision}
          onDivisionLogoUpload={handleDivisionLogoUpload}
          onAddEdition={handleAddEdition}
          onSaveEdition={handleSaveEdition}
          onDeleteEdition={handleDeleteEdition}
          onMoveEdition={handleMoveEdition}
          onToggleEditionPlayersOnly={(ed) =>
            void handleToggleEditionPlayersOnly(ed)
          }
          onToggleEditionOpen={handleToggleEditionOpen}
          onToggleEditionArchived={handleToggleEditionArchived}
          onSaveTheme={handleSaveTheme}
          onDeleteTheme={handleDeleteTheme}
          onThemeLogoUpload={handleThemeLogoUpload}
          onAddTheme={handleAddTheme}
        />
      )}

      {/* TAB 4: MODERATION & SAFETY */}
      {tab === "moderation" && (
        <AdminModerationTab
          busy={busy}
          isSiteAdmin={isSiteAdmin}
          currentUserId={currentUserId}
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          leagues={leagues}
          profiles={profiles}
          publishedBallots={publishedBallots}
          allowedUsers={allowedUsers}
          allowedIdSet={allowedIdSet}
          leagueOperators={leagueOperators}
          leagueAllowedUsers={leagueAllowedUsers}
          existingBlogIds={existingBlogIds}
          moderationRules={moderationRules}
          moderationRulesError={moderationRulesError}
          moderationEvents={moderationEvents}
          moderationLoading={moderationLoading}
          moderationError={moderationError}
          newAllowedDiscordId={newAllowedDiscordId}
          setNewAllowedDiscordId={setNewAllowedDiscordId}
          newAllowedLabel={newAllowedLabel}
          setNewAllowedLabel={setNewAllowedLabel}
          showAllowlist={showAllowlist}
          setShowAllowlist={setShowAllowlist}
          allowlistSearch={allowlistSearch}
          setAllowlistSearch={setAllowlistSearch}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          newRuleType={newRuleType}
          setNewRuleType={setNewRuleType}
          newRuleTerm={newRuleTerm}
          setNewRuleTerm={setNewRuleTerm}
          onToggleKillSwitch={handleToggleKillSwitch}
          onSaveMaintenanceMessage={handleSaveMaintenanceMessage}
          onToggleAllowlistMode={handleToggleAllowlistMode}
          onAddAllowedUser={handleAddAllowedUser}
          onRemoveAllowedUser={handleRemoveAllowedUser}
          onOpenMoveEditionModal={(b) => void openMoveEditionModal(b)}
          onDeleteBallot={(b) => void handleAdminDeleteBallot(b)}
          onToggleBanUser={handleToggleBanUser}
          onRefresh={refreshAll}
          onStatusMsg={(msg) => setStatusMsg(msg)}
          onAddModerationRule={handleAddModerationRule}
          onDeleteModerationRule={(id) => void handleDeleteModerationRule(id)}
          onLoadModerationEvents={() => void loadModerationEvents()}
          onToggleModerationResolved={(id, resolved) =>
            void handleToggleModerationResolved(id, resolved)
          }
          onDeleteModerationEvent={(id, label) =>
            void handleDeleteModerationEvent(id, label)
          }
          onModerateContent={(ev, action) =>
            void handleModerateAlertContent(ev, action)
          }
        />
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

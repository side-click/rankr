import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export const VIEW_AS_COOKIE_NAME = "rankr_view_as";

export type ViewAsState =
  | { mode: "operator"; leagueId: string; label?: string }
  | { mode: "captain"; teamId: string; label?: string }
  | { mode: "public"; label?: string };

export interface ServerAuthContext {
  user: {
    id: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  profile: {
    username: string;
    avatar_url: string | null;
    is_admin: boolean;
    is_banned?: boolean;
    discord_id?: string | null;
  } | null;
  discordId: string | null;
  isAdmin: boolean;
  realIsAdmin: boolean;
  viewAs: ViewAsState | null;
  isBanned: boolean;
  operatorLeagueIds: string[];
  captainTeamIds: string[];
  isOperator: boolean;
  hasMatchHubAccess: boolean;
}

function parseViewAsCookie(raw: string | undefined): ViewAsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const label =
      typeof parsed.label === "string" && parsed.label.trim()
        ? parsed.label.trim().slice(0, 80)
        : undefined;
    if (
      parsed.mode === "operator" &&
      typeof parsed.leagueId === "string" &&
      parsed.leagueId.trim()
    ) {
      return { mode: "operator", leagueId: parsed.leagueId.trim(), label };
    }
    if (
      parsed.mode === "captain" &&
      typeof parsed.teamId === "string" &&
      parsed.teamId.trim()
    ) {
      return { mode: "captain", teamId: parsed.teamId.trim(), label };
    }
    if (parsed.mode === "public") {
      return { mode: "public", label: label ?? "Regular User" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches server auth context once per request via React.cache().
 * Captain assignments (`team_captains`) are intentionally deferred to `getCaptainTeamIds()`
 * so unrelated pages don't issue an extra Supabase query on every logged-in visit.
 */
export const getServerAuthContext = cache(async (): Promise<ServerAuthContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      discordId: null,
      isAdmin: false,
      realIsAdmin: false,
      viewAs: null,
      isBanned: false,
      operatorLeagueIds: [],
      captainTeamIds: [],
      isOperator: false,
      hasMatchHubAccess: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, is_admin, is_banned, discord_id")
    .eq("id", user.id)
    .maybeSingle();

  const realIsAdmin = Boolean(profile?.is_admin);
  const isBanned = Boolean(profile?.is_banned);
  const discordId = profile?.discord_id ?? null;

  const cookieStore = await cookies();
  const viewAs = realIsAdmin
    ? parseViewAsCookie(cookieStore.get(VIEW_AS_COOKIE_NAME)?.value)
    : null;

  if (viewAs) {
    if (viewAs.mode === "operator") {
      return {
        user: {
          id: user.id,
          user_metadata: user.user_metadata as Record<string, unknown> | undefined,
        },
        profile: profile ?? null,
        discordId,
        isAdmin: false,
        realIsAdmin: true,
        viewAs,
        isBanned,
        operatorLeagueIds: [viewAs.leagueId],
        captainTeamIds: [],
        isOperator: true,
        hasMatchHubAccess: true,
      };
    }
    if (viewAs.mode === "captain") {
      return {
        user: {
          id: user.id,
          user_metadata: user.user_metadata as Record<string, unknown> | undefined,
        },
        profile: profile ?? null,
        discordId,
        isAdmin: false,
        realIsAdmin: true,
        viewAs,
        isBanned,
        operatorLeagueIds: [],
        captainTeamIds: [viewAs.teamId],
        isOperator: false,
        hasMatchHubAccess: true,
      };
    }
    return {
      user: {
        id: user.id,
        user_metadata: user.user_metadata as Record<string, unknown> | undefined,
      },
      profile: profile ?? null,
      discordId,
      isAdmin: false,
      realIsAdmin: true,
      viewAs,
      isBanned,
      operatorLeagueIds: [],
      captainTeamIds: [],
      isOperator: false,
      hasMatchHubAccess: false,
    };
  }

  const isAdmin = realIsAdmin;
  let operatorLeagueIds: string[] = [];
  if (discordId) {
    const opRes = await supabase
      .from("league_operators")
      .select("league_id")
      .eq("discord_id", discordId);
    if (!opRes.error && Array.isArray(opRes.data)) {
      operatorLeagueIds = opRes.data
        .map((r) => String(r.league_id ?? ""))
        .filter(Boolean);
    }
  }

  const isOperator = isAdmin || operatorLeagueIds.length > 0;

  return {
    user: {
      id: user.id,
      user_metadata: user.user_metadata as Record<string, unknown> | undefined,
    },
    profile: profile ?? null,
    discordId,
    isAdmin,
    realIsAdmin,
    viewAs: null,
    isBanned,
    operatorLeagueIds,
    captainTeamIds: [],
    isOperator,
    hasMatchHubAccess: isOperator,
  };
});

/**
 * Opt-in helper for routes that actually inspect team captain permissions (`/matches`, tournament codes).
 */
export async function getCaptainTeamIds(
  supabase: SupabaseClient,
  discordId: string | null,
  auth?: ServerAuthContext
): Promise<string[]> {
  if (auth?.viewAs) {
    return auth.viewAs.mode === "captain" ? [auth.viewAs.teamId] : [];
  }
  if (!discordId) return [];
  const { data, error } = await supabase
    .from("team_captains")
    .select("team_id")
    .eq("discord_id", discordId);
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => String(r.team_id ?? "")).filter(Boolean);
}

/**
 * Verifies site admin OR league-scoped operator access for a specific seasonId.
 */
export async function assertSeasonOperatorAccess(
  auth: ServerAuthContext,
  supabase: SupabaseClient,
  seasonId: string | null | undefined
): Promise<
  | { ok: true; season: { id: string; slug: string; league_id: string } }
  | { ok: false; status: 400 | 403 | 404; error: string }
> {
  const cleanSeasonId = String(seasonId ?? "").trim();
  if (!cleanSeasonId) {
    return { ok: false, status: 400, error: "seasonId is required." };
  }

  const { data: season } = await supabase
    .from("seasons")
    .select("id, slug, league_id")
    .eq("id", cleanSeasonId)
    .maybeSingle();

  if (!season) {
    return { ok: false, status: 404, error: "Season not found." };
  }

  if (
    !auth.isAdmin &&
    !auth.operatorLeagueIds.includes(String(season.league_id))
  ) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden for this league.",
    };
  }

  return {
    ok: true,
    season: {
      id: String(season.id),
      slug: String(season.slug),
      league_id: String(season.league_id),
    },
  };
}

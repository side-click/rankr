import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

export interface ServerAuthContext {
  user: {
    id: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  profile: {
    username: string;
    avatar_url: string | null;
    is_admin: boolean;
    discord_id?: string | null;
  } | null;
  discordId: string | null;
  isAdmin: boolean;
  operatorLeagueIds: string[];
  captainTeamIds: string[];
  isOperator: boolean;
  hasMatchHubAccess: boolean;
}

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
      operatorLeagueIds: [],
      captainTeamIds: [],
      isOperator: false,
      hasMatchHubAccess: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, is_admin, discord_id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = Boolean(profile?.is_admin);
  const discordId = profile?.discord_id ?? null;

  let operatorLeagueIds: string[] = [];
  let captainTeamIds: string[] = [];

  if (discordId) {
    const [opRes, capRes] = await Promise.all([
      supabase
        .from("league_operators")
        .select("league_id")
        .eq("discord_id", discordId),
      supabase
        .from("team_captains")
        .select("team_id")
        .eq("discord_id", discordId),
    ]);
    if (!opRes.error && Array.isArray(opRes.data)) {
      operatorLeagueIds = opRes.data
        .map((r) => String(r.league_id ?? ""))
        .filter(Boolean);
    }
    if (!capRes.error && Array.isArray(capRes.data)) {
      captainTeamIds = capRes.data
        .map((r) => String(r.team_id ?? ""))
        .filter(Boolean);
    }
  }

  const isOperator = isAdmin || operatorLeagueIds.length > 0;
  const hasMatchHubAccess =
    isAdmin || operatorLeagueIds.length > 0 || captainTeamIds.length > 0;

  return {
    user: {
      id: user.id,
      user_metadata: user.user_metadata as Record<string, unknown> | undefined,
    },
    profile: profile ?? null,
    discordId,
    isAdmin,
    operatorLeagueIds,
    captainTeamIds,
    isOperator,
    hasMatchHubAccess,
  };
});

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether the currently authenticated user is permitted to author/edit
 * untagged global content (e.g. untagged blogs) under global allowlist settings.
 * Fails closed on database/RPC errors.
 */
export async function checkUserAllowlisted(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_allowlisted");
  if (error) {
    return false;
  }
  return data === true;
}

/**
 * Checks whether the currently authenticated user can author/edit content
 * for a specific league (or global untagged content when `leagueId` is null).
 * Fails closed on database/RPC errors.
 */
export async function checkUserAllowlistedForLeague(
  supabase: SupabaseClient,
  leagueId: string | null | undefined
): Promise<boolean> {
  if (!leagueId) {
    return checkUserAllowlisted(supabase);
  }
  const { data, error } = await supabase.rpc("is_allowlisted_for_league", {
    target_league_id: leagueId,
  });
  if (error) {
    return false;
  }
  return data === true;
}

export interface CreatorAccessSummary {
  canCreateUntaggedBlog: boolean;
  /** null means unrestricted across all leagues (e.g. Site Admin) */
  allowedLeagueIds: string[] | null;
}

export async function getCreatorAccessSummary(
  supabase: SupabaseClient,
  isAdmin: boolean,
  discordId: string | null,
  operatorLeagueIds: string[],
  leagues: { id: string; require_allowlist?: boolean | null }[]
): Promise<CreatorAccessSummary> {
  const canCreateUntaggedBlog = isAdmin
    ? true
    : await checkUserAllowlisted(supabase);

  if (isAdmin) {
    return { canCreateUntaggedBlog: true, allowedLeagueIds: null };
  }

  let leagueAllowedSet = new Set<string>();
  if (discordId) {
    const { data, error } = await supabase
      .from("league_allowed_users")
      .select("league_id")
      .eq("discord_id", discordId);
    if (!error && Array.isArray(data)) {
      leagueAllowedSet = new Set(
        data.map((r) => String(r.league_id ?? "")).filter(Boolean)
      );
    }
  }

  const operatorSet = new Set(operatorLeagueIds);
  const allowedLeagueIds = leagues
    .filter((l) => {
      if (operatorSet.has(l.id)) return true;
      if (!l.require_allowlist) return true;
      return leagueAllowedSet.has(l.id);
    })
    .map((l) => l.id);

  return { canCreateUntaggedBlog, allowedLeagueIds };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicProfileSummary {
  id: string;
  username: string;
  avatar_url: string | null;
}

/**
 * Fetches safe public profile fields (`id, username, avatar_url`) via `public_profiles`
 * with automatic fallback to `profiles` if migration 039 has not yet been applied.
 */
export async function fetchPublicProfilesMap(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[]
): Promise<Map<string, PublicProfileSummary>> {
  const uniqueIds = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id && id.trim())))
  );
  const map = new Map<string, PublicProfileSummary>();
  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_url")
    .in("id", uniqueIds);

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      map.set(String(row.id), {
        id: String(row.id),
        username: String(row.username ?? "Discord User"),
        avatar_url: (row.avatar_url as string | null) ?? null,
      });
    }
    return map;
  }

  // Graceful fallback before SQL migration 039 creates the public_profiles view
  if (error && (error.code === "42P01" || error.code === "PGRST205")) {
    const fallback = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", uniqueIds);
    for (const row of fallback.data ?? []) {
      map.set(String(row.id), {
        id: String(row.id),
        username: String(row.username ?? "Discord User"),
        avatar_url: (row.avatar_url as string | null) ?? null,
      });
    }
  }

  return map;
}

export async function attachPublicProfiles<
  T extends { user_id?: string | null; profiles?: unknown },
>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<(T & { profiles: { username: string; avatar_url: string | null } | null })[]> {
  if (rows.length === 0) return [];
  const profileMap = await fetchPublicProfilesMap(
    supabase,
    rows.map((r) => r.user_id)
  );
  return rows.map((row) => {
    const prof = row.user_id ? profileMap.get(row.user_id) : undefined;
    return {
      ...row,
      profiles: prof
        ? { username: prof.username, avatar_url: prof.avatar_url }
        : null,
    };
  });
}

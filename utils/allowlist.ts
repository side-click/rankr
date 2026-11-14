import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether the currently authenticated user is permitted to author/edit
 * rankings under the active Discord allowlist settings.
 */
export async function checkUserAllowlisted(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_allowlisted");
  if (error) {
    return true;
  }
  return data !== false;
}

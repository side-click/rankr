import { cookies } from "next/headers";

export const FOCUSED_SEASON_COOKIE = "rankr_focused_season";
export const UNFOCUSED_SENTINEL = "__all__";

export async function getFocusedSeasonSlug(
  explicitSeason?: string
): Promise<string | undefined> {
  if (explicitSeason !== undefined) {
    const trimmed = explicitSeason.trim();
    if (!trimmed || trimmed === "all" || trimmed === UNFOCUSED_SENTINEL) {
      return undefined;
    }
    return trimmed;
  }
  const store = await cookies();
  const fromCookie = store.get(FOCUSED_SEASON_COOKIE)?.value?.trim();
  if (!fromCookie || fromCookie === UNFOCUSED_SENTINEL || fromCookie === "all") {
    return undefined;
  }
  return fromCookie;
}

export async function getHomeFocusPreference(
  explicitSeason?: string
): Promise<string | undefined> {
  if (explicitSeason !== undefined) {
    const trimmed = explicitSeason.trim();
    if (!trimmed || trimmed === "all" || trimmed === UNFOCUSED_SENTINEL) {
      return UNFOCUSED_SENTINEL;
    }
    return trimmed;
  }
  const store = await cookies();
  const fromCookie = store.get(FOCUSED_SEASON_COOKIE)?.value?.trim();
  return fromCookie || undefined;
}

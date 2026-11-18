import { cookies } from "next/headers";

export const FOCUSED_SEASON_COOKIE = "rankr_focused_season";

export async function getFocusedSeasonSlug(
  explicitSeason?: string
): Promise<string | undefined> {
  if (explicitSeason !== undefined) {
    const trimmed = explicitSeason.trim();
    return trimmed || undefined;
  }
  const store = await cookies();
  const fromCookie = store.get(FOCUSED_SEASON_COOKIE)?.value?.trim();
  return fromCookie || undefined;
}

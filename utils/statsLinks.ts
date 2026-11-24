/**
 * Builds consistent Stats Dashboard & detail-page hrefs that preserve `?season=`
 * and optional `?division=` across overview, scouting, series, and champion views.
 */
export function buildSeasonQuery(
  seasonSlug?: string | null,
  extra?: Record<string, string | null | undefined>
): string {
  const params = new URLSearchParams();
  const cleanSeason = seasonSlug?.trim();
  if (cleanSeason) params.set("season", cleanSeason);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const clean = v?.trim();
      if (clean) params.set(k, clean);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function statsHref(
  basePath = "/stats",
  seasonSlug?: string | null,
  extra?: Record<string, string | null | undefined>
): string {
  return `${basePath}${buildSeasonQuery(seasonSlug, extra)}`;
}

export function teamStatsHref(
  teamId: string,
  basePath = "/stats",
  seasonSlug?: string | null
): string {
  return `${basePath}/team/${encodeURIComponent(teamId)}${buildSeasonQuery(
    seasonSlug
  )}`;
}

export function playerStatsHref(
  playerKey: string,
  basePath = "/stats",
  seasonSlug?: string | null
): string {
  return `${basePath}/player/${encodeURIComponent(
    playerKey
  )}${buildSeasonQuery(seasonSlug)}`;
}

export function championStatsHref(
  championName: string,
  _basePath = "/stats",
  seasonSlug?: string | null,
  divisionSlug?: string | null
): string {
  // Champion detail pages live exclusively under `/stats/champion/[name]`
  return `/stats/champion/${encodeURIComponent(
    championName
  )}${buildSeasonQuery(seasonSlug, { division: divisionSlug })}`;
}

export function matchStatsHref(
  seriesKey: string,
  basePath = "/stats",
  seasonSlug?: string | null
): string {
  return `${basePath}/match/${encodeURIComponent(seriesKey)}${buildSeasonQuery(
    seasonSlug
  )}`;
}

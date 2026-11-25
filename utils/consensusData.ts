import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/utils/supabase/server";
import { attachPublicProfiles } from "@/utils/publicProfiles";
import {
  attachConsensusChanges,
  computeAverageTeamRankings,
  type AverageTeamRow,
  type ConsensusRankingInput,
} from "@/utils/averageRankings";
import { resolveDivisionTheme } from "@/utils/themes";
import type { DivisionTheme } from "@/types/database";

function unwrap<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export interface ConsensusDataResult {
  seasons: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    leagueName: string;
    leagueShortName: string;
    leagueLogoUrl: string | null;
  }[];
  divisions: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    accentColor: string;
    primaryColor: string;
    themeKey: string;
  }[];
  editions: {
    id: string;
    name: string;
    slug: string;
    isOpen: boolean;
    isArchived: boolean;
    rankingCount: number;
  }[];
  selectedSeasonSlug: string;
  selectedDivisionSlug: string;
  selectedEditionSlug: string;
  leagueName: string;
  leagueLogoUrl: string | null;
  seasonName: string;
  divisionName: string;
  divisionLogoUrl: string | null;
  divisionTheme: DivisionTheme;
  editionName: string;
  submissionCount: number;
  isFallbackOutdated: boolean;
  latestEditionName: string | null;
  latestEditionCount: number;
  rows: AverageTeamRow[];
  contributors: {
    rankingId: string;
    username: string;
    avatarUrl: string | null;
  }[];
}

const fetchConsensusPageData = unstable_cache(
  async (
    season: string,
    division: string,
    edition: string
  ): Promise<ConsensusDataResult> => {
    const params = {
      season: season || undefined,
      division: division || undefined,
      edition: edition || undefined,
    };
    const supabase = createPublicClient();

  const [
    { data: seasons },
    { data: divisions },
    { data: editions },
    { data: themesData },
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("*, leagues ( * )")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("divisions").select("*").order("name"),
    supabase
      .from("editions")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("division_themes").select("*"),
  ]);

  const divisionThemes = (themesData ?? []) as DivisionTheme[];
  const allSeasons = seasons ?? [];
  const allDivisions = divisions ?? [];
  const allEditions = editions ?? [];

  const activeSeasons = allSeasons.filter((s) => s.is_active);
  let defaultActiveSeason = activeSeasons[0] ?? null;
  if (!params.season && activeSeasons.length > 1) {
    const activeIds = activeSeasons.map((s) => s.id);
    const { data: activeRankingRows } = await supabase
      .from("rankings")
      .select("season_id")
      .eq("status", "published")
      .eq("ranking_type", "team")
      .in("season_id", activeIds);
    const countsBySeason = new Map<string, number>();
    for (const row of activeRankingRows ?? []) {
      if (!row.season_id) continue;
      countsBySeason.set(
        row.season_id,
        (countsBySeason.get(row.season_id) ?? 0) + 1
      );
    }
    defaultActiveSeason =
      [...activeSeasons].sort(
        (a, b) =>
          (countsBySeason.get(b.id) ?? 0) - (countsBySeason.get(a.id) ?? 0)
      )[0] ?? defaultActiveSeason;
  }

  const selectedSeason =
    (params.season ? allSeasons.find((s) => s.slug === params.season) : null) ??
    defaultActiveSeason ??
    allSeasons[0] ??
    null;

  const seasonDivisions = selectedSeason
    ? allDivisions.filter((d) => d.season_id === selectedSeason.id)
    : [];

  const selectedDivision =
    (params.division
      ? seasonDivisions.find((d) => d.slug === params.division)
      : null) ??
    seasonDivisions[0] ??
    null;

  const seasonEditionsAsc = selectedSeason
    ? allEditions
        .filter((e) => e.season_id === selectedSeason.id && !e.is_players_only)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.created_at.localeCompare(b.created_at)
        )
    : [];

  const seasonEditionsDesc = [...seasonEditionsAsc].reverse();

  const rankingCountByEditionId = new Map<string, number>();
  if (selectedSeason && selectedDivision) {
    const { data: countRows } = await supabase
      .from("rankings")
      .select("edition_id")
      .eq("status", "published")
      .eq("ranking_type", "team")
      .eq("season_id", selectedSeason.id)
      .eq("division_id", selectedDivision.id);

    for (const row of countRows ?? []) {
      if (!row.edition_id) continue;
      rankingCountByEditionId.set(
        row.edition_id,
        (rankingCountByEditionId.get(row.edition_id) ?? 0) + 1
      );
    }
  }

  const latestOpenEdition =
    seasonEditionsDesc.find((ed) => ed.is_open && !ed.is_archived) ?? null;

  const explicitEdition = params.edition
    ? seasonEditionsDesc.find((ed) => ed.slug === params.edition) ?? null
    : null;

  const mostRecentWithMin2 =
    seasonEditionsDesc.find(
      (ed) => (rankingCountByEditionId.get(ed.id) ?? 0) >= 2
    ) ?? null;

  const selectedEdition =
    explicitEdition ??
    mostRecentWithMin2 ??
    latestOpenEdition ??
    seasonEditionsDesc.find((ed) => !ed.is_archived) ??
    seasonEditionsDesc[0] ??
    null;

  const latestEditionCount = latestOpenEdition
    ? rankingCountByEditionId.get(latestOpenEdition.id) ?? 0
    : 0;

  const isFallbackOutdated = Boolean(
    latestOpenEdition &&
      selectedEdition &&
      selectedEdition.id !== latestOpenEdition.id &&
      latestEditionCount < 2
  );

  const selectedIdx = selectedEdition
    ? seasonEditionsDesc.findIndex((ed) => ed.id === selectedEdition.id)
    : -1;
  const previousEdition =
    selectedIdx >= 0
      ? seasonEditionsDesc
          .slice(selectedIdx + 1)
          .find((ed) => (rankingCountByEditionId.get(ed.id) ?? 0) >= 1) ?? null
      : null;

  const rankingSelectQuery = `
    id,
    user_id,
    ranking_entries (
      rank,
      team_id,
      team_name_snapshot,
      teams ( id, name, logo_url )
    )
  `;

  let rankings: ConsensusRankingInput[] = [];
  let prevRankings: ConsensusRankingInput[] = [];
  if (selectedSeason && selectedDivision && selectedEdition) {
    const [{ data: rankingRows }, prevRes] = await Promise.all([
      supabase
        .from("rankings")
        .select(rankingSelectQuery)
        .eq("status", "published")
        .eq("ranking_type", "team")
        .eq("season_id", selectedSeason.id)
        .eq("division_id", selectedDivision.id)
        .eq("edition_id", selectedEdition.id)
        .order("published_at", { ascending: false }),
      previousEdition
        ? supabase
            .from("rankings")
            .select(rankingSelectQuery)
            .eq("status", "published")
            .eq("ranking_type", "team")
            .eq("season_id", selectedSeason.id)
            .eq("division_id", selectedDivision.id)
            .eq("edition_id", previousEdition.id)
        : Promise.resolve({ data: [] }),
    ]);

    const rawCurrent = (rankingRows ?? []) as unknown as (ConsensusRankingInput & {
      user_id?: string | null;
    })[];
    const rawPrev = (prevRes.data ?? []) as unknown as (ConsensusRankingInput & {
      user_id?: string | null;
    })[];
    rankings = await attachPublicProfiles(supabase, rawCurrent);
    prevRankings = rawPrev.map((r) => ({ ...r, profiles: null }));
  }

  const averageRows = attachConsensusChanges(
    computeAverageTeamRankings(rankings),
    computeAverageTeamRankings(prevRankings)
  );

  const contributors = rankings.map((b) => {
    const prof = unwrap(b.profiles);
    return {
      rankingId: b.id,
      username: prof?.username ?? "Voter",
      avatarUrl: prof?.avatar_url ?? null,
    };
  });

  const seasonOptions = allSeasons.map((s) => {
    const league = unwrap(
      s.leagues as
        | {
            name?: string;
            short_name?: string | null;
            slug?: string;
            logo_url?: string | null;
          }
        | {
            name?: string;
            short_name?: string | null;
            slug?: string;
            logo_url?: string | null;
          }[]
        | null
    );
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      isActive: s.is_active,
      leagueName: league?.name ?? "League",
      leagueShortName:
        league?.short_name ||
        (league?.slug === "scdl" ? "SCDL" : league?.name ?? ""),
      leagueLogoUrl: league?.logo_url ?? null,
    };
  });

  const divisionOptions = seasonDivisions.map((d) => {
    const theme = resolveDivisionTheme(d.theme_key, divisionThemes);
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      logoUrl: d.logo_url ?? theme.default_logo_url ?? null,
      accentColor: theme.accent_text_color,
      primaryColor: theme.primary_color,
      themeKey: d.theme_key,
    };
  });

  const editionOptions = seasonEditionsAsc.map((ed) => ({
    id: ed.id,
    name: ed.name,
    slug: ed.slug,
    isOpen: ed.is_open,
    isArchived: Boolean(ed.is_archived),
    rankingCount: rankingCountByEditionId.get(ed.id) ?? 0,
  }));

  const selectedSeasonLeague = selectedSeason
    ? unwrap(
        selectedSeason.leagues as
          | {
              name?: string;
              short_name?: string | null;
              slug?: string;
              logo_url?: string | null;
            }
          | null
      )
    : null;

  const selectedDivTheme = resolveDivisionTheme(
    selectedDivision?.theme_key ?? "scdl",
    divisionThemes
  );

  return {
    seasons: seasonOptions,
    divisions: divisionOptions,
    editions: editionOptions,
    selectedSeasonSlug: selectedSeason?.slug ?? "",
    selectedDivisionSlug: selectedDivision?.slug ?? "",
    selectedEditionSlug: selectedEdition?.slug ?? "",
    leagueName: selectedSeasonLeague?.name ?? "Scuttle Crab Draft League",
    leagueLogoUrl: selectedSeasonLeague?.logo_url ?? null,
    seasonName: selectedSeason?.name ?? "",
    divisionName: selectedDivision?.name ?? "",
    divisionLogoUrl:
      selectedDivision?.logo_url ?? selectedDivTheme.default_logo_url ?? null,
    divisionTheme: selectedDivTheme,
    editionName: selectedEdition?.name ?? "",
    submissionCount: rankings.length,
    isFallbackOutdated,
    latestEditionName: latestOpenEdition?.name ?? null,
    latestEditionCount,
    rows: averageRows,
    contributors,
  };
  },
  ["consensus-page-v1"],
  { revalidate: 600, tags: ["consensus-data"] }
);

const loadConsensusPageDataCached = cache(
  (season?: string, division?: string, edition?: string) =>
    fetchConsensusPageData(season ?? "", division ?? "", edition ?? "")
);

export function loadConsensusPageData(params: {
  season?: string;
  division?: string;
  edition?: string;
}): Promise<ConsensusDataResult> {
  return loadConsensusPageDataCached(
    params.season,
    params.division,
    params.edition
  );
}

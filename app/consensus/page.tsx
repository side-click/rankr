import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import {
  computeAverageTeamRankings,
  type ConsensusBallotInput,
} from "@/utils/averageRankings";
import { resolveDivisionTheme } from "@/utils/themes";
import type { DivisionTheme } from "@/types/database";
import { ConsensusRankingsView } from "@/components/ConsensusRankingsView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consensus Rankings | Rankr",
  description:
    "Official aggregated team power rankings averaged across all published ballots.",
};

function unwrap<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export default async function ConsensusPage({
  searchParams,
}: {
  searchParams: Promise<{
    season?: string;
    division?: string;
    edition?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

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

  const selectedSeason =
    (params.season ? allSeasons.find((s) => s.slug === params.season) : null) ??
    allSeasons.find((s) => s.is_active) ??
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

  // Count published team ballots per edition for the selected season + division
  const ballotCountByEditionId = new Map<string, number>();
  if (selectedSeason && selectedDivision) {
    const { data: countRows } = await supabase
      .from("ballots")
      .select("edition_id")
      .eq("status", "published")
      .eq("ranking_type", "team")
      .eq("season_id", selectedSeason.id)
      .eq("division_id", selectedDivision.id);

    for (const row of countRows ?? []) {
      if (!row.edition_id) continue;
      ballotCountByEditionId.set(
        row.edition_id,
        (ballotCountByEditionId.get(row.edition_id) ?? 0) + 1
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
      (ed) => (ballotCountByEditionId.get(ed.id) ?? 0) >= 2
    ) ?? null;

  const selectedEdition =
    explicitEdition ??
    mostRecentWithMin2 ??
    latestOpenEdition ??
    seasonEditionsDesc.find((ed) => !ed.is_archived) ??
    seasonEditionsDesc[0] ??
    null;

  const latestEditionCount = latestOpenEdition
    ? ballotCountByEditionId.get(latestOpenEdition.id) ?? 0
    : 0;

  const isFallbackOutdated = Boolean(
    latestOpenEdition &&
      selectedEdition &&
      selectedEdition.id !== latestOpenEdition.id &&
      latestEditionCount < 2
  );

  let ballots: ConsensusBallotInput[] = [];
  if (selectedSeason && selectedDivision && selectedEdition) {
    const { data: ballotRows } = await supabase
      .from("ballots")
      .select(
        `
        id,
        profiles ( username, avatar_url ),
        ballot_entries (
          rank,
          team_id,
          team_name_snapshot,
          teams ( id, name, logo_url )
        )
      `
      )
      .eq("status", "published")
      .eq("ranking_type", "team")
      .eq("season_id", selectedSeason.id)
      .eq("division_id", selectedDivision.id)
      .eq("edition_id", selectedEdition.id)
      .order("published_at", { ascending: false });

    ballots = (ballotRows ?? []) as ConsensusBallotInput[];
  }

  const averageRows = computeAverageTeamRankings(ballots);

  const contributors = ballots.map((b) => {
    const prof = unwrap(b.profiles);
    return {
      ballotId: b.id,
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

  const editionOptions = seasonEditionsDesc.map((ed) => ({
    id: ed.id,
    name: ed.name,
    slug: ed.slug,
    isOpen: ed.is_open,
    isArchived: Boolean(ed.is_archived),
    ballotCount: ballotCountByEditionId.get(ed.id) ?? 0,
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

  return (
    <ConsensusRankingsView
      seasons={seasonOptions}
      divisions={divisionOptions}
      editions={editionOptions}
      selectedSeasonSlug={selectedSeason?.slug ?? ""}
      selectedDivisionSlug={selectedDivision?.slug ?? ""}
      selectedEditionSlug={selectedEdition?.slug ?? ""}
      leagueName={selectedSeasonLeague?.name ?? "Scuttle Crab Draft League"}
      leagueLogoUrl={selectedSeasonLeague?.logo_url ?? null}
      seasonName={selectedSeason?.name ?? ""}
      divisionName={selectedDivision?.name ?? ""}
      divisionLogoUrl={
        selectedDivision?.logo_url ?? selectedDivTheme.default_logo_url ?? null
      }
      divisionTheme={selectedDivTheme}
      editionName={selectedEdition?.name ?? ""}
      submissionCount={ballots.length}
      isFallbackOutdated={isFallbackOutdated}
      latestEditionName={latestOpenEdition?.name ?? null}
      latestEditionCount={latestEditionCount}
      rows={averageRows}
      contributors={contributors}
    />
  );
}

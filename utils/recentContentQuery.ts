import type { PlayerTierListPayload } from "@/types/database";

// Shared select for published content cards (home recent list, browse, & API pagination).
export const RECENT_CONTENT_SELECT = `
      id,
      user_id,
      title,
      ranking_type,
      tier_variant,
      tier_data,
      published_at,
      season_id,
      division_id,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      division_logo_snapshot,
      edition_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, theme_key, logo_url ),
      editions ( name ),
      ranking_entries ( rank, team_name_snapshot, teams ( name, logo_url ) )
`;

export const RECENT_BLOG_SELECT = `
      id,
      user_id,
      title,
      subtitle,
      banner_url,
      author_name,
      published_at,
      season_id,
      season_name_snapshot,
      league_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) )
`;

export const RECENT_CONTENT_PAGE_SIZE = 6;

/**
 * Trims heavy ranking card fields (`ranking_entries` beyond top 3 and bulky
 * `tier_data` player arrays) before serializing to client grids/lists.
 */
export function compactRankingCardRow<
  T extends {
    ranking_type?: string | null;
    tier_data?: unknown;
    ranking_entries?: unknown;
  },
>(row: T): T {
  const entries = Array.isArray(row.ranking_entries)
    ? [...row.ranking_entries]
        .sort(
          (a, b) =>
            Number((a as { rank?: number }).rank ?? 99) -
            Number((b as { rank?: number }).rank ?? 99)
        )
        .slice(0, 3)
    : row.ranking_entries;

  let compactTierData: unknown = null;
  if (row.ranking_type === "player" && row.tier_data) {
    const td = row.tier_data as PlayerTierListPayload;
    const populatedSections = Array.isArray(td.sections)
      ? td.sections
          .filter(
            (sec) =>
              sec.role !== "all" &&
              Array.isArray(sec.tiers) &&
              sec.tiers.some(
                (t) => Array.isArray(t.players) && t.players.length > 0
              )
          )
          .map((sec) => ({
            role: sec.role,
            tiers: [
              {
                id: "",
                label: "",
                color: "",
                commentary: "",
                players: [{ id: "1", name: "", role: sec.role }],
              },
            ],
          }))
      : [];
    compactTierData = {
      preset: td.preset,
      splitByRole: td.splitByRole,
      sections: populatedSections,
    };
  }

  return {
    ...row,
    ranking_entries: entries,
    tier_data: compactTierData,
  };
}

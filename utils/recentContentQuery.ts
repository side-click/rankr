// Shared select for published content cards (home recent list + client "show more").
export const RECENT_CONTENT_SELECT = `
      id,
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
      profiles ( username, avatar_url ),
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, theme_key, logo_url ),
      editions ( name ),
      ranking_entries ( rank, team_name_snapshot, teams ( name, logo_url ) )
`;

export const RECENT_BLOG_SELECT = `
      id,
      title,
      subtitle,
      banner_url,
      author_name,
      published_at,
      season_id,
      season_name_snapshot,
      league_name_snapshot,
      profiles ( username, avatar_url ),
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) )
`;

export const RECENT_CONTENT_PAGE_SIZE = 6;

import type { RosterSlot } from "@/utils/roles";

export interface Profile {
  id: string;
  discord_id: string | null;
  username: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_banned?: boolean;
  ban_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  require_allowlist: boolean;
  updated_at: string;
}

export interface AllowedDiscordUser {
  discord_id: string;
  label: string | null;
  added_by: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  logo_url: string | null;
  theme_key: string;
  created_at: string;
}

export interface Season {
  id: string;
  league_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  leagues?: Pick<
    League,
    "id" | "name" | "short_name" | "slug" | "logo_url" | "theme_key"
  >;
}

export interface DivisionTheme {
  key: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_text_color: string;
  default_logo_url: string | null;
  created_at?: string;
}

export interface Division {
  id: string;
  season_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_key: "baron" | "dragon" | string;
  created_at: string;
}

export interface Edition {
  id: string;
  season_id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_open: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  division_id: string;
  name: string;
  captain: string | null;
  logo_url: string | null;
  roster: (string | RosterSlot)[];
  default_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BallotOverlay {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
}

export interface Ballot {
  id: string;
  user_id: string;
  season_id: string | null;
  division_id: string | null;
  edition_id: string | null;
  title: string | null;
  author_notes: string;
  overlays?: BallotOverlay[];
  status: "draft" | "published";
  published_at: string | null;
  league_name_snapshot?: string | null;
  season_name_snapshot?: string | null;
  division_name_snapshot?: string | null;
  division_logo_snapshot?: string | null;
  division_theme_snapshot?: string | null;
  edition_name_snapshot?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "id" | "username" | "avatar_url">;
  seasons?: Pick<Season, "id" | "name" | "slug"> | null;
  divisions?: Pick<Division, "id" | "name" | "slug" | "logo_url" | "theme_key"> | null;
  editions?: Pick<Edition, "id" | "name" | "slug" | "sort_order" | "is_open"> | null;
}

export interface BallotEntry {
  id: string;
  ballot_id: string;
  team_id: string | null;
  rank: number;
  previous_rank: number | null;
  rank_change: number | null;
  commentary: string;
  team_name_snapshot: string;
  team_logo_snapshot: string | null;
  roster_snapshot: (string | RosterSlot)[];
  created_at: string;
}

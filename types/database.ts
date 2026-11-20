import type { LeagueRole, RosterSlot } from "@/utils/roles";

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
  stats_provider?: "google_sheet" | "supabase_native" | "none" | null;
  stats_sheet_id?: string | null;
  stats_sheet_gids?: string[] | null;
  stats_credits_label?: string | null;
  stats_credits_url?: string | null;
  stats_credits_attribution?: string | null;
  created_at: string;
  leagues?: Pick<
    League,
    "id" | "name" | "short_name" | "slug" | "logo_url" | "theme_key"
  >;
}

export interface MatchDraftRow {
  game_id: string;
  season_id: string | null;
  blue_team: string;
  red_team: string;
  blue_bans: string[];
  red_bans: string[];
  blue_picks: string[];
  red_picks: string[];
  source_url: string | null;
  updated_at?: string;
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
  is_archived?: boolean;
  is_players_only?: boolean;
  created_at: string;
}

export type RankingType = "team" | "player" | "champion_pool";

export type TierPresetKey = "standard" | "draft_day" | "custom";

export type TierVariant =
  | "standard_overall"
  | "standard_split"
  | "draft_day_overall"
  | "draft_day_split";

export interface SeasonPlayer {
  id: string;
  season_id: string;
  division_id: string | null;
  team_id: string | null;
  role: LeagueRole;
  name: string;
  is_captain: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PlayerTierItem {
  id: string;
  name: string;
  role: LeagueRole;
  division_id?: string | null;
  team_name?: string | null;
  team_logo_url?: string | null;
  is_captain?: boolean;
}

export interface TierRowData {
  id: string;
  label: string;
  color: string;
  commentary: string;
  players: PlayerTierItem[];
}

export interface TierSectionData {
  role: LeagueRole | "all";
  tiers: TierRowData[];
}

export interface PlayerTierListPayload {
  preset: TierPresetKey;
  splitByRole: boolean;
  sections: TierSectionData[];
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

export interface RankingOverlay {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
}

export interface Ranking {
  id: string;
  user_id: string;
  season_id: string | null;
  division_id: string | null;
  edition_id: string | null;
  ranking_type?: RankingType;
  tier_variant?: TierVariant | null;
  tier_data?: PlayerTierListPayload | null;
  title: string | null;
  author_notes: string;
  overlays?: RankingOverlay[];
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

export interface RankingEntry {
  id: string;
  ranking_id: string;
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

export interface ChampionPoolTierItem {
  championId: string;
  name: string;
  isBlindable?: boolean;
}

export interface ChampionTierRowData {
  id: string;
  label: string;
  color: string;
  commentary: string;
  champions: ChampionPoolTierItem[];
}

export interface ChampionRoleSection {
  role: LeagueRole;
  preset: TierPresetKey;
  tiers: ChampionTierRowData[];
}

export interface ChampionPoolPayload {
  version: 1;
  title: string;
  generalNotes?: string;
  roles: Partial<Record<LeagueRole, ChampionRoleSection>>;
}

export interface EncryptedChampionPoolRecord {
  id: string;
  user_id: string;
  encrypted_payload: string;
  encryption_salt: string;
  encryption_iv: string;
  encryption_version: number;
  created_at: string;
  updated_at: string;
}

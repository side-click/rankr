import Link from "next/link";
import { Award, User } from "lucide-react";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { resolveDivisionTheme } from "@/utils/themes";
import type { RankingType, TierVariant } from "@/types/database";

type MaybeArray<T> = T | T[] | null | undefined;

function unwrap<T>(val: MaybeArray<T>): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export interface BallotCardData {
  id: string;
  title: string | null;
  ranking_type?: RankingType;
  tier_variant?: TierVariant | string | null;
  division_id?: string | null;
  published_at: string | null;
  league_name_snapshot?: string | null;
  season_name_snapshot?: string | null;
  division_name_snapshot?: string | null;
  division_logo_snapshot?: string | null;
  division_theme_snapshot?: string | null;
  edition_name_snapshot?: string | null;
  profiles?: MaybeArray<{ username: string; avatar_url: string | null }>;
  seasons?: MaybeArray<{
    name: string;
    slug?: string;
    leagues?: MaybeArray<{
      name?: string;
      short_name?: string | null;
      slug?: string;
      logo_url?: string | null;
    }>;
  }>;
  divisions?: MaybeArray<{
    name: string;
    slug?: string;
    logo_url: string | null;
    theme_key?: string | null;
  }>;
  editions?: MaybeArray<{ name: string }>;
}

export function getLeaguePrefix(
  league: { name?: string; short_name?: string | null; slug?: string } | null,
  fallbackName?: string | null
): string {
  if (league?.short_name) return league.short_name;
  if (league?.slug === "scdl") return "SCDL";
  if (league?.name) return league.name;
  if (fallbackName === "Scuttle Crab Draft League") return "SCDL";
  return fallbackName ?? "";
}

export function BallotCard({
  ballot,
  layout = "grid",
}: {
  ballot: BallotCardData;
  layout?: "grid" | "list";
}) {
  const profile = unwrap(ballot.profiles);
  const season = unwrap(ballot.seasons);
  const league = unwrap(season?.leagues);
  const division = unwrap(ballot.divisions);
  const edition = unwrap(ballot.editions);

  const isPlayer = ballot.ranking_type === "player";
  const hasDivision = Boolean(
    ballot.division_id || division?.name || ballot.division_name_snapshot
  );
  const divLogo = division?.logo_url ?? ballot.division_logo_snapshot;
  const displayLogo = hasDivision ? divLogo : league?.logo_url ?? null;
  const divName = division?.name ?? ballot.division_name_snapshot ?? "Division";
  const edName = edition?.name ?? ballot.edition_name_snapshot ?? "Edition";
  const sName = season?.name ?? ballot.season_name_snapshot ?? "";
  const leaguePrefix = getLeaguePrefix(league, ballot.league_name_snapshot);
  const leagueSeasonLabel = `${leaguePrefix ? `${leaguePrefix}: ` : ""}${sName}`;
  const publishedDate = ballot.published_at
    ? new Date(ballot.published_at).toLocaleDateString()
    : null;

  const resolvedTheme = hasDivision
    ? resolveDivisionTheme(
        division?.theme_key ?? ballot.division_theme_snapshot
      )
    : {
        primary_color: "#1b5e36",
        secondary_color: "#0f2e1f",
        accent_text_color: "#7cd438",
      };

  const cardStyle: React.CSSProperties = {
    borderLeftWidth: "3px",
    borderLeftColor: resolvedTheme.primary_color,
    backgroundImage: `linear-gradient(135deg, ${resolvedTheme.primary_color}45 0%, rgba(18, 22, 21, 0.72) 52%, ${resolvedTheme.secondary_color}3a 100%)`,
  };

  if (layout === "list") {
    return (
      <Link
        href={`/ballot/${ballot.id}`}
        style={cardStyle}
        className="xp-panel px-3.5 py-2.5 hover:brightness-110 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-40 sm:w-44 shrink-0 flex items-center gap-2.5 px-2.5 py-1.5 rounded bg-black/25 border border-white/10">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-8 h-8 rounded-md object-cover border border-white/30 shrink-0"
              />
            ) : (
              <span className="w-8 h-8 rounded-md bg-[#5865f2] text-white text-sm font-bold inline-flex items-center justify-center shrink-0">
                {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-xs font-bold text-[#f0c020] truncate">
              {profile?.username ?? "Unknown"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="wow-heading text-base font-bold text-[#f0ede0] leading-tight truncate">
                {edName}
              </span>
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt={hasDivision ? divName : league?.name ?? sName}
                  className="w-5 h-5 object-contain shrink-0"
                />
              ) : (
                <Award className="w-4 h-4 text-[#7cd438] shrink-0" />
              )}
              <span
                title={isPlayer ? "Player Tier List" : "Team Power Rankings"}
                className="w-5 h-5 rounded bg-[#2a2210] border border-[#c89b3c]/70 inline-flex items-center justify-center shrink-0"
              >
                {isPlayer ? (
                  <User className="w-3 h-3 text-[#f0c020]" />
                ) : (
                  <TeamGroupIcon className="w-3 h-3 text-[#f0c020]" />
                )}
              </span>
            </div>
            <div className="text-xs truncate flex flex-wrap items-center gap-x-1.5">
              <span
                style={{ color: resolvedTheme.accent_text_color }}
                className="font-bold"
              >
                {hasDivision ? divName : "All Divisions"}
              </span>
              <span className="text-[#6e7572]">•</span>
              <span className="font-semibold text-[#c7c5b8]">
                {isPlayer ? "Player Tier List" : "Team Power Rankings"}
              </span>
              <span className="text-[#6e7572]">•</span>
              <span className="text-[11px] text-[#a6a89e]">
                {leagueSeasonLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 text-[11px] shrink-0">
          <span className="text-[#a6a89e]">
            {publishedDate ? `Published ${publishedDate}` : ""}
          </span>
          <span className="text-[#7cd438] font-bold shrink-0">Open →</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/ballot/${ballot.id}`}
      style={cardStyle}
      className="xp-panel relative p-3.5 hover:brightness-110 transition flex flex-col justify-between gap-2.5"
    >
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        {displayLogo ? (
          <img
            src={displayLogo}
            alt={hasDivision ? divName : league?.name ?? sName}
            className="w-6 h-6 object-contain shrink-0"
          />
        ) : (
          <Award className="w-5 h-5 text-[#7cd438] shrink-0" />
        )}
        <span
          title={isPlayer ? "Player Tier List" : "Team Power Rankings"}
          className="w-6 h-6 rounded bg-[#2a2210] border border-[#c89b3c]/70 flex items-center justify-center shrink-0"
        >
          {isPlayer ? (
            <User className="w-3.5 h-3.5 text-[#f0c020]" />
          ) : (
            <TeamGroupIcon className="w-3.5 h-3.5 text-[#f0c020]" />
          )}
        </span>
      </div>

      <div className="flex items-stretch gap-3 min-w-0">
        <div className="w-[116px] sm:w-[128px] shrink-0 flex flex-col items-center justify-center text-center gap-1.5 px-1.5 py-2 rounded bg-black/25 border border-white/10">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover border border-white/30 shrink-0"
            />
          ) : (
            <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-md bg-[#5865f2] text-white text-lg font-bold inline-flex items-center justify-center shrink-0">
              {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="w-full text-xs font-bold text-[#f0c020] truncate">
            {profile?.username ?? "Unknown"}
          </span>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center py-0.5">
          <div className="wow-heading text-base sm:text-[17px] font-bold text-[#f0ede0] leading-tight truncate pr-14">
            {edName}
          </div>
          <div
            style={{ color: resolvedTheme.accent_text_color }}
            className="text-xs font-bold truncate"
          >
            {hasDivision ? divName : "All Divisions"}
          </div>
          <div className="text-xs font-semibold text-[#c7c5b8] truncate">
            {isPlayer ? "Player Tier List" : "Team Power Rankings"}
          </div>
          <div className="text-[11px] text-[#a6a89e] truncate">
            {leagueSeasonLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
        <span className="text-[#a6a89e]">
          {publishedDate ? `Published ${publishedDate}` : ""}
        </span>
        <span className="text-[#7cd438] font-bold shrink-0">Open →</span>
      </div>
    </Link>
  );
}

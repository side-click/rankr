import Link from "next/link";
import { Award, User } from "lucide-react";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { resolveDivisionTheme } from "@/utils/themes";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import type {
  PlayerTierListPayload,
  RankingType,
  TierVariant,
} from "@/types/database";

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
  tier_data?: PlayerTierListPayload | unknown;
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
  ballot_entries?: MaybeArray<{
    rank: number;
    team_name_snapshot: string | null;
    teams?: MaybeArray<{ name: string; logo_url: string | null }>;
  }>;
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

export type BallotCardLayout = "grid" | "list";

export function BallotCard({
  ballot,
  layout = "grid",
}: {
  ballot: BallotCardData;
  layout?: BallotCardLayout;
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
    ? new Date(ballot.published_at).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      })
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
    backgroundImage: `linear-gradient(110deg, ${resolvedTheme.primary_color}5c 0%, ${resolvedTheme.primary_color}26 46%, rgba(18, 22, 21, 0.92) 100%)`,
  };

  if (layout === "list") {
    const top3Teams = !isPlayer
      ? [...(Array.isArray(ballot.ballot_entries) ? ballot.ballot_entries : [])]
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 3)
          .map((e) => {
            const t = unwrap(e.teams);
            return {
              rank: e.rank,
              name: t?.name ?? e.team_name_snapshot ?? "Team",
              logoUrl: t?.logo_url ?? null,
            };
          })
      : [];

    const playerConfigPreview = isPlayer
      ? (() => {
          const td = ballot.tier_data as PlayerTierListPayload | null | undefined;
          const presetLabel =
            td?.preset === "draft_day" ||
            ballot.tier_variant === "draft_day_overall" ||
            ballot.tier_variant === "draft_day_split"
              ? "Draft Day"
              : "Standard";
          const isSplit =
            typeof td?.splitByRole === "boolean"
              ? td.splitByRole
              : ballot.tier_variant === "standard_split" ||
                ballot.tier_variant === "draft_day_split";
          const populatedRoles =
            isSplit && Array.isArray(td?.sections)
              ? td.sections
                  .filter(
                    (sec) =>
                      sec.role !== "all" &&
                      sec.tiers.some((t) => t.players.length > 0)
                  )
                  .map((sec) => getRoleMeta(sec.role as LeagueRole))
              : [];
          return {
            presetLabel,
            splitLabel: isSplit ? "Split Roles" : "Overall",
            populatedRoles,
          };
        })()
      : null;

    const hasPreview = top3Teams.length > 0 || Boolean(playerConfigPreview);

    return (
      <Link
        href={`/ballot/${ballot.id}`}
        style={cardStyle}
        className="xp-panel px-3 py-2.5 hover:brightness-110 transition flex flex-col gap-2.5 lg:grid lg:grid-cols-[148px_165px_auto_1fr] xl:grid-cols-[148px_135px_auto_minmax(0,1fr)_auto] lg:items-center lg:gap-3"
      >
        {/* Mobile/Tablet top row / Desktop Col 1 + Col 2 */}
        <div className="flex items-center gap-3 min-w-0 lg:contents">
          <div className="w-36 sm:w-40 lg:w-full shrink-0 flex items-center gap-2 px-2 py-1.5 rounded bg-black/25 border border-white/10 min-w-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                width={32}
                height={32}
                className="w-8 h-8 rounded-md object-cover border border-white/30 shrink-0"
              />
            ) : (
              <span className="w-8 h-8 rounded-md bg-[#5865f2] text-white text-sm font-bold inline-flex items-center justify-center shrink-0">
                {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-sm sm:text-[15px] font-bold text-[#f0c020] truncate">
              {profile?.username ?? "Unknown"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="wow-heading text-base font-bold text-[#f0ede0] leading-tight truncate">
                {edName}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 lg:hidden">
                {displayLogo ? (
                  <img
                    src={displayLogo}
                    alt={hasDivision ? divName : league?.name ?? sName}
                    width={20}
                    height={20}
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
            </div>
            <div
              style={{ color: resolvedTheme.accent_text_color }}
              className="text-xs font-bold truncate"
            >
              {hasDivision ? divName : "All Divisions"}
            </div>
            <div className="lg:hidden text-[11px] text-[#c7c5b8] truncate">
              {isPlayer ? "Player Tier List" : "Team Power Rankings"} •{" "}
              <span className="text-[#a6a89e]">{leagueSeasonLabel}</span>
            </div>
          </div>
        </div>

        {/* Desktop Col 3: Logo + Type + Season (auto width, never truncates) */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {displayLogo ? (
            <img
              src={displayLogo}
              alt={hasDivision ? divName : league?.name ?? sName}
              width={24}
              height={24}
              className="w-6 h-6 object-contain shrink-0"
            />
          ) : (
            <Award className="w-5 h-5 text-[#7cd438] shrink-0" />
          )}
          <span
            title={isPlayer ? "Player Tier List" : "Team Power Rankings"}
            className="w-6 h-6 rounded bg-[#2a2210] border border-[#c89b3c]/70 inline-flex items-center justify-center shrink-0"
          >
            {isPlayer ? (
              <User className="w-3.5 h-3.5 text-[#f0c020]" />
            ) : (
              <TeamGroupIcon className="w-3.5 h-3.5 text-[#f0c020]" />
            )}
          </span>
          <div className="whitespace-nowrap">
            <div className="text-xs font-semibold text-[#c7c5b8]">
              {isPlayer ? "Player Tier List" : "Team Power Rankings"}
            </div>
            <div className="text-[11px] text-[#a6a89e]">
              {leagueSeasonLabel}
            </div>
          </div>
        </div>

        {/* Wide Desktop Col 4: Top 3 / Top Tier Preview (xl+ only, also acts as 1fr spacer) */}
        <div className="hidden xl:flex items-center gap-1.5 min-w-0">
          {hasPreview && (
            <>
              {top3Teams.map((t) => (
                <span
                  key={t.rank}
                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-black/30 border border-white/10 text-[11px] font-bold text-[#f0ede0]"
                >
                  <span className="text-[#f0c020]">#{t.rank}</span>
                  {t.logoUrl && (
                    <img
                      src={t.logoUrl}
                      alt={t.name}
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain shrink-0"
                    />
                  )}
                  <span className="whitespace-nowrap">{t.name}</span>
                </span>
              ))}
              {playerConfigPreview && (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-black/30 border border-white/10 text-[11px] font-bold text-[#f0ede0] whitespace-nowrap">
                    <span className="text-[#f0c020]">
                      {playerConfigPreview.presetLabel}
                    </span>
                    <span className="text-white/30">•</span>
                    <span>{playerConfigPreview.splitLabel}</span>
                  </span>
                  {playerConfigPreview.populatedRoles.length > 0 && (
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-black/30 border border-white/10 text-[11px] font-semibold text-[#c7c5b8] whitespace-nowrap">
                      {playerConfigPreview.populatedRoles.map((r) => (
                        <span
                          key={r.key}
                          className="inline-flex items-center gap-1"
                        >
                          <img
                            src={r.icon}
                            alt={r.label}
                            width={14}
                            height={14}
                            className="w-3.5 h-3.5 object-contain shrink-0"
                          />
                          <span>{r.label}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer / Right Column */}
        <div className="flex items-center justify-between lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10 text-[11px] shrink-0">
          <span className="text-[#a6a89e] whitespace-nowrap">
            {publishedDate ? `Published ${publishedDate}` : ""}
          </span>
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
            width={24}
            height={24}
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
              width={56}
              height={56}
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
      </div>
    </Link>
  );
}

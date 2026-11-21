import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { checkUserAllowlisted } from "@/utils/allowlist";
import { RetroWindow } from "@/components/RetroWindow";
import { AuthButton } from "@/components/AuthButton";
import { AllowlistBlockedWindow } from "@/components/AllowlistBlockedWindow";
import { DeleteDraftButton } from "@/components/DeleteDraftButton";
import { DeleteChampionPoolButton } from "@/components/DeleteChampionPoolButton";
import { ChampionHelmetIcon } from "@/components/ChampionHelmetIcon";
import { getLeaguePrefix } from "@/components/ContentCard";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { resolveDivisionTheme } from "@/utils/themes";
import { Award, Edit3, FileText, Lock, User } from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My History | Rankr",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function MyRankingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("require_allowlist")
      .eq("id", 1)
      .maybeSingle();

    return (
      <RetroWindow title="My History" theme="scdl">
        <div className="py-8 text-center space-y-3">
          <Lock className="w-8 h-8 mx-auto text-[#f0c020]" />
          <p className="text-sm font-bold text-[#f0ede0]">
            Sign in with Discord to view your ranking history.
          </p>
          <div className="flex justify-center">
            <AuthButton
              user={null}
              requireAllowlist={Boolean(appSettings?.require_allowlist)}
            />
          </div>
        </div>
      </RetroWindow>
    );
  }

  const [isAllowlisted, { data: profile }] = await Promise.all([
    checkUserAllowlisted(supabase),
    supabase
      .from("profiles")
      .select("username, avatar_url, discord_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!isAllowlisted) {
    return (
      <AllowlistBlockedWindow
        title="My History — Invite Only"
        user={{
          id: user.id,
          username: profile?.username ?? "Discord User",
          avatarUrl: profile?.avatar_url ?? null,
          discordId: profile?.discord_id ?? null,
        }}
      />
    );
  }

  const [{ data: ballots }, { data: blogs }, { data: championPool }] = await Promise.all([
    supabase
      .from("rankings")
      .select(
        `
      id,
      title,
      status,
      ranking_type,
      tier_variant,
      division_id,
      published_at,
      updated_at,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      division_logo_snapshot,
      division_theme_snapshot,
      edition_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, logo_url, theme_key ),
      editions ( name, slug, sort_order, is_open, is_archived )
    `
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("blogs")
      .select(
        `
      id,
      title,
      subtitle,
      status,
      published_at,
      updated_at,
      season_name_snapshot,
      league_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) )
    `
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("champion_pools")
      .select("id, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const hasBallots = Boolean(ballots && ballots.length > 0);
  const hasBlogs = Boolean(blogs && blogs.length > 0);

  return (
    <RetroWindow title="My History" theme="scdl">
      <div className="mb-3 p-3 rounded-lg bg-[#221d12] border border-[#c89b3c]/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ChampionHelmetIcon className="w-5 h-5 text-[#f0c020] shrink-0" />
          <div>
            <p className="text-xs font-black text-[#f0ede0] flex items-center gap-1.5">
              Champion Pool
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/35 border border-[#c89b3c]/40 text-[10px] font-bold text-[#f0c020]">
                <Lock className="w-2.5 h-2.5" /> Private
              </span>
            </p>
            {!championPool && (
              <p className="text-[11px] text-[#c7c5b8]">
                Not created yet — build your personal per-role champion tier list.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 ml-auto">
          {championPool && (
            <span className="text-[11px] text-[#a6a89e] whitespace-nowrap">
              Last updated{" "}
              {new Date(championPool.updated_at).toLocaleDateString("en-US", {
                timeZone: "America/New_York",
              })}
            </span>
          )}
          {championPool ? (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/create?type=champion_pool"
                className="xp-btn text-xs w-[88px] justify-center"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Link>
              <DeleteChampionPoolButton poolId={championPool.id} />
            </div>
          ) : (
            <Link
              href="/create?type=champion_pool"
              className="xp-btn xp-btn-primary text-xs px-3 py-1.5"
            >
              Create Champion Pool
            </Link>
          )}
        </div>
      </div>

      {!hasBallots && !hasBlogs ? (
        <div className="xp-inset p-8 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            No published content or drafts yet.
          </p>
          <Link href="/create" className="xp-btn xp-btn-primary text-xs">
            Create New Content
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {(blogs ?? []).map((blog) => {
            const season = Array.isArray(blog.seasons)
              ? blog.seasons[0]
              : blog.seasons;
            const rawLeague = (
              season as {
                leagues?:
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
                    }[];
              } | null
            )?.leagues;
            const league = Array.isArray(rawLeague)
              ? rawLeague[0] ?? null
              : rawLeague ?? null;
            const leaguePrefix = getLeaguePrefix(
              league,
              blog.league_name_snapshot
            );
            const sName = season?.name ?? blog.season_name_snapshot ?? "";
            const hasSeason = Boolean(sName);
            const scopeLabel = hasSeason
              ? `${leaguePrefix ? `${leaguePrefix}: ` : ""}${sName}`
              : "Blog Post";
            const seasonLogo = hasSeason ? league?.logo_url ?? null : null;
            const isPublished = blog.status === "published";
            const dateStr = isPublished && blog.published_at
              ? `Published ${new Date(blog.published_at).toLocaleDateString("en-US", {
                  timeZone: "America/New_York",
                })}`
              : `Updated ${new Date(blog.updated_at).toLocaleDateString("en-US", {
                  timeZone: "America/New_York",
                })}`;
            const cardHref = isPublished
              ? `/blog/${blog.id}`
              : `/create?type=blog&edit=${blog.id}`;

            return (
              <div
                key={`blog-${blog.id}`}
                style={{
                  borderLeftWidth: "3px",
                  borderLeftColor: "#3b82f6",
                  backgroundImage:
                    "linear-gradient(110deg, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0.08) 46%, rgba(18, 22, 21, 0.92) 100%)",
                }}
                className="relative overflow-hidden xp-panel px-3 py-2.5 hover:brightness-110 transition flex flex-col gap-2.5 lg:grid lg:grid-cols-[124px_165px_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-3"
              >
                <Link
                  href={cardHref}
                  aria-label={blog.title}
                  className="absolute inset-0 z-0"
                />

                <div className="relative z-10 pointer-events-none w-28 sm:w-32 lg:w-full shrink-0 flex items-center justify-center">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-xs border ${
                      isPublished
                        ? "bg-[#173b24] text-[#7cd438] border-[#3a804d]"
                        : "bg-[#3d3012] text-[#f0c020] border-[#8c6b16]"
                    }`}
                  >
                    {blog.status}
                  </span>
                </div>

                <div className="relative z-10 pointer-events-none min-w-0">
                  <div className="wow-heading text-base font-bold text-[#f0ede0] leading-tight truncate">
                    Blog Post
                  </div>
                  {hasSeason && (
                    <div className="text-xs font-bold text-[#93c5fd] leading-tight truncate mt-0.5">
                      {scopeLabel}
                    </div>
                  )}
                </div>

                <div className="relative z-10 pointer-events-none flex items-center gap-2.5 min-w-0">
                  {seasonLogo && (
                    <img
                      src={seasonLogo}
                      alt={scopeLabel}
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  )}
                  <div className="w-7 h-7 rounded bg-[#2a2210] border border-[#c89b3c]/70 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[#f0c020]" />
                  </div>
                  <div className="text-xs font-bold text-[#f0ede0] line-clamp-2 break-words [overflow-wrap:anywhere] leading-snug min-w-0">
                    {blog.title}
                  </div>
                </div>

                <div className="relative z-10 pointer-events-none text-[11px] text-[#a6a89e] whitespace-nowrap">
                  {dateStr}
                </div>

                <div className="relative z-10 flex items-center gap-2 shrink-0 pointer-events-auto">
                  <Link
                    href={`/create?type=blog&edit=${blog.id}`}
                    className="xp-btn text-xs w-[88px] justify-center"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>
                  <DeleteDraftButton
                    ballotId={blog.id}
                    table="blogs"
                    status={isPublished ? "published" : "draft"}
                    title={blog.title}
                  />
                </div>
              </div>
            );
          })}
          {(ballots ?? []).map((b) => {
            const season = Array.isArray(b.seasons) ? b.seasons[0] : b.seasons;
            const division = Array.isArray(b.divisions)
              ? b.divisions[0]
              : b.divisions;
            const edition = Array.isArray(b.editions)
              ? b.editions[0]
              : b.editions;

            const isPlayer = b.ranking_type === "player";
            const hasDivision = Boolean(
              b.division_id || division?.name || b.division_name_snapshot
            );
            const rawLeague = (
              season as {
                leagues?:
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
                    }[];
              } | null
            )?.leagues;
            const league = Array.isArray(rawLeague) ? rawLeague[0] : rawLeague;
            const leaguePrefix = getLeaguePrefix(
              league ?? null,
              b.league_name_snapshot
            );

            const divLogo = division?.logo_url ?? b.division_logo_snapshot;
            const displayLogo = hasDivision ? divLogo : league?.logo_url ?? null;
            const divName = division?.name ?? b.division_name_snapshot ?? "Division";
            const edName = edition?.name ?? b.edition_name_snapshot ?? "Edition";
            const sName = season?.name ?? b.season_name_snapshot ?? "";

            const editParams = new URLSearchParams();
            if (isPlayer) editParams.set("type", "player");
            if (season?.slug) editParams.set("season", season.slug);
            if (isPlayer) {
              editParams.set("division", division?.slug ?? "all");
            } else if (division?.slug) {
              editParams.set("division", division.slug);
            }
            if (edition?.slug) editParams.set("edition", edition.slug);
            if (isPlayer && b.tier_variant) editParams.set("variant", b.tier_variant);

            const leagueSeasonLabel = `${leaguePrefix ? `${leaguePrefix}: ` : ""}${sName}`;
            const isPublished = b.status === "published";
            const editHref = `/create?${editParams.toString()}`;
            const primaryHref = isPublished
              ? isPlayer
                ? `/tierlist/${b.id}`
                : `/rankings/${b.id}`
              : editHref;
            const canEdit =
              !edition?.is_archived && (edition?.is_open || !isPublished);

            const dateStr = isPublished
              ? `Published ${new Date(
                  b.published_at ?? b.updated_at
                ).toLocaleDateString("en-US", {
                  timeZone: "America/New_York",
                })}`
              : `Updated ${new Date(b.updated_at).toLocaleDateString("en-US", {
                  timeZone: "America/New_York",
                })}`;

            const resolvedTheme = hasDivision
              ? resolveDivisionTheme(
                  division?.theme_key ?? b.division_theme_snapshot
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

            return (
              <div
                key={b.id}
                style={cardStyle}
                className="xp-panel relative px-3 py-2.5 hover:brightness-110 transition flex flex-col gap-2.5 lg:grid lg:grid-cols-[124px_165px_auto_1fr] lg:items-center lg:gap-3"
              >
                <Link
                  href={primaryHref}
                  aria-label={`Open ${edName} (${hasDivision ? divName : "All Divisions"})`}
                  className="absolute inset-0 z-0"
                />

                {/* Mobile/Tablet top row / Desktop Col 1 + Col 2 */}
                <div className="flex items-center gap-3 min-w-0 lg:contents pointer-events-none">
                  <div className="w-28 sm:w-32 lg:w-full shrink-0 flex items-center justify-center">
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-xs border ${
                        isPublished
                          ? "bg-[#173b24] text-[#7cd438] border-[#3a804d]"
                          : "bg-[#3d3012] text-[#f0c020] border-[#8c6b16]"
                      }`}
                    >
                      {b.status}
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
                            className="w-5 h-5 object-contain shrink-0"
                          />
                        ) : (
                          <Award className="w-4 h-4 text-[#7cd438] shrink-0" />
                        )}
                        <span
                          title={
                            isPlayer ? "Player Tier List" : "Team Power Rankings"
                          }
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
                    <div className="lg:hidden text-[11px] text-[#c7c5b8] leading-snug">
                      <div className="truncate">
                        {isPlayer ? "Player Tier List" : "Team Power Rankings"}
                        <span className="hidden sm:inline text-[#a6a89e]">
                          {" "}• {leagueSeasonLabel}
                        </span>
                      </div>
                      <div className="sm:hidden text-[#a6a89e] truncate">
                        {leagueSeasonLabel}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Col 3: Logo + Type + Season */}
                <div className="hidden lg:flex items-center gap-2 shrink-0 pointer-events-none">
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
                    title={
                      isPlayer ? "Player Tier List" : "Team Power Rankings"
                    }
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

                {/* Footer / Right Column: Date + Edit + Delete */}
                <div className="flex items-center justify-between lg:justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10 shrink-0 pointer-events-none">
                  <span className="text-[11px] text-[#a6a89e] whitespace-nowrap">
                    {dateStr}
                  </span>
                  <div className="relative flex items-center gap-2 shrink-0 pointer-events-auto">
                    {canEdit ? (
                      <Link
                        href={editHref}
                        className="xp-btn text-xs w-[88px] justify-center"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>
                    ) : (
                      (() => {
                        const isArchived = Boolean(edition?.is_archived);
                        const lockReason = isArchived
                          ? "This edition is archived and can no longer be edited."
                          : "This edition is locked by an admin and can no longer be edited.";
                        return (
                          <span
                            tabIndex={0}
                            title={lockReason}
                            className="group relative w-[88px] py-1.5 px-2 rounded-xs bg-black/35 border border-white/15 text-[11px] font-bold text-[#a6a89e] inline-flex items-center justify-center gap-1 cursor-help select-none"
                          >
                            <Lock className="w-3 h-3 shrink-0 text-[#c89b3c]" />
                            <span>{isArchived ? "Archived" : "Locked"}</span>
                            <span className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 w-52 px-2.5 py-1.5 rounded bg-[#121615] border border-[#c89b3c]/70 text-[11px] font-normal text-[#f0ede0] shadow-xl z-30 text-left leading-snug">
                              {lockReason}
                            </span>
                          </span>
                        );
                      })()
                    )}
                    <DeleteDraftButton
                      ballotId={b.id}
                      status={isPublished ? "published" : "draft"}
                      title={`${edName} (${hasDivision ? divName : "All Divisions"})`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RetroWindow>
  );
}

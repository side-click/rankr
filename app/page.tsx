import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import { RecentBallotsPanel } from "@/components/RecentBallotsPanel";
import { resolveDivisionTheme } from "@/utils/themes";
import { Eye, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: seasons, error: seasonsError } = await supabase
    .from("seasons")
    .select(
      `
      id,
      name,
      slug,
      is_active,
      leagues ( * )
    `
    )
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  const [
    { data: divisions },
    { data: divisionThemes },
    { data: activeTeams },
    { data: seasonPlayers },
  ] = await Promise.all([
    supabase
      .from("divisions")
      .select("id, season_id, name, slug, logo_url, theme_key")
      .order("name"),
    supabase.from("division_themes").select("*").order("name"),
    supabase.from("teams").select("id, division_id").eq("is_active", true),
    supabase.from("season_players").select("id, season_id"),
  ]);

  const { data: recentBallots } = await supabase
    .from("ballots")
    .select(
      `
      id,
      title,
      ranking_type,
      tier_variant,
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
      editions ( name )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(9);

  const needsSetup = Boolean(seasonsError) || !seasons || seasons.length === 0;
  const activeSeasons = (seasons ?? []).filter((s) => s.is_active);
  const inactiveSeasons = (seasons ?? []).filter((s) => !s.is_active);

  return (
    <div className="space-y-5">
      {needsSetup && (
        <RetroWindow title="Database Setup Required" theme="xp">
          <div className="flex items-start gap-3 text-sm">
            <ShieldAlert className="w-6 h-6 text-[#f0c020] shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-bold text-[#f5f2e6]">
                Database tables not initialized.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs font-mono p-2.5 xp-inset">
                <li>supabase/migrations/001_initial_schema.sql</li>
                <li>supabase/migrations/002_seed_season_4_5.sql</li>
                <li>supabase/migrations/003_add_leagues.sql</li>
                <li>supabase/migrations/004_league_short_name.sql</li>
              </ol>
            </div>
          </div>
        </RetroWindow>
      )}

      {/* Side-by-Side Seasons Frame */}
      {(activeSeasons.length > 0 || inactiveSeasons.length > 0) && (
        <RetroWindow title="Seasons" theme="scdl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Pane: Active */}
            <div className="lg:col-span-8 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#7cd438]">
                Active
              </div>
              {activeSeasons.length === 0 ? (
                <div className="xp-inset p-4 text-xs text-[#a6a89e]">
                  No active seasons.
                </div>
              ) : (
                activeSeasons.map((season) => {
                  const league = Array.isArray(season.leagues)
                    ? season.leagues[0]
                    : season.leagues;
                  const seasonDivisions = (divisions ?? []).filter(
                    (d) => d.season_id === season.id
                  );
                  const playerCount = (seasonPlayers ?? []).filter(
                    (p) => p.season_id === season.id
                  ).length;

                  return (
                    <div key={season.id} className="xp-panel p-3 space-y-2.5">
                      <Link
                        href={`/browse?season=${season.slug}`}
                        className="flex items-center gap-2.5 pb-2.5 px-1.5 -mx-1.5 py-1 rounded border-b border-white/10 hover:bg-white/5 transition"
                      >
                        {league?.logo_url && (
                          <img
                            src={league.logo_url}
                            alt={league.name}
                            className="w-11 h-11 object-contain shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase font-bold text-[#a6a89e] truncate">
                            {league?.name ?? "League"}
                          </div>
                          <div className="text-sm font-bold text-[#f0ede0] flex flex-wrap items-baseline gap-1.5">
                            <span>{season.name}</span>
                            <span className="text-xs font-normal text-[#a6a89e]">
                              ({playerCount}{" "}
                              {playerCount === 1 ? "player" : "players"})
                            </span>
                          </div>
                        </div>
                      </Link>

                      {seasonDivisions.length === 0 ? (
                        <div className="text-xs text-[#a6a89e]">
                          No divisions configured yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {seasonDivisions.map((div) => {
                            const divTheme = resolveDivisionTheme(
                              div.theme_key,
                              divisionThemes
                            );
                            const logoSrc =
                              div.logo_url ?? divTheme.default_logo_url;
                            const teamCount = (activeTeams ?? []).filter(
                              (t) => t.division_id === div.id
                            ).length;
                            return (
                              <Link
                                key={div.id}
                                href={`/browse?season=${season.slug}&division=${div.slug}`}
                                style={{
                                  borderLeftWidth: "3px",
                                  borderLeftColor: divTheme.primary_color,
                                }}
                                className="xp-inset p-3 flex items-center gap-3 hover:brightness-115 transition"
                              >
                                {logoSrc && (
                                  <img
                                    src={logoSrc}
                                    alt={div.name}
                                    className="w-11 h-11 object-contain shrink-0"
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div
                                    style={{ color: divTheme.accent_text_color }}
                                    className="font-bold text-base leading-tight truncate"
                                  >
                                    {div.name}
                                  </div>
                                  <div className="text-xs font-normal text-[#a6a89e]">
                                    {teamCount}{" "}
                                    {teamCount === 1 ? "team" : "teams"}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Pane: Inactive / Past */}
            <div className="lg:col-span-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#a6a89e]">
                Inactive / Past
              </div>
              {inactiveSeasons.length === 0 ? (
                <div className="xp-inset p-4 text-xs text-[#a6a89e]">
                  No inactive seasons.
                </div>
              ) : (
                <div className="space-y-2">
                  {inactiveSeasons.map((season) => {
                    const league = Array.isArray(season.leagues)
                      ? season.leagues[0]
                      : season.leagues;
                    return (
                      <Link
                        key={season.id}
                        href={`/browse?season=${season.slug}`}
                        className="xp-panel p-2.5 flex items-center justify-between gap-2 hover:brightness-110"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#a6a89e] uppercase truncate">
                            {league?.name ?? "League"}
                          </div>
                          <div className="text-xs font-bold text-[#f0ede0] truncate">
                            {season.name}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-xs bg-[#2b322f] text-[#a6a89e] border border-[#4a5450] shrink-0">
                          Inactive
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </RetroWindow>
      )}

      {/* Latest Published Rankings */}
      <RetroWindow title="Recently Published Rankings" theme="scdl">
        {!recentBallots || recentBallots.length === 0 ? (
          <div className="xp-inset p-6 text-center text-xs text-[#a6a89e]">
            No published rankings yet.
          </div>
        ) : (
          <RecentBallotsPanel ballots={recentBallots} />
        )}
      </RetroWindow>
    </div>
  );
}

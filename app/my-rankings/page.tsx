import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { checkUserAllowlisted } from "@/utils/allowlist";
import { RetroWindow } from "@/components/RetroWindow";
import { AuthButton } from "@/components/AuthButton";
import { AllowlistBlockedWindow } from "@/components/AllowlistBlockedWindow";
import { DeleteDraftButton } from "@/components/DeleteDraftButton";
import { getLeaguePrefix } from "@/components/BallotCard";
import { TeamGroupIcon } from "@/components/TeamGroupIcon";
import { Edit3, ExternalLink, Lock, User } from "lucide-react";

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
      <RetroWindow title="My Ranking History" theme="scdl">
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
        title="My Ranking History — Invite Only"
        user={{
          id: user.id,
          username: profile?.username ?? "Discord User",
          avatarUrl: profile?.avatar_url ?? null,
          discordId: profile?.discord_id ?? null,
        }}
      />
    );
  }

  const { data: ballots } = await supabase
    .from("ballots")
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
      edition_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, logo_url ),
      editions ( name, slug, sort_order, is_open, is_archived )
    `
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <RetroWindow title="My Ranking History" theme="scdl">
      {!ballots || ballots.length === 0 ? (
        <div className="xp-inset p-8 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            No rankings yet.
          </p>
          <Link href="/rank" className="xp-btn xp-btn-primary text-xs">
            Create Your First Ranking
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {ballots.map((b) => {
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

            return (
              <div
                key={b.id}
                className="xp-panel p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {displayLogo && (
                    <img
                      src={displayLogo}
                      alt={hasDivision ? divName : league?.name ?? sName}
                      className="w-10 h-10 object-contain shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <span className="font-bold text-sm text-[#f0ede0] truncate">
                        {edName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-xs border ${
                          b.status === "published"
                            ? "bg-[#173b24] text-[#7cd438] border-[#3a804d]"
                            : "bg-[#3d3012] text-[#f0c020] border-[#8c6b16]"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#a6a89e]">
                      {leagueSeasonLabel} •{" "}
                      {hasDivision ? divName : "All Divisions"} •{" "}
                      {isPlayer ? "Player Tier List" : "Team Power Rankings"} •
                      Updated {new Date(b.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!edition?.is_archived &&
                    (edition?.is_open || b.status === "draft") && (
                      <Link
                        href={`/rank?${editParams.toString()}`}
                        className="xp-btn text-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>
                    )}
                  {b.status === "draft" && (
                    <DeleteDraftButton
                      ballotId={b.id}
                      title={`${edName} (${hasDivision ? divName : "All Divisions"})`}
                    />
                  )}
                  {b.status === "published" && (
                    <Link
                      href={`/ballot/${b.id}`}
                      className="xp-btn xp-btn-primary text-xs min-w-[82px] justify-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RetroWindow>
  );
}

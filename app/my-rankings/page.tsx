import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { checkUserAllowlisted } from "@/utils/allowlist";
import { RetroWindow } from "@/components/RetroWindow";
import { AuthButton } from "@/components/AuthButton";
import { AllowlistBlockedWindow } from "@/components/AllowlistBlockedWindow";
import { getLeaguePrefix } from "@/components/BallotCard";
import { Edit3, ExternalLink, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyRankingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <RetroWindow title="My Ranking History" theme="scdl">
        <div className="py-8 text-center space-y-3">
          <Lock className="w-8 h-8 mx-auto text-[#f0c020]" />
          <p className="text-sm font-bold text-[#f0ede0]">
            Sign in with Discord to view your ranking history.
          </p>
          <div className="flex justify-center">
            <AuthButton user={null} />
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
      published_at,
      updated_at,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      division_logo_snapshot,
      edition_name_snapshot,
      seasons ( name, slug, leagues ( name, short_name, slug ) ),
      divisions ( name, slug, logo_url ),
      editions ( name, slug, sort_order, is_open )
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

            const divLogo = division?.logo_url ?? b.division_logo_snapshot;
            const divName = division?.name ?? b.division_name_snapshot ?? "Division";
            const edName = edition?.name ?? b.edition_name_snapshot ?? "Edition";
            const sName = season?.name ?? b.season_name_snapshot ?? "";
            const rawLeague = (
              season as {
                leagues?:
                  | { name?: string; short_name?: string | null; slug?: string }
                  | { name?: string; short_name?: string | null; slug?: string }[];
              } | null
            )?.leagues;
            const league = Array.isArray(rawLeague) ? rawLeague[0] : rawLeague;
            const leaguePrefix = getLeaguePrefix(
              league ?? null,
              b.league_name_snapshot
            );

            return (
              <div
                key={b.id}
                className="xp-panel p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {divLogo && (
                    <img
                      src={divLogo}
                      alt={divName}
                      className="w-10 h-10 object-contain shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#f0ede0] truncate">
                        {b.title || `${divName} — ${edName}`}
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
                      {leaguePrefix ? `${leaguePrefix}: ` : ""}
                      {sName} • Updated{" "}
                      {new Date(b.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {(edition?.is_open || b.status === "draft") && (
                    <Link
                      href={`/rank?season=${season?.slug}&division=${division?.slug}&edition=${edition?.slug}`}
                      className="xp-btn text-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>
                  )}
                  {b.status === "published" && (
                    <Link
                      href={`/ballot/${b.id}`}
                      className="xp-btn xp-btn-primary text-xs"
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

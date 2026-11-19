import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { checkUserAllowlisted } from "@/utils/allowlist";
import { RankWorkspace } from "@/components/RankWorkspace";
import { RetroWindow } from "@/components/RetroWindow";
import { AuthButton } from "@/components/AuthButton";
import { AllowlistBlockedWindow } from "@/components/AllowlistBlockedWindow";
import { getFocusedSeasonSlug } from "@/utils/focusedSeasonServer";
import type { Blog, CreateContentType } from "@/types/database";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RankPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    season?: string;
    division?: string;
    edition?: string;
    edit?: string;
  }>;
}) {
  const params = await searchParams;
  const [effectiveSeason, auth, supabase] = await Promise.all([
    getFocusedSeasonSlug(params.season),
    getServerAuthContext(),
    createClient(),
  ]);
  const user = auth.user;

  if (!user) {
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("require_allowlist")
      .eq("id", 1)
      .maybeSingle();

    return (
      <RetroWindow title="Sign In Required — Rankings Editor" theme="scdl">
        <div className="py-8 px-4 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded xp-inset flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#f0c020]" />
          </div>
          <h1 className="text-lg font-bold text-[#f0ede0]">
            Sign in with Discord to Create Rankings
          </h1>
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

  const [
    isAllowlisted,
    { data: profile },
    { data: seasons },
    { data: divisions },
    { data: divisionThemes },
    { data: editions },
    { data: teams },
    { data: seasonPlayers },
  ] = await Promise.all([
    checkUserAllowlisted(supabase),
    supabase
      .from("profiles")
      .select("username, avatar_url, discord_id, is_banned, ban_reason")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("seasons")
      .select("*, leagues ( * )")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("divisions").select("*").order("name"),
    supabase.from("division_themes").select("*").order("name"),
    supabase
      .from("editions")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("teams")
      .select("*")
      .eq("is_active", true)
      .order("default_order", { ascending: true }),
    supabase
      .from("season_players")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (!isAllowlisted) {
    return (
      <AllowlistBlockedWindow
        title="Rankings Editor — Invite Only"
        user={{
          id: user.id,
          username: profile?.username ?? "Discord User",
          avatarUrl: profile?.avatar_url ?? null,
          discordId: profile?.discord_id ?? null,
        }}
      />
    );
  }

  if (profile?.is_banned) {
    return (
      <RetroWindow title="Account Suspended" theme="scdl">
        <div className="py-8 px-4 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded xp-inset flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#ff857a]" />
          </div>
          <h1 className="text-lg font-bold text-[#ff857a]">
            Your account has been suspended
          </h1>
          <p className="text-xs text-[#c7c5b8] max-w-md mx-auto">
            {profile.ban_reason
              ? `Reason: ${profile.ban_reason}`
              : "You are no longer permitted to create or publish rankings on Rankr."}
          </p>
        </div>
      </RetroWindow>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const discordDefaultName: string =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    meta.preferred_username ||
    "Discord User";

  const matchedSeason = effectiveSeason
    ? (seasons ?? []).find((s) => s.slug === effectiveSeason)
    : undefined;
  const matchedEdition =
    matchedSeason && params.edition
      ? (editions ?? []).find(
          (e) => e.season_id === matchedSeason.id && e.slug === params.edition
        )
      : undefined;

  const initialType: CreateContentType =
    params.type === "blog" || params.edit
      ? "blog"
      : params.type === "player"
      ? "player"
      : params.type === "team"
      ? "team"
      : matchedEdition?.is_players_only
      ? "player"
      : "team";

  let initialBlog: Blog | null = null;
  if (params.edit) {
    const { data: existingBlog } = await supabase
      .from("blogs")
      .select("*")
      .eq("id", params.edit)
      .eq("user_id", user.id)
      .maybeSingle();
    initialBlog = (existingBlog as Blog | null) ?? null;
  }

  return (
    <RankWorkspace
      userId={user.id}
      initialAuthorName={profile?.username ?? discordDefaultName}
      discordDefaultName={discordDefaultName}
      seasons={seasons ?? []}
      divisions={divisions ?? []}
      themes={divisionThemes ?? []}
      editions={editions ?? []}
      teams={teams ?? []}
      seasonPlayers={seasonPlayers ?? []}
      initialType={initialType}
      initialSeasonSlug={effectiveSeason}
      initialDivisionSlug={params.division}
      initialEditionSlug={params.edition}
      initialBlog={initialBlog}
    />
  );
}

import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { AuthButton } from "@/components/AuthButton";
import { HeaderNav } from "@/components/HeaderNav";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { username: string; avatar_url: string | null; is_admin: boolean } | null =
    null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, is_admin")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const { data: seasonsData } = await supabase
    .from("seasons")
    .select("id, name, slug, is_active, leagues ( * )")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  const headerSeasons = (seasonsData ?? []).map((s) => {
    const league = Array.isArray(s.leagues) ? s.leagues[0] : s.leagues;
    const shortName =
      (league as { short_name?: string | null; slug?: string; name?: string } | null)
        ?.short_name ||
      (league?.slug === "scdl" ? "SCDL" : league?.name ?? "");
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      is_active: s.is_active,
      leagueName: shortName,
    };
  });

  return (
    <header className="xp-taskbar sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-13 flex items-center justify-between gap-2 sm:gap-3">
        <Suspense
          fallback={
            <div className="flex items-center gap-3 text-white text-sm font-bold">
              Rankr
            </div>
          }
        >
          <HeaderNav
            seasons={headerSeasons}
            isLoggedIn={Boolean(user)}
            isAdmin={Boolean(profile?.is_admin)}
          />
        </Suspense>

        <AuthButton
          user={
            user
              ? {
                  id: user.id,
                  username:
                    profile?.username ??
                    user.user_metadata?.full_name ??
                    user.user_metadata?.name ??
                    "Discord User",
                  avatarUrl:
                    profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
                }
              : null
          }
        />
      </div>
    </header>
  );
}

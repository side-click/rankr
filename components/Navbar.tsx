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

  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("require_allowlist")
    .eq("id", 1)
    .maybeSingle();

  return (
    <header className="xp-taskbar sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2 sm:gap-3">
        <HeaderNav
          isLoggedIn={Boolean(user)}
          isAdmin={Boolean(profile?.is_admin)}
        />

        <AuthButton
          requireAllowlist={Boolean(appSettings?.require_allowlist)}
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

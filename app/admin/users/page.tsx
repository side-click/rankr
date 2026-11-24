import type { Metadata } from "next";
import { AdminAccessDenied } from "@/components/AdminAccessDenied";
import { AdminUsersLog } from "@/components/AdminUsersLog";
import { RetroWindow } from "@/components/RetroWindow";
import type { AllowedDiscordUser, Profile } from "@/types/database";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export const metadata: Metadata = {
  title: "Admin Users | Rankr",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);

  if (!auth.user || !auth.isAdmin) {
    return <AdminAccessDenied />;
  }

  const [{ data: profiles }, { data: allowedUsers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("allowed_discord_users")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <RetroWindow title="Admin Console — Discord Users Log" theme="xp">
      <AdminUsersLog
        currentUserId={auth.user.id}
        initialProfiles={(profiles ?? []) as Profile[]}
        initialAllowedUsers={(allowedUsers ?? []) as AllowedDiscordUser[]}
      />
    </RetroWindow>
  );
}

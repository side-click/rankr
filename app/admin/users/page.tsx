import React from "react";
import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import { AdminUsersLog } from "@/components/AdminUsersLog";
import type { AllowedDiscordUser, Profile } from "@/types/database";
import { ShieldAlert } from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Users | Rankr",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = Boolean(profile?.is_admin);
  }

  if (!user || !isAdmin) {
    return (
      <RetroWindow title="Admin Console — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <h1 className="text-base font-bold text-[#f0ede0]">
            Admin Access Required
          </h1>
          <p className="text-xs text-[#a6a89e] max-w-md mx-auto">
            You do not have permission to access this page.
          </p>
        </div>
      </RetroWindow>
    );
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
        currentUserId={user.id}
        initialProfiles={(profiles ?? []) as Profile[]}
        initialAllowedUsers={(allowedUsers ?? []) as AllowedDiscordUser[]}
      />
    </RetroWindow>
  );
}

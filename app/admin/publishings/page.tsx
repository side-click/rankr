import React from "react";
import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import {
  AdminPublishingsLog,
  type AdminLogBallot,
} from "@/components/AdminPublishingsLog";
import type { Division, Edition, League, Season } from "@/types/database";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Publishings | Rankr",
};

export const dynamic = "force-dynamic";

export default async function AdminPublishingsPage() {
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
            Set <code className="xp-inset px-1">is_admin = true</code> on your
            row in <code className="xp-inset px-1">public.profiles</code>.
          </p>
        </div>
      </RetroWindow>
    );
  }

  const [
    { data: seasons },
    { data: divisions },
    { data: editions },
    { data: publishedBallots },
  ] = await Promise.all([
    supabase
      .from("seasons")
      .select("*, leagues ( * )")
      .order("created_at", { ascending: false }),
    supabase
      .from("divisions")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("editions")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("rankings")
      .select(
        `
        id,
        title,
        status,
        ranking_type,
        tier_variant,
        published_at,
        user_id,
        season_id,
        division_id,
        edition_id,
        division_name_snapshot,
        edition_name_snapshot,
        profiles ( id, username, discord_id, is_banned ),
        seasons ( id, name, leagues ( * ) ),
        divisions ( id, name ),
        editions ( id, name )
      `
      )
      .eq("status", "published")
      .order("published_at", { ascending: false }),
  ]);

  return (
    <RetroWindow title="Admin Console — Published Rankings Log" theme="xp">
      <AdminPublishingsLog
        initialBallots={
          (publishedBallots ?? []) as unknown as AdminLogBallot[]
        }
        seasons={(seasons ?? []) as (Season & { leagues?: League | null })[]}
        divisions={(divisions ?? []) as Division[]}
        editions={(editions ?? []) as Edition[]}
      />
    </RetroWindow>
  );
}

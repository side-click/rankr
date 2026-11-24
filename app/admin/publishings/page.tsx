import type { Metadata } from "next";
import { AdminAccessDenied } from "@/components/AdminAccessDenied";
import {
  AdminPublishingsLog,
  type AdminLogBallot,
} from "@/components/AdminPublishingsLog";
import { RetroWindow } from "@/components/RetroWindow";
import type { Division, Edition, League, Season } from "@/types/database";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export const metadata: Metadata = {
  title: "Admin Publishings | Rankr",
};

export const dynamic = "force-dynamic";

export default async function AdminPublishingsPage() {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);

  if (!auth.user || !auth.isAdmin) {
    return <AdminAccessDenied />;
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

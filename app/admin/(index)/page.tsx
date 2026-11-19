import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
    { data: leagues },
    { data: seasons },
    { data: divisions },
    { data: divisionThemes },
    { data: editions },
    { data: teams },
    { data: seasonPlayers },
    { data: appSettings },
    { data: profiles },
    { data: recentBallots },
    { data: allowedUsers },
  ] = await Promise.all([
    supabase.from("leagues").select("*").order("created_at", { ascending: true }),
    supabase.from("seasons").select("*").order("created_at", { ascending: false }),
    supabase.from("divisions").select("*").order("name"),
    supabase.from("division_themes").select("*").order("name"),
    supabase.from("editions").select("*").order("sort_order", { ascending: true }),
    supabase.from("teams").select("*").order("default_order", { ascending: true }),
    supabase
      .from("season_players")
      .select("*")
      .order("name", { ascending: true }),
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase
      .from("ballots")
      .select(
        "id, title, status, ranking_type, tier_variant, published_at, user_id, season_id, division_id, edition_id, division_name_snapshot, edition_name_snapshot, profiles ( id, username, discord_id, is_banned )"
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50),
    supabase
      .from("allowed_discord_users")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AdminDashboard
      currentUserId={user.id}
      initialLeagues={leagues ?? []}
      initialSeasons={seasons ?? []}
      initialDivisions={divisions ?? []}
      initialThemes={divisionThemes ?? []}
      initialEditions={editions ?? []}
      initialTeams={teams ?? []}
      initialSeasonPlayers={seasonPlayers ?? []}
      initialAppSettings={
        appSettings ?? {
          id: 1,
          maintenance_mode: false,
          maintenance_message:
            "Rankr is temporarily offline for maintenance. Please check back shortly.",
          require_allowlist: false,
          updated_at: new Date().toISOString(),
        }
      }
      initialProfiles={profiles ?? []}
      initialPublishedBallots={recentBallots ?? []}
      initialAllowedUsers={allowedUsers ?? []}
    />
  );
}

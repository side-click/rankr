import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { RetroWindow } from "@/components/RetroWindow";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ShieldAlert } from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Console | Rankr",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);
  const user = auth.user;

  if (!user || (!auth.isAdmin && !auth.isOperator)) {
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
    leagueOpsRes,
    leagueAllowedRes,
    teamCaptainsRes,
    seasonMatchesRes,
    backupsRes,
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
      .from("rankings")
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
    supabase
      .from("league_operators")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("league_allowed_users")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("team_captains")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("season_matches")
      .select("*")
      .order("round_number", { ascending: true }),
    supabase
      .from("season_config_backups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const opLeagueSet = new Set(auth.operatorLeagueIds);
  const scopedLeagues = auth.isAdmin
    ? leagues ?? []
    : (leagues ?? []).filter((l) => opLeagueSet.has(l.id));
  const allowedSeasonSet = new Set(
    (auth.isAdmin
      ? seasons ?? []
      : (seasons ?? []).filter((s) => opLeagueSet.has(s.league_id))
    ).map((s) => s.id)
  );
  const scopedSeasons = (seasons ?? []).filter((s) => allowedSeasonSet.has(s.id));
  const scopedDivisions = (divisions ?? []).filter((d) =>
    allowedSeasonSet.has(d.season_id)
  );
  const allowedDivSet = new Set(scopedDivisions.map((d) => d.id));
  const scopedTeams = (teams ?? []).filter((t) => allowedDivSet.has(t.division_id));
  const allowedTeamSet = new Set(scopedTeams.map((t) => t.id));

  const rawLeagueOps = !leagueOpsRes.error ? leagueOpsRes.data ?? [] : [];
  const rawLeagueAllowed = !leagueAllowedRes.error
    ? leagueAllowedRes.data ?? []
    : [];
  const rawTeamCaptains = !teamCaptainsRes.error ? teamCaptainsRes.data ?? [] : [];
  const rawMatches = !seasonMatchesRes.error ? seasonMatchesRes.data ?? [] : [];
  const rawBackups = !backupsRes.error ? backupsRes.data ?? [] : [];

  return (
    <AdminDashboard
      currentUserId={user.id}
      isSiteAdmin={auth.isAdmin}
      initialLeagues={scopedLeagues}
      initialSeasons={scopedSeasons}
      initialDivisions={scopedDivisions}
      initialThemes={divisionThemes ?? []}
      initialEditions={(editions ?? []).filter((e) =>
        allowedSeasonSet.has(e.season_id)
      )}
      initialTeams={scopedTeams}
      initialSeasonPlayers={(seasonPlayers ?? []).filter((sp) =>
        allowedSeasonSet.has(sp.season_id)
      )}
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
      initialPublishedBallots={(recentBallots ?? []).filter(
        (b) => !b.season_id || allowedSeasonSet.has(b.season_id)
      )}
      initialAllowedUsers={allowedUsers ?? []}
      initialLeagueOperators={
        auth.isAdmin
          ? rawLeagueOps
          : rawLeagueOps.filter((o) => opLeagueSet.has(o.league_id))
      }
      initialLeagueAllowedUsers={
        auth.isAdmin
          ? rawLeagueAllowed
          : rawLeagueAllowed.filter((u) => opLeagueSet.has(u.league_id))
      }
      initialTeamCaptains={rawTeamCaptains.filter((c) =>
        allowedTeamSet.has(c.team_id)
      )}
      initialSeasonMatches={rawMatches.filter((m) =>
        allowedSeasonSet.has(m.season_id)
      )}
      initialSeasonBackups={rawBackups.filter((b) =>
        allowedSeasonSet.has(b.season_id)
      )}
    />
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanupRankingOverlays } from "@/utils/blogMedia";
import { unwrap } from "@/utils/formatters";
import type { Edition, RankingType } from "@/types/database";

export interface AdminRankingProfileSummary {
  id: string;
  username: string;
  discord_id: string | null;
  is_banned: boolean;
}

export interface AdminRankingItem {
  id: string;
  title: string | null;
  status: string;
  ranking_type?: RankingType | "team" | "player" | null;
  tier_variant?: string | null;
  published_at: string | null;
  user_id: string;
  season_id: string | null;
  division_id: string | null;
  edition_id: string | null;
  division_name_snapshot: string | null;
  edition_name_snapshot: string | null;
  profiles?: AdminRankingProfileSummary | AdminRankingProfileSummary[] | null;
}

export interface ConflictingRankingInfo {
  id: string;
  title: string | null;
  status: string;
  updated_at: string;
  published_at: string | null;
}

export function buildMovedRankingTitle(
  ranking: AdminRankingItem,
  nextEdition: Edition | undefined
): string {
  if (!nextEdition) return ranking.title ?? "";
  const oldEd = ranking.edition_name_snapshot;
  if (ranking.title && oldEd && ranking.title.includes(oldEd)) {
    return ranking.title.replace(oldEd, nextEdition.name);
  }
  if (ranking.ranking_type === "player") {
    return `${
      ranking.division_name_snapshot || "All Divisions"
    } Player Tier List \u2014 ${nextEdition.name}`;
  }
  if (ranking.division_name_snapshot) {
    return `${ranking.division_name_snapshot} Team Power Rankings \u2014 ${nextEdition.name}`;
  }
  return ranking.title ?? nextEdition.name;
}

export function getEligibleTargetEditions(
  ranking: AdminRankingItem,
  editions: Edition[]
): Edition[] {
  const rankingType = ranking.ranking_type ?? "team";
  return editions
    .filter(
      (e) =>
        e.season_id === ranking.season_id &&
        e.id !== ranking.edition_id &&
        (rankingType === "player" || !e.is_players_only)
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function findTargetEditionConflict(
  supabase: SupabaseClient,
  ranking: AdminRankingItem,
  nextEditionId: string
): Promise<ConflictingRankingInfo | null> {
  if (!nextEditionId) return null;
  const rankingType = ranking.ranking_type ?? "team";
  let query = supabase
    .from("rankings")
    .select("id, title, status, updated_at, published_at")
    .eq("user_id", ranking.user_id)
    .eq("edition_id", nextEditionId)
    .eq("ranking_type", rankingType)
    .neq("id", ranking.id);

  if (ranking.division_id) {
    query = query.eq("division_id", ranking.division_id);
  } else {
    query = query.is("division_id", null);
  }
  if (rankingType === "player" && ranking.tier_variant) {
    query = query.eq("tier_variant", ranking.tier_variant);
  }

  const { data } = await query.maybeSingle();
  return (data as ConflictingRankingInfo | null) ?? null;
}

function triggerContentRevalidate() {
  fetch("/api/admin/revalidate-stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "content" }),
  }).catch(() => {});
}

export async function deleteAdminRanking(
  supabase: SupabaseClient,
  ranking: AdminRankingItem
): Promise<{ ok: boolean; statusMessage: string }> {
  const { data: row } = await supabase
    .from("rankings")
    .select("overlays")
    .eq("id", ranking.id)
    .maybeSingle();

  const { error } = await supabase
    .from("rankings")
    .delete()
    .eq("id", ranking.id);
  if (error) {
    return { ok: false, statusMessage: `Error: ${error.message}` };
  }

  if (Array.isArray(row?.overlays) && row.overlays.length > 0) {
    await cleanupRankingOverlays(supabase, row.overlays);
  }
  triggerContentRevalidate();
  return { ok: true, statusMessage: "Published ranking deleted." };
}

export async function executeMoveRankingEdition(
  supabase: SupabaseClient,
  params: {
    movingRanking: AdminRankingItem;
    targetEdition: Edition;
    moveTitle: string;
    conflictRanking: ConflictingRankingInfo | null;
    confirmOverwrite?: boolean;
  }
): Promise<{
  ok: boolean;
  cancelled?: boolean;
  nextTitle?: string;
  statusMessage?: string;
}> {
  const { movingRanking, targetEdition, moveTitle, conflictRanking, confirmOverwrite } =
    params;

  if (
    (movingRanking.ranking_type ?? "team") === "team" &&
    targetEdition.is_players_only
  ) {
    return {
      ok: false,
      statusMessage: `Cannot move a Team Power Ranking into Players-Only edition "${targetEdition.name}".`,
    };
  }

  if (conflictRanking) {
    if (!confirmOverwrite) {
      return { ok: false, cancelled: true };
    }
    const author = unwrap(movingRanking.profiles);
    const confirmedSecond = confirm(
      `FINAL WARNING: Permanently DELETE ${
        author?.username ?? "this user"
      }'s existing ${conflictRanking.status.toUpperCase()} ranking "${
        conflictRanking.title || targetEdition.name
      }" in ${targetEdition.name} and replace it with this ranking? This cannot be undone.`
    );
    if (!confirmedSecond) {
      return { ok: false, cancelled: true };
    }

    const { error: delErr } = await supabase
      .from("rankings")
      .delete()
      .eq("id", conflictRanking.id);
    if (delErr) {
      return {
        ok: false,
        statusMessage: `Error removing conflicting ranking: ${delErr.message}`,
      };
    }
  }

  const nextTitle = moveTitle.trim() || movingRanking.title || targetEdition.name;
  const { error: updErr } = await supabase
    .from("rankings")
    .update({
      edition_id: targetEdition.id,
      edition_name_snapshot: targetEdition.name,
      title: nextTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", movingRanking.id);

  if (updErr) {
    return {
      ok: false,
      statusMessage: `Error moving ranking: ${updErr.message}`,
    };
  }

  triggerContentRevalidate();
  return {
    ok: true,
    nextTitle,
    statusMessage: conflictRanking
      ? `Moved ranking to "${targetEdition.name}" (overwrote existing version).`
      : `Moved ranking to "${targetEdition.name}".`,
  };
}

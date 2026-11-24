import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/utils/auth-allowlist";
import { cleanupRankingOverlays } from "@/utils/blogMedia";
import {
  formatBlockedMessage,
  type ModerationFieldInput,
} from "@/utils/contentModeration";
import { evaluateContentModerationServer } from "@/utils/contentModerationServer";
import {
  getServiceRoleClient,
  logModerationEvent,
  sendModerationWebhook,
} from "@/utils/moderationServer";
import {
  dispatchPublishedBlogNotification,
  dispatchPublishedRankingNotification,
} from "@/utils/publishNotifications";
import { normalizeRoster } from "@/utils/roles";
import { sanitizeExternalUrl } from "@/utils/sanitizeUrl";
import { createClient } from "@/utils/supabase/server";
import type {
  PlayerTierListPayload,
  RankingOverlay,
  TierVariant,
} from "@/types/database";

interface TeamRankingEntryInput {
  teamId: string;
  previousRank: number | null;
  commentary: string;
}

type PublishRequestBody =
  | {
      kind: "team_ranking";
      targetStatus: "draft" | "published";
      existingId?: string | null;
      seasonId: string;
      divisionId: string;
      editionId: string;
      authorName?: string | null;
      authorNotes?: string;
      entries: TeamRankingEntryInput[];
    }
  | {
      kind: "player_tier";
      targetStatus: "draft" | "published";
      existingId?: string | null;
      seasonId: string;
      divisionScope: string;
      editionId: string;
      tierVariant: TierVariant;
      tierData: PlayerTierListPayload;
      authorName?: string | null;
      authorNotes?: string;
    }
  | {
      kind: "blog";
      targetStatus: "draft" | "published";
      existingId?: string | null;
      seasonId?: string | null;
      authorName?: string | null;
      title: string;
      subtitle?: string | null;
      bannerUrl?: string | null;
      content: string;
    }
  | {
      kind: "overlays";
      rankingId: string;
      overlays: RankingOverlay[];
    };

function isAllowedByLeagueCheck(params: {
  isAdmin: boolean;
  isOperatorForLeague: boolean;
  leagueRequireAllowlist: boolean;
  discordId: string | null;
  isUserInLeagueAllowlist: boolean;
}): boolean {
  if (params.isAdmin || params.isOperatorForLeague) return true;
  if (!params.leagueRequireAllowlist) return true;
  return Boolean(params.discordId && params.isUserInLeagueAllowlist);
}

async function checkCreatorPermission(
  adminDb: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  userId: string,
  leagueId: string | null
) {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    adminDb
      .from("profiles")
      .select("id, discord_id, username, is_admin, is_banned")
      .eq("id", userId)
      .maybeSingle(),
    adminDb
      .from("app_settings")
      .select("maintenance_mode, require_allowlist")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (!profile) {
    return { ok: false as const, status: 403, error: "Profile not found." };
  }
  if (profile.is_banned) {
    return {
      ok: false as const,
      status: 403,
      error: "Your account has been suspended from posting or editing.",
    };
  }
  const isAdmin = Boolean(profile.is_admin);
  if (settings?.maintenance_mode && !isAdmin) {
    return {
      ok: false as const,
      status: 403,
      error: "Rankr is temporarily offline for maintenance.",
    };
  }

  const discordId = profile.discord_id ? String(profile.discord_id) : null;

  if (!leagueId) {
    if (!isAdmin && settings?.require_allowlist) {
      if (!discordId) {
        return { ok: false as const, status: 403, error: "Not authorized." };
      }
      const { data: globalRow } = await adminDb
        .from("allowed_discord_users")
        .select("discord_id")
        .eq("discord_id", discordId)
        .maybeSingle();
      if (!globalRow) {
        return { ok: false as const, status: 403, error: "Not authorized." };
      }
    }
    return {
      ok: true as const,
      profile,
      discordId,
      isAdmin,
    };
  }

  const [{ data: league }, opRes, allowedRes] = await Promise.all([
    adminDb
      .from("leagues")
      .select("id, require_allowlist")
      .eq("id", leagueId)
      .maybeSingle(),
    discordId
      ? adminDb
          .from("league_operators")
          .select("id")
          .eq("league_id", leagueId)
          .eq("discord_id", discordId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    discordId
      ? adminDb
          .from("league_allowed_users")
          .select("id")
          .eq("league_id", leagueId)
          .eq("discord_id", discordId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!league) {
    return { ok: false as const, status: 404, error: "League not found." };
  }

  const allowed = isAllowedByLeagueCheck({
    isAdmin,
    isOperatorForLeague: Boolean(opRes.data),
    leagueRequireAllowlist: Boolean(league.require_allowlist),
    discordId,
    isUserInLeagueAllowlist: Boolean(allowedRes.data),
  });

  if (!allowed) {
    return {
      ok: false as const,
      status: 403,
      error: "You do not have creator access for this league.",
    };
  }

  return {
    ok: true as const,
    profile,
    discordId,
    isAdmin,
  };
}

async function handleBlockedContent(params: {
  userId: string;
  username: string;
  discordId: string | null;
  contentType: "ranking" | "tierlist" | "blog";
  contentId?: string | null;
  title: string;
  blockedFields: string[];
  categories: string[];
  matchedTerms: string[];
}) {
  const {
    userId,
    username,
    discordId,
    contentType,
    contentId,
    title,
    blockedFields,
    categories,
    matchedTerms,
  } = params;

  await Promise.all([
    logModerationEvent({
      userId,
      contentType,
      contentId: contentId ?? null,
      action: "blocked",
      categories,
      fieldNames: blockedFields,
      matchedTerms,
      titleSnapshot: title,
    }),
    sendModerationWebhook({
      title: "🛡️ Blocked Publish Attempt",
      color: 0xe84a1b,
      description: `**${title || `Untitled (${contentType})`}**\nServer publish check blocked prohibited content from going live.`,
      pingModerator: true,
      fields: [
        {
          name: "Author",
          value: `${username} (${discordId ?? "N/A"})`,
          inline: true,
        },
        {
          name: "Content Type",
          value: contentType,
          inline: true,
        },
        {
          name: "Blocked Fields",
          value: blockedFields.join(", ") || "Unknown",
          inline: false,
        },
        {
          name: "Matched / Categories",
          value:
            matchedTerms.length > 0
              ? `${categories.join(", ")} (\`${matchedTerms.join("`, `")}\`)`
              : categories.join(", ") || "prohibited",
          inline: false,
        },
      ],
    }),
  ]);

  const message = formatBlockedMessage(blockedFields);
  return NextResponse.json(
    {
      ok: false,
      blocked: true,
      blockedFields,
      message,
      error: message,
    },
    { status: 422 }
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = getServiceRoleClient();
  if (!adminDb) {
    return NextResponse.json(
      { error: "Server publish configuration is incomplete." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as PublishRequestBody | null;
  if (!body || !("kind" in body)) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const origin = getRequestOrigin(request);
  const now = new Date().toISOString();

  // 1. Overlays update on an existing ranking / tier list
  if (body.kind === "overlays") {
    const rankingId = String(body.rankingId ?? "").trim();
    if (!rankingId) {
      return NextResponse.json({ error: "rankingId is required." }, { status: 400 });
    }

    const { data: existing } = await adminDb
      .from("rankings")
      .select(
        "id, user_id, season_id, status, ranking_type, title, author_notes, tier_data, overlays, league_name_snapshot, season_name_snapshot"
      )
      .eq("id", rankingId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Ranking not found." }, { status: 404 });
    }

    const { data: seasonRow } = existing.season_id
      ? await adminDb
          .from("seasons")
          .select("league_id")
          .eq("id", existing.season_id)
          .maybeSingle()
      : { data: null };

    const perm = await checkCreatorPermission(
      adminDb,
      user.id,
      seasonRow?.league_id ?? null
    );
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status });
    }

    if (existing.user_id !== user.id && !perm.isAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const incomingOverlays = Array.isArray(body.overlays)
      ? body.overlays.slice(0, 12)
      : [];
    const sanitizedOverlays: RankingOverlay[] = [];
    for (const o of incomingOverlays) {
      const safeUrl = sanitizeExternalUrl(o?.url);
      if (!safeUrl) continue;
      sanitizedOverlays.push({
        id: String(o.id ?? "").slice(0, 64) || crypto.randomUUID(),
        url: safeUrl,
        x: Math.max(-10, Math.min(100, Number(o.x ?? 38))),
        y: Math.max(-10, Math.min(100, Number(o.y ?? 25))),
        width: Math.max(4, Math.min(80, Number(o.width ?? 18))),
      });
    }

    const keptUrls = new Set(sanitizedOverlays.map((o) => o.url));
    const oldOverlays = Array.isArray(existing.overlays)
      ? (existing.overlays as { url?: string | null }[])
      : [];
    const removedOverlays = oldOverlays.filter(
      (o) => o?.url && !keptUrls.has(o.url)
    );
    if (removedOverlays.length > 0) {
      await cleanupRankingOverlays(adminDb, removedOverlays);
    }

    const { error: upErr } = await adminDb
      .from("rankings")
      .update({
        overlays: sanitizedOverlays,
        updated_at: now,
      })
      .eq("id", rankingId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    revalidateTag("home-stats");
    revalidateTag("browse-content");

    if (sanitizedOverlays.length > 0 && existing.status === "published") {
      const isPlayer = existing.ranking_type === "player";
      const tierData = existing.tier_data as PlayerTierListPayload | null;
      const fields: ModerationFieldInput[] = [
        { field: "Username", value: perm.profile.username },
        { field: "Title", value: existing.title },
        { field: "General Notes", value: existing.author_notes },
        ...(tierData?.sections ?? []).flatMap((sec) =>
          sec.tiers.flatMap((t) => [
            { field: `Tier Name (${t.label || "Untitled"})`, value: t.label },
            {
              field: `Tier Notes (${t.label || "Untitled"})`,
              value: t.commentary,
            },
          ])
        ),
      ];
      const mod = await evaluateContentModerationServer(fields);
      await dispatchPublishedRankingNotification({
        origin,
        userId: user.id,
        rankingId,
        isPlayer,
        title:
          existing.title ||
          (isPlayer ? "Player Tier List" : "Team Power Rankings"),
        username: perm.profile.username,
        discordId: perm.discordId,
        leagueNameSnapshot: existing.league_name_snapshot ?? null,
        seasonNameSnapshot: existing.season_name_snapshot ?? null,
        overlayCount: sanitizedOverlays.length,
        mod,
      });
    }

    return NextResponse.json({ ok: true, overlays: sanitizedOverlays });
  }

  // 2. Blog publish / unpublish
  if (body.kind === "blog") {
    const trimmedTitle = String(body.title ?? "").trim();
    const content = String(body.content ?? "");
    const targetStatus = body.targetStatus === "published" ? "published" : "draft";
    const seasonId = body.seasonId ? String(body.seasonId).trim() : null;

    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "Please enter a title for your blog post." },
        { status: 400 }
      );
    }
    if (targetStatus === "published" && !content.trim()) {
      return NextResponse.json(
        { error: "Please write some content before publishing." },
        { status: 400 }
      );
    }

    const { data: seasonRow } = seasonId
      ? await adminDb
          .from("seasons")
          .select("id, name, league_id, leagues ( name )")
          .eq("id", seasonId)
          .maybeSingle()
      : { data: null };

    if (seasonId && !seasonRow) {
      return NextResponse.json({ error: "Season not found." }, { status: 404 });
    }

    const perm = await checkCreatorPermission(
      adminDb,
      user.id,
      seasonRow?.league_id ?? null
    );
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status });
    }

    const displayAuthor =
      body.authorName?.trim() || perm.profile.username || "Discord User";
    const cleanSubtitle = body.subtitle?.trim() || null;
    const cleanBanner = body.bannerUrl?.trim()
      ? sanitizeExternalUrl(body.bannerUrl.trim(), { allowRelative: true })
      : null;
    if (body.bannerUrl?.trim() && !cleanBanner) {
      return NextResponse.json(
        { error: "Banner URL must be a valid http(s) URL." },
        { status: 400 }
      );
    }

    let modResult: Awaited<ReturnType<typeof evaluateContentModerationServer>> | null =
      null;
    if (targetStatus === "published") {
      modResult = await evaluateContentModerationServer(
        [
          { field: "Username", value: perm.profile.username },
          { field: "Author Name", value: displayAuthor },
          { field: "Title", value: trimmedTitle },
          { field: "Subtitle", value: cleanSubtitle },
          { field: "Blog Body", value: content },
        ],
        { markdownContent: content }
      );
      if (modResult.action === "block") {
        return handleBlockedContent({
          userId: user.id,
          username: perm.profile.username,
          discordId: perm.discordId,
          contentType: "blog",
          contentId: body.existingId ?? null,
          title: trimmedTitle,
          blockedFields: modResult.blockedFields,
          categories: modResult.categories,
          matchedTerms: modResult.matchedTerms,
        });
      }
    }

    let publishedAtValue: string | null = null;
    if (body.existingId) {
      const { data: existingBlog } = await adminDb
        .from("blogs")
        .select("id, user_id, published_at")
        .eq("id", body.existingId)
        .maybeSingle();

      if (!existingBlog) {
        return NextResponse.json({ error: "Blog not found." }, { status: 404 });
      }
      if (existingBlog.user_id !== user.id && !perm.isAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      publishedAtValue =
        targetStatus === "published"
          ? existingBlog.published_at ?? now
          : null;
    } else if (targetStatus === "published") {
      publishedAtValue = now;
    }

    const leagueRel = seasonRow?.leagues as
      | { name?: string }
      | { name?: string }[]
      | null
      | undefined;
    const leagueNameSnapshot = Array.isArray(leagueRel)
      ? leagueRel[0]?.name ?? null
      : leagueRel?.name ?? null;
    const seasonNameSnapshot = seasonRow?.name ?? null;

    const payload = {
      user_id: user.id,
      author_name: displayAuthor,
      title: trimmedTitle,
      subtitle: cleanSubtitle,
      banner_url: cleanBanner,
      content,
      season_id: seasonId,
      season_name_snapshot: seasonNameSnapshot,
      league_name_snapshot: leagueNameSnapshot,
      status: targetStatus,
      published_at: publishedAtValue,
      updated_at: now,
    };

    let savedId = body.existingId ? String(body.existingId) : null;
    if (savedId) {
      const { error } = await adminDb
        .from("blogs")
        .update(payload)
        .eq("id", savedId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { data: inserted, error } = await adminDb
        .from("blogs")
        .insert(payload)
        .select("id")
        .single();
      if (error || !inserted) {
        return NextResponse.json(
          { error: error?.message ?? "Failed to create blog." },
          { status: 500 }
        );
      }
      savedId = inserted.id;
    }

    revalidateTag("home-stats");
    revalidateTag("browse-content");

    if (targetStatus === "published" && modResult && savedId) {
      await dispatchPublishedBlogNotification({
        origin,
        userId: user.id,
        blogId: savedId,
        title: trimmedTitle,
        authorDisplay: displayAuthor || perm.profile.username,
        discordId: perm.discordId,
        leagueNameSnapshot,
        seasonNameSnapshot,
        hasBanner: Boolean(cleanBanner),
        mod: modResult,
      });
    }

    return NextResponse.json({ ok: true, id: savedId, status: targetStatus });
  }

  // 3. Team Ranking or Player Tier List publish / unpublish
  const seasonId = String(body.seasonId ?? "").trim();
  const editionId = String(body.editionId ?? "").trim();
  const targetStatus = body.targetStatus === "published" ? "published" : "draft";

  if (!seasonId || !editionId) {
    return NextResponse.json(
      { error: "seasonId and editionId are required." },
      { status: 400 }
    );
  }

  const [{ data: seasonRow }, { data: editionRow }] = await Promise.all([
    adminDb
      .from("seasons")
      .select("id, name, league_id, leagues ( name, short_name )")
      .eq("id", seasonId)
      .maybeSingle(),
    adminDb
      .from("editions")
      .select("id, name, season_id, is_open, is_archived, is_players_only")
      .eq("id", editionId)
      .maybeSingle(),
  ]);

  if (!seasonRow || !editionRow || editionRow.season_id !== seasonId) {
    return NextResponse.json(
      { error: "Season or edition not found." },
      { status: 404 }
    );
  }

  const perm = await checkCreatorPermission(
    adminDb,
    user.id,
    String(seasonRow.league_id)
  );
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  if (editionRow.is_archived) {
    return NextResponse.json(
      { error: "This edition is archived and read-only." },
      { status: 403 }
    );
  }
  if (targetStatus === "published" && !editionRow.is_open) {
    return NextResponse.json(
      { error: "This edition is currently locked for publishing." },
      { status: 403 }
    );
  }
  if (body.kind === "team_ranking" && editionRow.is_players_only) {
    return NextResponse.json(
      { error: "This edition only accepts player tier lists." },
      { status: 400 }
    );
  }

  // Optionally update author display name safely (never updates privileged columns)
  const resolvedAuthor =
    body.authorName?.trim() || perm.profile.username || "Discord User";
  if (resolvedAuthor !== perm.profile.username) {
    if (targetStatus === "published") {
      const nameMod = await evaluateContentModerationServer([
        { field: "Author Name", value: resolvedAuthor },
      ]);
      if (nameMod.action === "block") {
        return handleBlockedContent({
          userId: user.id,
          username: resolvedAuthor,
          discordId: perm.discordId,
          contentType: body.kind === "player_tier" ? "tierlist" : "ranking",
          contentId: body.existingId ?? null,
          title: "Display Name",
          blockedFields: nameMod.blockedFields,
          categories: nameMod.categories,
          matchedTerms: nameMod.matchedTerms,
        });
      }
    }
    const { error: profErr } = await adminDb
      .from("profiles")
      .update({ username: resolvedAuthor, updated_at: now })
      .eq("id", user.id);
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
  }

  const leagueRel = seasonRow.leagues as
    | { name?: string; short_name?: string | null }
    | { name?: string; short_name?: string | null }[]
    | null
    | undefined;
  const currentLeague = Array.isArray(leagueRel) ? leagueRel[0] : leagueRel;

  if (body.kind === "team_ranking") {
    const divisionId = String(body.divisionId ?? "").trim();
    const { data: divisionRow } = await adminDb
      .from("divisions")
      .select("id, name, season_id, logo_url, theme_key")
      .eq("id", divisionId)
      .maybeSingle();

    if (!divisionRow || divisionRow.season_id !== seasonId) {
      return NextResponse.json(
        { error: "Division not found for this season." },
        { status: 404 }
      );
    }

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "At least one ranked team entry is required." },
        { status: 400 }
      );
    }

    const { data: divTeams } = await adminDb
      .from("teams")
      .select("id, division_id, name, logo_url, roster, captain")
      .eq("division_id", divisionId);

    const teamMap = new Map((divTeams ?? []).map((t) => [t.id, t]));
    for (const entry of entries) {
      if (!teamMap.has(entry.teamId)) {
        return NextResponse.json(
          { error: "Invalid team included in ranking." },
          { status: 400 }
        );
      }
    }

    const defaultTitle = `${divisionRow.name} — ${editionRow.name}`;
    const authorNotes = String(body.authorNotes ?? "").trim();

    let modResult: Awaited<ReturnType<typeof evaluateContentModerationServer>> | null =
      null;
    if (targetStatus === "published") {
      modResult = await evaluateContentModerationServer([
        { field: "Author Name", value: resolvedAuthor },
        { field: "Title", value: defaultTitle },
        { field: "General Notes", value: authorNotes },
        ...entries.map((item) => ({
          field: `${teamMap.get(item.teamId)?.name ?? "Team"} Commentary`,
          value: item.commentary,
        })),
      ]);
      if (modResult.action === "block") {
        return handleBlockedContent({
          userId: user.id,
          username: resolvedAuthor,
          discordId: perm.discordId,
          contentType: "ranking",
          contentId: body.existingId ?? null,
          title: defaultTitle,
          blockedFields: modResult.blockedFields,
          categories: modResult.categories,
          matchedTerms: modResult.matchedTerms,
        });
      }
    }

    let targetRankingId = body.existingId ? String(body.existingId).trim() : null;
    if (targetRankingId) {
      const { data: owned } = await adminDb
        .from("rankings")
        .select("id, user_id")
        .eq("id", targetRankingId)
        .maybeSingle();
      if (!owned || (owned.user_id !== user.id && !perm.isAdmin)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    } else {
      const { data: existingRow } = await adminDb
        .from("rankings")
        .select("id")
        .eq("user_id", user.id)
        .eq("season_id", seasonId)
        .eq("division_id", divisionId)
        .eq("edition_id", editionId)
        .eq("ranking_type", "team")
        .maybeSingle();
      if (existingRow?.id) targetRankingId = existingRow.id;
    }

    const payload = {
      user_id: user.id,
      season_id: seasonId,
      division_id: divisionId,
      edition_id: editionId,
      ranking_type: "team" as const,
      title: defaultTitle,
      author_notes: authorNotes,
      status: targetStatus,
      published_at: targetStatus === "published" ? now : null,
      league_name_snapshot: currentLeague?.name ?? null,
      season_name_snapshot: seasonRow.name ?? null,
      division_name_snapshot: divisionRow.name ?? null,
      division_logo_snapshot: divisionRow.logo_url ?? null,
      division_theme_snapshot: divisionRow.theme_key ?? null,
      edition_name_snapshot: editionRow.name ?? null,
      updated_at: now,
    };

    const rankingRes = targetRankingId
      ? await adminDb
          .from("rankings")
          .update(payload)
          .eq("id", targetRankingId)
          .select("id, status, overlays")
          .single()
      : await adminDb
          .from("rankings")
          .insert(payload)
          .select("id, status, overlays")
          .single();

    if (rankingRes.error || !rankingRes.data) {
      return NextResponse.json(
        { error: rankingRes.error?.message ?? "Failed to save ranking." },
        { status: 500 }
      );
    }

    const savedId = rankingRes.data.id;
    const { error: delErr } = await adminDb
      .from("ranking_entries")
      .delete()
      .eq("ranking_id", savedId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const entriesToInsert = entries.map((item, idx) => {
      const rank = idx + 1;
      const team = teamMap.get(item.teamId)!;
      const rankChange =
        item.previousRank !== null && item.previousRank !== undefined
          ? item.previousRank - rank
          : null;
      return {
        ranking_id: savedId,
        team_id: team.id,
        rank,
        previous_rank: item.previousRank ?? null,
        rank_change: rankChange,
        commentary: String(item.commentary ?? ""),
        team_name_snapshot: team.name,
        team_logo_snapshot: team.logo_url ?? null,
        roster_snapshot: normalizeRoster(team.roster, team.captain),
      };
    });

    const { error: insErr } = await adminDb
      .from("ranking_entries")
      .insert(entriesToInsert);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    revalidateTag("home-stats");
    revalidateTag("browse-content");
    revalidateTag("consensus-data");

    if (targetStatus === "published" && modResult) {
      const overlays = Array.isArray(rankingRes.data.overlays)
        ? rankingRes.data.overlays
        : [];
      await dispatchPublishedRankingNotification({
        origin,
        userId: user.id,
        rankingId: savedId,
        isPlayer: false,
        title: defaultTitle,
        username: resolvedAuthor,
        discordId: perm.discordId,
        leagueNameSnapshot: currentLeague?.name ?? null,
        seasonNameSnapshot: seasonRow.name ?? null,
        overlayCount: overlays.length,
        mod: modResult,
      });
    }

    return NextResponse.json({
      ok: true,
      id: savedId,
      status: rankingRes.data.status,
    });
  }

  // 4. Player Tier List publish / unpublish
  const divisionScope = String(body.divisionScope ?? "all").trim();
  const dbDivisionId = divisionScope === "all" ? null : divisionScope;
  const divisionRow = dbDivisionId
    ? (
        await adminDb
          .from("divisions")
          .select("id, name, season_id, logo_url, theme_key")
          .eq("id", dbDivisionId)
          .maybeSingle()
      ).data
    : null;

  if (dbDivisionId && (!divisionRow || divisionRow.season_id !== seasonId)) {
    return NextResponse.json(
      { error: "Division not found for this season." },
      { status: 404 }
    );
  }

  const scopeTitle =
    divisionScope === "all"
      ? `${currentLeague?.short_name || currentLeague?.name || seasonRow.name || "League"} Player Tier List`
      : `${divisionRow?.name ?? "Division"} Player Tier List`;
  const defaultTitle = `${scopeTitle} — ${editionRow.name}`;
  const authorNotes = String(body.authorNotes ?? "").trim();
  const tierPayload = body.tierData;

  let modResult: Awaited<ReturnType<typeof evaluateContentModerationServer>> | null =
    null;
  if (targetStatus === "published") {
    modResult = await evaluateContentModerationServer([
      { field: "Author Name", value: resolvedAuthor },
      { field: "Title", value: defaultTitle },
      { field: "General Notes", value: authorNotes },
      ...(tierPayload?.sections ?? []).flatMap((sec) =>
        sec.tiers.flatMap((t) => [
          {
            field: `Tier "${t.label || "Untitled"}" Name`,
            value: t.label,
          },
          {
            field: `Tier "${t.label || "Untitled"}" Notes`,
            value: t.commentary,
          },
        ])
      ),
    ]);
    if (modResult.action === "block") {
      return handleBlockedContent({
        userId: user.id,
        username: resolvedAuthor,
        discordId: perm.discordId,
        contentType: "tierlist",
        contentId: body.existingId ?? null,
        title: defaultTitle,
        blockedFields: modResult.blockedFields,
        categories: modResult.categories,
        matchedTerms: modResult.matchedTerms,
      });
    }
  }

  let targetRankingId = body.existingId ? String(body.existingId).trim() : null;
  if (targetRankingId) {
    const { data: owned } = await adminDb
      .from("rankings")
      .select("id, user_id")
      .eq("id", targetRankingId)
      .maybeSingle();
    if (!owned || (owned.user_id !== user.id && !perm.isAdmin)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  } else {
    let lookup = adminDb
      .from("rankings")
      .select("id")
      .eq("user_id", user.id)
      .eq("season_id", seasonId)
      .eq("edition_id", editionId)
      .eq("ranking_type", "player")
      .eq("tier_variant", body.tierVariant);
    lookup = dbDivisionId
      ? lookup.eq("division_id", dbDivisionId)
      : lookup.is("division_id", null);
    const { data: existingRow } = await lookup.maybeSingle();
    if (existingRow?.id) targetRankingId = existingRow.id;
  }

  const payload = {
    user_id: user.id,
    season_id: seasonId,
    division_id: dbDivisionId,
    edition_id: editionId,
    ranking_type: "player" as const,
    tier_variant: body.tierVariant,
    tier_data: tierPayload,
    title: defaultTitle,
    author_notes: authorNotes,
    status: targetStatus,
    published_at: targetStatus === "published" ? now : null,
    league_name_snapshot: currentLeague?.name ?? null,
    season_name_snapshot: seasonRow.name ?? null,
    division_name_snapshot:
      divisionScope === "all" ? null : divisionRow?.name ?? null,
    division_logo_snapshot:
      divisionScope === "all" ? null : divisionRow?.logo_url ?? null,
    division_theme_snapshot:
      divisionScope === "all" ? "scdl" : divisionRow?.theme_key ?? null,
    edition_name_snapshot: editionRow.name ?? null,
    updated_at: now,
  };

  const tierRes = targetRankingId
    ? await adminDb
        .from("rankings")
        .update(payload)
        .eq("id", targetRankingId)
        .select("id, status, overlays")
        .single()
    : await adminDb
        .from("rankings")
        .insert(payload)
        .select("id, status, overlays")
        .single();

  if (tierRes.error || !tierRes.data) {
    return NextResponse.json(
      { error: tierRes.error?.message ?? "Failed to save tier list." },
      { status: 500 }
    );
  }

  const savedId = tierRes.data.id;

  if (targetStatus === "published") {
    let unpubQuery = adminDb
      .from("rankings")
      .update({ status: "draft", published_at: null })
      .eq("user_id", user.id)
      .eq("season_id", seasonId)
      .eq("edition_id", editionId)
      .eq("ranking_type", "player")
      .eq("status", "published")
      .neq("id", savedId);
    unpubQuery = dbDivisionId
      ? unpubQuery.eq("division_id", dbDivisionId)
      : unpubQuery.is("division_id", null);
    await unpubQuery;
  }

  revalidateTag("home-stats");
  revalidateTag("browse-content");

  if (targetStatus === "published" && modResult) {
    const overlays = Array.isArray(tierRes.data.overlays)
      ? tierRes.data.overlays
      : [];
    await dispatchPublishedRankingNotification({
      origin,
      userId: user.id,
      rankingId: savedId,
      isPlayer: true,
      title: defaultTitle,
      username: resolvedAuthor,
      discordId: perm.discordId,
      leagueNameSnapshot: currentLeague?.name ?? null,
      seasonNameSnapshot: seasonRow.name ?? null,
      overlayCount: overlays.length,
      mod: modResult,
    });
  }

  return NextResponse.json({
    ok: true,
    id: savedId,
    status: tierRes.data.status,
  });
}

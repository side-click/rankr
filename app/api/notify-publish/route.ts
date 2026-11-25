import { NextResponse } from "next/server";
import type { PlayerTierListPayload } from "@/types/database";
import { getRequestOrigin } from "@/utils/auth-allowlist";
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
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    ballotId?: string;
    blogId?: string;
  } | null;
  const ballotId = body?.ballotId;
  const blogId = body?.blogId;
  if (!ballotId && !blogId) {
    return NextResponse.json(
      { error: "Missing ballotId or blogId" },
      { status: 400 }
    );
  }

  const origin = getRequestOrigin(request);

  if (blogId) {
    const [{ data: blog }, { data: profile }] = await Promise.all([
      supabase
        .from("blogs")
        .select(
          "id, title, subtitle, content, banner_url, author_name, status, user_id, season_id, league_name_snapshot, season_name_snapshot, seasons ( league_id )"
        )
        .eq("id", blogId)
        .eq("user_id", user.id)
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("username, discord_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (!blog) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const blogSeason = Array.isArray(blog.seasons)
      ? blog.seasons[0]
      : blog.seasons;
    const blogLeagueId =
      (blogSeason as { league_id?: string } | null)?.league_id ?? null;

    const mod = await evaluateContentModerationServer(
      [
        { field: "Username", value: profile?.username },
        { field: "Author Name", value: blog.author_name },
        { field: "Title", value: blog.title },
        { field: "Subtitle", value: blog.subtitle },
        { field: "Blog Body", value: blog.content },
      ],
      { markdownContent: blog.content }
    );

    if (mod.action === "block") {
      const adminDb = getServiceRoleClient();
      if (adminDb) {
        await adminDb
          .from("blogs")
          .update({ status: "draft", published_at: null })
          .eq("id", blog.id);
      }

      await Promise.all([
        logModerationEvent({
          userId: user.id,
          contentType: "blog",
          contentId: blog.id,
          leagueId: blogLeagueId,
          action: "auto_unpublished",
          categories: mod.categories,
          fieldNames: mod.blockedFields,
          matchedTerms: mod.matchedTerms,
          titleSnapshot: blog.title,
        }),
        sendModerationWebhook({
          title: "🚨 Auto-Unpublished Blog (Prohibited Content)",
          color: 0xe84a1b,
          description: `**${blog.title}**\nServer check detected Tier 1 prohibited content and reverted the blog to \`draft\`.`,
          pingModerator: true,
          fields: [
            {
              name: "Author",
              value: `${blog.author_name || profile?.username || "Unknown"} (${
                profile?.discord_id ?? "N/A"
              })`,
              inline: true,
            },
            {
              name: "Fields",
              value: mod.blockedFields.join(", ") || "Unknown",
              inline: true,
            },
            {
              name: "Matched Terms",
              value: `\`${mod.matchedTerms.join("`, `")}\``,
              inline: false,
            },
          ],
        }),
      ]);

      return NextResponse.json({ ok: true, blocked: true });
    }

    const res = await dispatchPublishedBlogNotification({
      origin,
      userId: user.id,
      blogId: blog.id,
      leagueId: blogLeagueId,
      title: blog.title,
      authorDisplay: blog.author_name || profile?.username || "Unknown",
      discordId: profile?.discord_id ?? null,
      leagueNameSnapshot: blog.league_name_snapshot ?? null,
      seasonNameSnapshot: blog.season_name_snapshot ?? null,
      hasBanner: Boolean(blog.banner_url?.trim()),
      mod,
    });

    return NextResponse.json({ ok: true, flagged: res.flagged });
  }

  const [{ data: ballot }, { data: entries }, { data: profile }] =
    await Promise.all([
      supabase
        .from("rankings")
        .select(
          "id, title, status, ranking_type, tier_data, user_id, season_id, author_notes, overlays, league_name_snapshot, season_name_snapshot, seasons ( league_id )"
        )
        .eq("id", ballotId)
        .eq("user_id", user.id)
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("ranking_entries")
        .select("team_name_snapshot, commentary")
        .eq("ranking_id", ballotId),
      supabase
        .from("profiles")
        .select("username, discord_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (!ballot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ballotSeason = Array.isArray(ballot.seasons)
    ? ballot.seasons[0]
    : ballot.seasons;
  const ballotLeagueId =
    (ballotSeason as { league_id?: string } | null)?.league_id ?? null;

  const isPlayer = ballot.ranking_type === "player";
  const contentType = isPlayer ? "tierlist" : "ranking";
  const tierData = ballot.tier_data as PlayerTierListPayload | null;

  const mod = await evaluateContentModerationServer([
    { field: "Username", value: profile?.username },
    { field: "Title", value: ballot.title },
    { field: "General Notes", value: ballot.author_notes },
    ...(entries ?? []).map((e) => ({
      field: `${e.team_name_snapshot ?? "Team"} Commentary`,
      value: e.commentary,
    })),
    ...(tierData?.sections ?? []).flatMap((sec) =>
      sec.tiers.flatMap((t) => [
        { field: `Tier Name (${t.label || "Untitled"})`, value: t.label },
        {
          field: `Tier Notes (${t.label || "Untitled"})`,
          value: t.commentary,
        },
      ])
    ),
  ]);

  const overlayCount = Array.isArray(ballot.overlays)
    ? ballot.overlays.length
    : 0;

  if (mod.action === "block") {
    const adminDb = getServiceRoleClient();
    if (adminDb) {
      await adminDb
        .from("rankings")
        .update({ status: "draft", published_at: null })
        .eq("id", ballot.id);
    }

    await Promise.all([
      logModerationEvent({
        userId: user.id,
        contentType,
        contentId: ballot.id,
        leagueId: ballotLeagueId,
        action: "auto_unpublished",
        categories: mod.categories,
        fieldNames: mod.blockedFields,
        matchedTerms: mod.matchedTerms,
        titleSnapshot: ballot.title,
      }),
      sendModerationWebhook({
        title: "🚨 Auto-Unpublished Ranking (Prohibited Content)",
        color: 0xe84a1b,
        description: `**${
          ballot.title ||
          (isPlayer ? "Player Tier List" : "Team Power Rankings")
        }**\nServer check detected Tier 1 prohibited content and reverted the ${contentType} to \`draft\`.`,
        pingModerator: true,
        fields: [
          {
            name: "Author",
            value: `${profile?.username ?? "Unknown"} (${
              profile?.discord_id ?? "N/A"
            })`,
            inline: true,
          },
          {
            name: "Fields",
            value: mod.blockedFields.join(", ") || "Unknown",
            inline: true,
          },
          {
            name: "Matched Terms",
            value: `\`${mod.matchedTerms.join("`, `")}\``,
            inline: false,
          },
        ],
      }),
    ]);

    return NextResponse.json({ ok: true, blocked: true });
  }

  const displayTitle =
    ballot.title || (isPlayer ? "Player Tier List" : "Team Power Rankings");
  const res = await dispatchPublishedRankingNotification({
    origin,
    userId: user.id,
    rankingId: ballot.id,
    leagueId: ballotLeagueId,
    isPlayer,
    title: displayTitle,
    username: profile?.username ?? "Unknown",
    discordId: profile?.discord_id ?? null,
    leagueNameSnapshot: ballot.league_name_snapshot ?? null,
    seasonNameSnapshot: ballot.season_name_snapshot ?? null,
    overlayCount,
    mod,
  });

  return NextResponse.json({ ok: true, flagged: res.flagged });
}

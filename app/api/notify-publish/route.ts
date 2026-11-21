import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { PlayerTierListPayload } from "@/types/database";
import { evaluateContentModerationServer } from "@/utils/contentModerationServer";
import {
  getServiceRoleClient,
  logModerationEvent,
  sendModerationWebhook,
} from "@/utils/moderationServer";

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

  const origin = new URL(request.url).origin;

  if (blogId) {
    const [{ data: blog }, { data: profile }] = await Promise.all([
      supabase
        .from("blogs")
        .select(
          "id, title, subtitle, content, banner_url, author_name, status, user_id, league_name_snapshot, season_name_snapshot"
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

    const hasBanner = Boolean(blog.banner_url?.trim());
    const hasMedia = hasBanner || mod.totalImageCount > 0;

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

    if (mod.action === "allow" && !hasMedia) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const blogUrl = `${origin}/blog/${blog.id}`;
    const isFlagged = mod.action === "flag";
    const actionType = isFlagged ? "flagged" : "media_review";

    await Promise.all([
      logModerationEvent({
        userId: user.id,
        contentType: "blog",
        contentId: blog.id,
        action: actionType,
        categories:
          mod.categories.length > 0 ? mod.categories : ["media_review"],
        fieldNames: mod.flaggedFields,
        matchedTerms: mod.matchedTerms,
        titleSnapshot: blog.title,
      }),
      sendModerationWebhook({
        title: isFlagged ? "⚠️ Flagged Blog Published" : "📢 Blog Published",
        url: blogUrl,
        color: isFlagged ? 0xe84a1b : 0x2d5a3f,
        description: `**${blog.title}**\n${
          blog.season_name_snapshot
            ? `${
                blog.league_name_snapshot
                  ? `${blog.league_name_snapshot} — `
                  : ""
              }${blog.season_name_snapshot}`
            : "General"
        }`,
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
            name: "Moderation Check",
            value:
              mod.matchedTerms.length > 0
                ? `Matched terms: \`${mod.matchedTerms.join("`, `")}\``
                : "No flagged text detected",
            inline: true,
          },
          ...(hasMedia
            ? [
                {
                  name: "Images",
                  value: `${hasBanner ? "Banner attached" : "No banner"}${
                    mod.totalImageCount > 0
                      ? ` • ${mod.totalImageCount} inline image${
                          mod.totalImageCount === 1 ? "" : "s"
                        }${
                          mod.externalImageCount > 0
                            ? ` (${mod.externalImageCount} external URL)`
                            : ""
                        }`
                      : ""
                  }`,
                  inline: true,
                },
              ]
            : []),
          {
            name: "Link",
            value: `[Open Blog](${blogUrl})`,
            inline: false,
          },
        ],
      }),
    ]);

    return NextResponse.json({ ok: true, flagged: isFlagged });
  }

  const [{ data: ballot }, { data: entries }, { data: profile }] =
    await Promise.all([
      supabase
        .from("rankings")
        .select(
          "id, title, status, ranking_type, tier_data, user_id, author_notes, overlays, league_name_snapshot, season_name_snapshot"
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

  const isPlayer = ballot.ranking_type === "player";
  const contentType = isPlayer ? "tierlist" : "ranking";
  const tierData = ballot.tier_data as PlayerTierListPayload | null;

  const fields = [
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
  ];

  const mod = await evaluateContentModerationServer(fields);
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

  if (mod.action === "allow" && overlayCount === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ballotUrl = isPlayer
    ? `${origin}/tierlist/${ballot.id}`
    : `${origin}/rankings/${ballot.id}`;
  const isFlagged = mod.action === "flag";
  const displayTitle =
    ballot.title || (isPlayer ? "Player Tier List" : "Team Power Rankings");

  await Promise.all([
    logModerationEvent({
      userId: user.id,
      contentType,
      contentId: ballot.id,
      action: isFlagged ? "flagged" : "media_review",
      categories:
        mod.categories.length > 0 ? mod.categories : ["media_review"],
      fieldNames: mod.flaggedFields,
      matchedTerms: mod.matchedTerms,
      titleSnapshot: displayTitle,
    }),
    sendModerationWebhook({
      title: isFlagged ? "⚠️ Flagged Ranking Published" : "📢 Ranking Published",
      url: ballotUrl,
      color: isFlagged ? 0xe84a1b : 0x2d5a3f,
      description: `**${displayTitle}**\n${
        ballot.league_name_snapshot ? `${ballot.league_name_snapshot} — ` : ""
      }${ballot.season_name_snapshot ?? ""}`,
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
          name: "Moderation Check",
          value:
            mod.matchedTerms.length > 0
              ? `Matched terms: \`${mod.matchedTerms.join("`, `")}\``
              : "No flagged text detected",
          inline: true,
        },
        ...(overlayCount > 0
          ? [
              {
                name: "Image Overlays",
                value: `${overlayCount} custom image overlay${
                  overlayCount === 1 ? "" : "s"
                } attached`,
                inline: true,
              },
            ]
          : []),
        {
          name: "Link",
          value: `[Open Published Ranking](${ballotUrl})`,
          inline: false,
        },
      ],
    }),
  ]);

  return NextResponse.json({ ok: true, flagged: isFlagged });
}

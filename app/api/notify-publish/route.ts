import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { PlayerTierListPayload } from "@/types/database";

const FLAGGED_TERMS = [
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "kys",
  "kill yourself",
  "tranny",
  "chink",
  "spic",
  "kike",
  "slut",
  "whore",
  "cunt",
];

function findFlaggedTerms(texts: (string | null | undefined)[]): string[] {
  const combined = texts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return FLAGGED_TERMS.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(combined);
  });
}

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_MOD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ skipped: true });
  }

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

  if (blogId) {
    const [{ data: blog }, { data: profile }] = await Promise.all([
      supabase
        .from("blogs")
        .select(
          "id, title, subtitle, content, author_name, status, user_id, league_name_snapshot, season_name_snapshot"
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

    const flagged = findFlaggedTerms([
      profile?.username,
      blog.author_name,
      blog.title,
      blog.subtitle,
      blog.content,
    ]);

    if (flagged.length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const origin = new URL(request.url).origin;
    const blogUrl = `${origin}/blog/${blog.id}`;
    const pingUserId = process.env.DISCORD_MOD_PING_USER_ID?.trim();

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(pingUserId
          ? {
              content: `<@${pingUserId}>`,
              allowed_mentions: { users: [pingUserId] },
            }
          : {}),
        embeds: [
          {
            title: "⚠️ Flagged Blog Published",
            url: blogUrl,
            color: 0xe84a1b,
            description: `**${blog.title}**\n${
              blog.season_name_snapshot
                ? `${
                    blog.league_name_snapshot
                      ? `${blog.league_name_snapshot} — `
                      : ""
                  }${blog.season_name_snapshot}`
                : "General"
            }`,
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
                value: `Matched terms: \`${flagged.join("`, `")}\``,
                inline: true,
              },
              {
                name: "Link",
                value: `[Open Blog](${blogUrl})`,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    }).catch(() => {});

    return NextResponse.json({ ok: true, flagged: true });
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

  const tierData = ballot.tier_data as PlayerTierListPayload | null;
  const tierTexts =
    tierData?.sections?.flatMap((sec) =>
      sec.tiers.flatMap((t) => [t.label, t.commentary])
    ) ?? [];

  const flagged = findFlaggedTerms([
    profile?.username,
    ballot.title,
    ballot.author_notes,
    ...(entries ?? []).map((e) => e.commentary),
    ...tierTexts,
  ]);

  const origin = new URL(request.url).origin;
  const ballotUrl =
    ballot.ranking_type === "player"
      ? `${origin}/tierlist/${ballot.id}`
      : `${origin}/rankings/${ballot.id}`;
  const isFlagged = flagged.length > 0;

  const overlayCount = Array.isArray(ballot.overlays)
    ? ballot.overlays.length
    : 0;

  if (!isFlagged && overlayCount === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const pingUserId = process.env.DISCORD_MOD_PING_USER_ID?.trim();

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(pingUserId
        ? {
            content: `<@${pingUserId}>`,
            allowed_mentions: { users: [pingUserId] },
          }
        : {}),
      embeds: [
        {
          title: isFlagged
            ? "⚠️ Flagged Ranking Published"
            : "📢 Ranking Published",
          url: ballotUrl,
          color: isFlagged ? 0xe84a1b : 0x2d5a3f,
          description: `**${
            ballot.title ||
            (ballot.ranking_type === "player"
              ? "Player Tier List"
              : "Team Power Rankings")
          }**\n${
            ballot.league_name_snapshot ? `${ballot.league_name_snapshot} — ` : ""
          }${ballot.season_name_snapshot ?? ""}`,
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
              value: isFlagged
                ? `Matched terms: \`${flagged.join("`, `")}\``
                : "No flagged terms detected",
              inline: true,
            },
            ...(overlayCount > 0
              ? [
                  {
                    name: "Overlays",
                    value: `${overlayCount} custom image/GIF attached`,
                    inline: true,
                  },
                ]
              : []),
            {
              name: "Link",
              value: `[Open Ranking](${ballotUrl})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, flagged: isFlagged });
}

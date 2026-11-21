import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  logModerationEvent,
  sendModerationWebhook,
  type ModerationContentType,
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
    contentType?: ModerationContentType;
    contentId?: string | null;
    title?: string | null;
    blockedFields?: string[];
    categories?: string[];
    matchedTerms?: string[];
  } | null;

  if (!body?.contentType) {
    return NextResponse.json({ error: "Missing contentType" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, discord_id")
    .eq("id", user.id)
    .maybeSingle();

  const blockedFields = Array.isArray(body.blockedFields)
    ? body.blockedFields
    : [];
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const matchedTerms = Array.isArray(body.matchedTerms)
    ? body.matchedTerms
    : [];

  await Promise.all([
    logModerationEvent({
      userId: user.id,
      contentType: body.contentType,
      contentId: body.contentId ?? null,
      action: "blocked",
      categories,
      fieldNames: blockedFields,
      matchedTerms,
      titleSnapshot: body.title ?? null,
    }),
    sendModerationWebhook({
      title: "🛡️ Blocked Publish Attempt",
      color: 0xe84a1b,
      description: `**${body.title || `Untitled (${body.contentType})`}**\nPre-publish check blocked prohibited content from going live.`,
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
          name: "Content Type",
          value: body.contentType,
          inline: true,
        },
        {
          name: "Blocked Fields",
          value: blockedFields.join(", ") || "Unknown",
          inline: false,
        },
        {
          name: "Categories",
          value: categories.join(", ") || "prohibited",
          inline: true,
        },
      ],
    }),
  ]);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  formatBlockedMessage,
  type ModerationFieldInput,
} from "@/utils/contentModeration";
import { evaluateContentModerationServer } from "@/utils/contentModerationServer";
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
    fields?: ModerationFieldInput[];
    markdownContent?: string | null;
  } | null;

  if (!body?.contentType || !Array.isArray(body.fields)) {
    return NextResponse.json(
      { error: "Missing contentType or fields" },
      { status: 400 }
    );
  }

  const mod = await evaluateContentModerationServer(body.fields, {
    markdownContent: body.markdownContent,
  });

  if (mod.action === "block") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, discord_id")
      .eq("id", user.id)
      .maybeSingle();

    await Promise.all([
      logModerationEvent({
        userId: user.id,
        contentType: body.contentType,
        contentId: body.contentId ?? null,
        action: "blocked",
        categories: mod.categories,
        fieldNames: mod.blockedFields,
        matchedTerms: mod.matchedTerms,
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
            value: mod.blockedFields.join(", ") || "Unknown",
            inline: false,
          },
          {
            name: "Matched / Categories",
            value:
              mod.matchedTerms.length > 0
                ? `${mod.categories.join(", ")} (\`${mod.matchedTerms.join("`, `")}\`)`
                : mod.categories.join(", ") || "prohibited",
            inline: false,
          },
        ],
      }),
    ]);

    return NextResponse.json({
      action: "block",
      blockedFields: mod.blockedFields,
      message: formatBlockedMessage(mod.blockedFields),
    });
  }

  return NextResponse.json({ action: mod.action });
}

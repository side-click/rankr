import { NextResponse } from "next/server";
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
import { createClient } from "@/utils/supabase/server";

const MAX_FIELDS = 100;
const MAX_TOTAL_CHARS = 100_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, discord_id, is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_banned) {
    return NextResponse.json({ error: "Account suspended." }, { status: 403 });
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

  if (body.fields.length > MAX_FIELDS) {
    return NextResponse.json(
      { error: `Too many fields (max ${MAX_FIELDS}).` },
      { status: 400 }
    );
  }

  const markdownContent =
    typeof body.markdownContent === "string"
      ? body.markdownContent.slice(0, MAX_TOTAL_CHARS)
      : null;

  const totalFieldChars = body.fields.reduce(
    (sum, f) => sum + String(f?.value ?? "").length,
    0
  );
  if (totalFieldChars > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: "Content exceeds maximum moderation payload size." },
      { status: 400 }
    );
  }

  const mod = await evaluateContentModerationServer(body.fields, {
    markdownContent,
  });

  if (mod.action === "block") {
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

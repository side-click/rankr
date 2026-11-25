import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type ModerationContentType = "ranking" | "tierlist" | "blog";
export type ModerationAction =
  | "blocked"
  | "auto_unpublished"
  | "flagged"
  | "media_review";

export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function logModerationEvent(entry: {
  userId: string;
  contentType: ModerationContentType;
  contentId?: string | null;
  action: ModerationAction;
  categories: string[];
  fieldNames: string[];
  matchedTerms: string[];
  titleSnapshot?: string | null;
}): Promise<void> {
  const adminDb = getServiceRoleClient();
  if (!adminDb) return;
  try {
    await adminDb.from("moderation_events").insert({
      user_id: entry.userId,
      content_type: entry.contentType,
      content_id: entry.contentId ?? null,
      action: entry.action,
      categories: entry.categories,
      field_names: entry.fieldNames,
      matched_terms: entry.matchedTerms,
      title_snapshot: entry.titleSnapshot ?? null,
    });
  } catch {
    // Non-fatal if migration 028 hasn't been applied yet
  }
}

export async function sendModerationWebhook(payload: {
  title: string;
  color: number;
  url?: string;
  description: string;
  fields: { name: string; value: string; inline?: boolean }[];
  pingModerator?: boolean;
}): Promise<void> {
  const webhookUrl =
    process.env.DISCORD_PUBLISH_WEBHOOK_URL?.trim() ||
    process.env.DISCORD_MOD_WEBHOOK_URL;
  if (!webhookUrl) return;
  const pingUserId = payload.pingModerator
    ? process.env.DISCORD_MOD_PING_USER_ID?.trim()
    : undefined;

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
          title: payload.title,
          ...(payload.url ? { url: payload.url } : {}),
          color: payload.color,
          description: payload.description,
          fields: payload.fields,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch(() => {});
}

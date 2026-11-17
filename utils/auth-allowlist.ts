import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) {
    return "/";
  }
  return rawNext;
}

/**
 * Checks whether the newly signed-in user is allowlisted; if not, notifies the
 * mod webhook, signs them out, and returns a redirect response to `/?auth_error=not_authorized`.
 * Returns `null` when the user is allowed.
 */
export async function enforceAllowlistAfterLogin(
  supabase: SupabaseClient,
  user: User | null | undefined,
  origin: string
): Promise<NextResponse | null> {
  const { data: allowed } = await supabase.rpc("is_allowlisted");
  if (allowed !== false) {
    return null;
  }

  const meta = user?.user_metadata ?? {};
  const discordId = String(meta.provider_id ?? meta.sub ?? "");
  const username = String(
    meta.full_name ??
      meta.name ??
      meta.user_name ??
      meta.preferred_username ??
      "Discord User"
  );
  const avatarUrl =
    typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;

  const webhookUrl = process.env.DISCORD_MOD_WEBHOOK_URL;
  const pingUserId = process.env.DISCORD_MOD_PING_USER_ID?.trim();
  if (webhookUrl) {
    try {
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
              title: "🔒 Blocked Login Attempt (Not Allowlisted)",
              color: 0x5865f2,
              thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
              fields: [
                { name: "Discord User", value: username, inline: true },
                {
                  name: "Discord ID",
                  value: discordId ? `\`${discordId}\`` : "Unknown",
                  inline: true,
                },
                {
                  name: "Quick Action",
                  value: `[Approve in Admin Console](${origin}/admin)`,
                  inline: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
      // Do not block auth redirect if Discord webhook fails
    }
  }

  await supabase.auth.signOut();
  const params = new URLSearchParams({ auth_error: "not_authorized" });
  if (discordId) params.set("discord_id", discordId);
  return NextResponse.redirect(`${origin}/?${params.toString()}`);
}

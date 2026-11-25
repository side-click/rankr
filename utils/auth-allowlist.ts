import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseDiscordUserIds } from "@/utils/moderationServer";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  if (LOCAL_HOSTNAMES.has(url.hostname)) {
    return url.origin;
  }
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      // Fall back to request.url origin if env URL is malformed
    }
  }
  return url.origin;
}

export function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/";
  const trimmed = rawNext.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return "/";
  }
  try {
    const parsed = new URL(trimmed, "https://rankr.local");
    if (parsed.origin !== "https://rankr.local") {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
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
  const { data: allowed, error } = await supabase.rpc("is_allowlisted");
  if (!error && allowed === true) {
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

  const webhookUrl =
    process.env.DISCORD_ADMIN_WEBHOOK_URL?.trim() ||
    process.env.DISCORD_MOD_WEBHOOK_URL?.trim();
  const pingUserIds = parseDiscordUserIds(
    process.env.DISCORD_ADMIN_PING_USER_IDS,
    process.env.DISCORD_MOD_PING_USER_ID
  );
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(pingUserIds.length > 0
            ? {
                content: pingUserIds.map((id) => `<@${id}>`).join(" "),
                allowed_mentions: { users: pingUserIds },
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

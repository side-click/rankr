import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: allowed } = await supabase.rpc("is_allowlisted");
      if (allowed === false) {
        const meta = data.user?.user_metadata ?? {};
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
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=discord_callback_failed`);
}

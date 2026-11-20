import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getRequestOrigin, sanitizeNextPath } from "@/utils/auth-allowlist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const next = sanitizeNextPath(searchParams.get("next"));

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fall back to Supabase OAuth until custom Discord env vars are configured
  if (!clientId || !clientSecret || !serviceRoleKey) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      return NextResponse.redirect(`${origin}/?auth_error=discord_oauth_init_failed`);
    }
    return NextResponse.redirect(data.url);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/auth/discord/callback`;

  const discordAuthUrl = new URL("https://discord.com/oauth2/authorize");
  discordAuthUrl.searchParams.set("client_id", clientId);
  discordAuthUrl.searchParams.set("redirect_uri", redirectUri);
  discordAuthUrl.searchParams.set("response_type", "code");
  discordAuthUrl.searchParams.set("scope", "identify");
  discordAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(discordAuthUrl.toString());
  response.cookies.set("discord_oauth_state", JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  return response;
}

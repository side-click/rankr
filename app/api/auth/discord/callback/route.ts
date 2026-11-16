import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  enforceAllowlistAfterLogin,
  getRequestOrigin,
  sanitizeNextPath,
} from "@/utils/auth-allowlist";

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  email?: string | null;
  avatar?: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get("discord_oauth_state")?.value;

  const failRedirect = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/?auth_error=${reason}`);
    res.cookies.delete("discord_oauth_state");
    return res;
  };

  if (!code || !returnedState || !rawCookie) {
    return failRedirect("discord_callback_failed");
  }

  let savedState = "";
  let nextPath = "/";
  try {
    const parsed = JSON.parse(rawCookie) as { state?: string; next?: string };
    savedState = parsed.state ?? "";
    nextPath = sanitizeNextPath(parsed.next ?? "/");
  } catch {
    return failRedirect("discord_callback_failed");
  }

  if (!savedState || savedState !== returnedState) {
    return failRedirect("discord_state_mismatch");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
    return failRedirect("discord_oauth_not_configured");
  }

  // Exchange authorization code for Discord access token
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/auth/discord/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return failRedirect("discord_token_exchange_failed");
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return failRedirect("discord_token_missing");
  }

  // Fetch Discord user profile
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return failRedirect("discord_profile_failed");
  }

  const discordUser = (await userRes.json()) as DiscordUser;
  if (!discordUser.id) {
    return failRedirect("discord_profile_invalid");
  }

  const displayName =
    discordUser.global_name?.trim() ||
    discordUser.username?.trim() ||
    "Discord User";
  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${
        discordUser.avatar.startsWith("a_") ? "gif" : "png"
      }`
    : null;
  const fallbackEmail = `${discordUser.id}@discord.leaguerankr.local`;
  const discordEmail = discordUser.email?.trim() || fallbackEmail;

  const userMetadata = {
    provider_id: discordUser.id,
    sub: discordUser.id,
    full_name: displayName,
    name: displayName,
    user_name: discordUser.username,
    preferred_username: discordUser.username,
    avatar_url: avatarUrl,
  };

  const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Find existing user by discord_id in profiles
  let targetEmail = discordEmail;
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_id", discordUser.id)
    .maybeSingle();

  if (existingProfile?.id) {
    const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(
      existingProfile.id
    );
    if (existingAuth.user?.email) {
      targetEmail = existingAuth.user.email;
    }
    await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
      user_metadata: userMetadata,
    });
    await supabaseAdmin
      .from("profiles")
      .update({
        username: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id);
  } else {
    // 2. Create user (or link existing user with the same email)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: discordEmail,
        email_confirm: true,
        user_metadata: userMetadata,
      });

    if (createErr && !created?.user) {
      // Email may already exist in auth.users from a prior sign-in
      const { data: linkProbe } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: discordEmail,
      });
      if (!linkProbe?.user?.id) {
        return failRedirect("supabase_user_create_failed");
      }
      targetEmail = linkProbe.user.email ?? discordEmail;
      await supabaseAdmin.auth.admin.updateUserById(linkProbe.user.id, {
        user_metadata: userMetadata,
      });
      await supabaseAdmin.from("profiles").upsert({
        id: linkProbe.user.id,
        discord_id: discordUser.id,
        username: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // 3. Mint a single-use magiclink token and verify it to set SSR session cookies
  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    return failRedirect("supabase_session_link_failed");
  }

  const supabase = await createClient();
  const { data: verified, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });

  if (verifyErr) {
    return failRedirect("supabase_session_verify_failed");
  }

  const blockedResponse = await enforceAllowlistAfterLogin(
    supabase,
    verified.user,
    origin
  );
  if (blockedResponse) {
    blockedResponse.cookies.delete("discord_oauth_state");
    return blockedResponse;
  }

  const response = NextResponse.redirect(`${origin}${nextPath}`);
  response.cookies.delete("discord_oauth_state");
  return response;
}

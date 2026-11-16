import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  enforceAllowlistAfterLogin,
  getRequestOrigin,
  sanitizeNextPath,
} from "@/utils/auth-allowlist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const blockedResponse = await enforceAllowlistAfterLogin(
        supabase,
        data.user,
        origin
      );
      if (blockedResponse) {
        return blockedResponse;
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=discord_callback_failed`);
}

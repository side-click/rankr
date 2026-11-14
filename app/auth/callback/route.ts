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

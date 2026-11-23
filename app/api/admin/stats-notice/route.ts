import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export async function POST(req: Request) {
  const auth = await getServerAuthContext();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { notice?: string | null };
    const trimmed = typeof body.notice === "string" ? body.notice.trim() : "";
    const notice = trimmed ? trimmed.slice(0, 280) : null;

    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({
        stats_notice: notice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      const missingCol =
        error.message.includes("stats_notice") &&
        (error.code === "42703" || error.message.includes("column"));
      return NextResponse.json(
        {
          error: missingCol
            ? "Run migration supabase/migrations/031_stats_notice.sql in your Supabase SQL Editor first."
            : error.message,
        },
        { status: 500 }
      );
    }

    revalidateTag("public-stats");
    return NextResponse.json({ ok: true, statsNotice: notice });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save stats notice",
      },
      { status: 500 }
    );
  }
}

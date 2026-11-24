import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  assertSeasonOperatorAccess,
  getServerAuthContext,
} from "@/utils/supabase/serverAuth";

export async function POST(req: Request) {
  const [auth, supabase] = await Promise.all([
    getServerAuthContext(),
    createClient(),
  ]);
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin && !auth.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    seasonId?: string;
    scope?: string;
  } | null;

  if (!auth.isAdmin) {
    const seasonId = body?.seasonId?.trim();
    if (!seasonId) {
      return NextResponse.json(
        { error: "seasonId is required for league operators." },
        { status: 400 }
      );
    }
    const scope = await assertSeasonOperatorAccess(auth, supabase, seasonId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
  }

  if (body?.scope === "settings" && auth.isAdmin) {
    revalidateTag("app-settings");
  }
  if (body?.scope === "content" && auth.isAdmin) {
    revalidateTag("home-stats");
    revalidateTag("browse-content");
    revalidateTag("consensus-data");
  }

  revalidateTag("public-stats");
  revalidateTag("home-stats");
  return NextResponse.json({ ok: true });
}

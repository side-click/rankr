import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
import { importMissingDraftsForSeason } from "@/utils/draftImporter";

export async function POST() {
  const auth = await getServerAuthContext();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin && !auth.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [ctx, supabase] = await Promise.all([
      loadAdminStatsContext({ includeRiotStats: false }),
      createClient(),
    ]);
    const summary = await importMissingDraftsForSeason(
      ctx.sheetConfig,
      supabase
    );
    if (summary.imported.length > 0) {
      revalidateTag("match-drafts");
      revalidateTag("public-stats");
      revalidateTag("home-stats");
    }
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to import missing drafts",
      },
      { status: 500 }
    );
  }
}

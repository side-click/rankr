import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { importMissingDraftsForSeason } from "@/utils/draftImporter";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
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

  try {
    const body = (await req.json().catch(() => null)) as {
      seasonId?: string;
    } | null;
    const requestedSeasonId = body?.seasonId?.trim() || null;
    let seasonSlug: string | undefined;

    if (requestedSeasonId) {
      const scope = await assertSeasonOperatorAccess(
        auth,
        supabase,
        requestedSeasonId
      );
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
      seasonSlug = scope.season.slug;
    }

    const ctx = await loadAdminStatsContext({
      includeRiotStats: false,
      seasonSlug,
    });
    if (!ctx.authorized) {
      return NextResponse.json({ error: "Forbidden for this league." }, { status: 403 });
    }

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

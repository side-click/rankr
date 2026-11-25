import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/utils/moderationServer";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export async function POST(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.isBanned) {
    return NextResponse.json({ error: "Account banned." }, { status: 403 });
  }
  if (!auth.isAdmin && !auth.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    eventId?: string;
    action?: string;
  } | null;

  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const action = body?.action;
  if (!eventId || (action !== "unpublish" && action !== "delete")) {
    return NextResponse.json(
      { error: "Valid eventId and action ('unpublish' | 'delete') required." },
      { status: 400 }
    );
  }

  const adminDb = getServiceRoleClient();
  if (!adminDb) {
    return NextResponse.json(
      { error: "Server configuration missing service role client." },
      { status: 500 }
    );
  }

  const { data: ev, error: evErr } = await adminDb
    .from("moderation_events")
    .select("id, league_id, content_type, content_id, title_snapshot")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 });
  }
  if (!ev) {
    return NextResponse.json(
      { error: "Moderation event not found." },
      { status: 404 }
    );
  }

  if (
    !auth.isAdmin &&
    (!ev.league_id || !auth.operatorLeagueIds.includes(String(ev.league_id)))
  ) {
    return NextResponse.json(
      { error: "Forbidden for this league." },
      { status: 403 }
    );
  }

  const table = ev.content_type === "blog" ? "blogs" : "rankings";
  if (ev.content_id) {
    if (action === "unpublish") {
      const { error: upErr } = await adminDb
        .from(table)
        .update({ status: "draft", published_at: null })
        .eq("id", ev.content_id);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    } else {
      const { error: delErr } = await adminDb
        .from(table)
        .delete()
        .eq("id", ev.content_id);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }
  }

  const nowIso = new Date().toISOString();
  await adminDb
    .from("moderation_events")
    .update({ resolved: true, resolved_at: nowIso })
    .eq("id", ev.id);

  revalidateTag("home-stats");
  revalidateTag("browse-content");
  if (table === "rankings") {
    revalidateTag("consensus-data");
  }

  return NextResponse.json({ ok: true, resolved_at: nowIso });
}

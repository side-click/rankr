import { NextResponse } from "next/server";
import {
  getServerAuthContext,
  VIEW_AS_COOKIE_NAME,
  type ViewAsState,
} from "@/utils/supabase/serverAuth";

export async function POST(request: Request) {
  const auth = await getServerAuthContext();
  if (!auth.user || !auth.realIsAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    mode?: string;
    leagueId?: string;
    teamId?: string;
    label?: string;
  } | null;

  const mode = body?.mode;
  const label =
    typeof body?.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 80)
      : undefined;

  if (mode === "clear") {
    const res = NextResponse.json({ ok: true, viewAs: null });
    res.cookies.set(VIEW_AS_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  let viewAs: ViewAsState | null = null;
  if (mode === "operator") {
    const leagueId =
      typeof body?.leagueId === "string" ? body.leagueId.trim() : "";
    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId is required for operator preview." },
        { status: 400 }
      );
    }
    viewAs = { mode: "operator", leagueId, label };
  } else if (mode === "captain") {
    const teamId = typeof body?.teamId === "string" ? body.teamId.trim() : "";
    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required for captain preview." },
        { status: 400 }
      );
    }
    viewAs = { mode: "captain", teamId, label };
  } else if (mode === "public") {
    viewAs = { mode: "public", label: label ?? "Regular User" };
  } else {
    return NextResponse.json({ error: "Invalid preview mode." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, viewAs });
  res.cookies.set(VIEW_AS_COOKIE_NAME, JSON.stringify(viewAs), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return res;
}

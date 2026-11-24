import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export async function POST() {
  const auth = await getServerAuthContext();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin && !auth.isOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  revalidateTag("public-stats");
  revalidateTag("home-stats");
  return NextResponse.json({ ok: true });
}

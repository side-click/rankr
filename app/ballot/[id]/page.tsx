import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function LegacyBallotRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("rankings")
    .select("ranking_type")
    .eq("id", id)
    .maybeSingle();

  if (data?.ranking_type === "player") {
    redirect(`/tierlist/${encodeURIComponent(id)}`);
  }
  redirect(`/rankings/${encodeURIComponent(id)}`);
}

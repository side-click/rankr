import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { BallotShareView } from "@/components/BallotShareView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ballot } = await supabase
    .from("ballots")
    .select(
      `
      title,
      season_name_snapshot,
      division_name_snapshot,
      edition_name_snapshot,
      profiles ( username ),
      seasons ( name ),
      divisions ( name ),
      editions ( name )
    `
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!ballot) {
    return { title: "Rankr — Power Rankings" };
  }

  const profile = Array.isArray(ballot.profiles)
    ? ballot.profiles[0]
    : ballot.profiles;
  const season = Array.isArray(ballot.seasons)
    ? ballot.seasons[0]
    : ballot.seasons;
  const division = Array.isArray(ballot.divisions)
    ? ballot.divisions[0]
    : ballot.divisions;
  const edition = Array.isArray(ballot.editions)
    ? ballot.editions[0]
    : ballot.editions;

  const title =
    ballot.title ||
    `${season?.name ?? ballot.season_name_snapshot ?? ""} ${
      division?.name ?? ballot.division_name_snapshot ?? ""
    } — ${edition?.name ?? ballot.edition_name_snapshot ?? ""}`.trim();

  return {
    title: `${title} | by ${profile?.username ?? "Voter"}`,
    description: `Team Power Rankings by ${profile?.username ?? "Voter"}`,
  };
}

export default async function BallotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ballot } = await supabase
    .from("ballots")
    .select(
      `
      *,
      profiles ( id, username, avatar_url ),
      seasons ( id, name, slug, leagues ( id, name, short_name, slug, logo_url, theme_key ) ),
      divisions ( id, name, slug, logo_url, theme_key ),
      editions ( id, name, slug, sort_order, is_open )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!ballot) {
    notFound();
  }

  if (ballot.status !== "published") {
    if (ballot.user_id === user?.id) {
      const season = Array.isArray(ballot.seasons)
        ? ballot.seasons[0]
        : ballot.seasons;
      const division = Array.isArray(ballot.divisions)
        ? ballot.divisions[0]
        : ballot.divisions;
      const edition = Array.isArray(ballot.editions)
        ? ballot.editions[0]
        : ballot.editions;
      const params = new URLSearchParams();
      if (season?.slug) params.set("season", season.slug);
      if (division?.slug) params.set("division", division.slug);
      if (edition?.slug) params.set("edition", edition.slug);
      redirect(`/rank?${params.toString()}`);
    }
    notFound();
  }

  const [{ data: entries }, { data: divisionThemes }, { data: viewerProfile }] =
    await Promise.all([
      supabase
        .from("ballot_entries")
        .select("*")
        .eq("ballot_id", ballot.id)
        .order("rank", { ascending: true }),
      supabase.from("division_themes").select("*").order("name"),
      user
        ? supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <BallotShareView
      ballot={ballot}
      entries={entries ?? []}
      themes={divisionThemes ?? []}
      isOwner={user?.id === ballot.user_id}
      isAdmin={Boolean(viewerProfile?.is_admin)}
    />
  );
}

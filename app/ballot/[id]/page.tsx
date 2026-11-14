import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { checkUserAllowlisted } from "@/utils/allowlist";
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
      author_notes,
      season_name_snapshot,
      division_name_snapshot,
      edition_name_snapshot,
      profiles ( username ),
      seasons ( name ),
      divisions ( name ),
      editions ( name ),
      ballot_entries ( rank, team_name_snapshot, teams ( name ) )
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

  const divisionName = division?.name ?? ballot.division_name_snapshot ?? "";
  const editionName = edition?.name ?? ballot.edition_name_snapshot ?? "";
  const seasonName = season?.name ?? ballot.season_name_snapshot ?? "";
  const authorName = profile?.username ?? "Voter";

  const title =
    ballot.title ||
    `${seasonName} ${divisionName} — ${editionName}`.trim();

  const items = Array.isArray(ballot.ballot_entries) ? ballot.ballot_entries : [];
  const top3 = [...items]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((item) => {
      const team = Array.isArray(item.teams) ? item.teams[0] : item.teams;
      return `#${item.rank} ${team?.name ?? item.team_name_snapshot ?? "Team"}`;
    });

  const descriptionParts = [
    top3.length > 0 ? `Top 3: ${top3.join(" • ")}` : null,
    ballot.author_notes ? `"${ballot.author_notes}"` : null,
  ].filter(Boolean);

  const description =
    descriptionParts.join(" — ") ||
    `Team Power Rankings by ${authorName}`;

  const fullTitle = `${title} | by ${authorName}`;

  return {
    title: fullTitle,
    description,
    openGraph: {
      type: "article",
      siteName: "Rankr",
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
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

  const [
    { data: entries },
    { data: divisionThemes },
    { data: viewerProfile },
    isAllowlisted,
  ] = await Promise.all([
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
    user ? checkUserAllowlisted(supabase) : Promise.resolve(false),
  ]);

  return (
    <BallotShareView
      ballot={ballot}
      entries={entries ?? []}
      themes={divisionThemes ?? []}
      isOwner={user?.id === ballot.user_id && isAllowlisted}
      isAdmin={Boolean(viewerProfile?.is_admin)}
    />
  );
}

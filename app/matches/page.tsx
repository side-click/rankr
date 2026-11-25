import { redirect } from "next/navigation";

export default async function LegacyMatchesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; team?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.season?.trim()) qs.set("season", params.season.trim());
  if (params.team?.trim()) qs.set("team", params.team.trim());
  const query = qs.toString();
  redirect(query ? `/team-hub?${query}` : "/team-hub");
}

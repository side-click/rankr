import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyRankRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) qs.set(k, v);
  }
  const query = qs.toString();
  redirect(query ? `/create?${query}` : "/create");
}

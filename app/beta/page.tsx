import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BetaRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  redirect(
    params.season ? `/?season=${encodeURIComponent(params.season)}` : "/"
  );
}

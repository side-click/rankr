import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { RetroWindow } from "@/components/RetroWindow";
import { BallotCard } from "@/components/BallotCard";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    season?: string;
    division?: string;
    edition?: string;
    author?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: seasons }, { data: divisions }, { data: editions }] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("*, leagues ( * )")
        .order("created_at", { ascending: false }),
      supabase.from("divisions").select("*").order("name"),
      supabase.from("editions").select("*").order("sort_order", { ascending: true }),
    ]);

  let query = supabase
    .from("ballots")
    .select(
      `
      id,
      title,
      ranking_type,
      tier_variant,
      published_at,
      season_id,
      division_id,
      edition_id,
      league_name_snapshot,
      season_name_snapshot,
      division_name_snapshot,
      division_logo_snapshot,
      edition_name_snapshot,
      profiles ( username, avatar_url ),
      seasons ( name, slug, leagues ( name, short_name, slug, logo_url ) ),
      divisions ( name, slug, logo_url, theme_key ),
      editions ( name, slug )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (params.type === "team" || params.type === "player") {
    query = query.eq("ranking_type", params.type);
  }
  if (params.season) {
    const s = seasons?.find((x) => x.slug === params.season);
    if (s) query = query.eq("season_id", s.id);
  }
  if (params.division) {
    const matchingDivIds = (divisions ?? [])
      .filter((d) => d.slug === params.division)
      .map((d) => d.id);
    if (matchingDivIds.length > 0) {
      query = query.in("division_id", matchingDivIds);
    }
  }
  if (params.edition) {
    const matchingEdIds = (editions ?? [])
      .filter((e) => e.slug === params.edition)
      .map((e) => e.id);
    if (matchingEdIds.length > 0) {
      query = query.in("edition_id", matchingEdIds);
    }
  }

  const { data: ballots } = await query.limit(60);

  const authorFilter = params.author?.trim().toLowerCase() ?? "";
  const filteredBallots = (ballots ?? []).filter((b) => {
    if (!authorFilter) return true;
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    return (profile?.username ?? "").toLowerCase().includes(authorFilter);
  });

  const uniqueDivisionSlugs = Array.from(
    new Map((divisions ?? []).map((d) => [d.slug, d])).values()
  );
  const uniqueEditionSlugs = Array.from(
    new Map((editions ?? []).map((e) => [e.slug, e])).values()
  );

  return (
    <RetroWindow title="Browse Published Rankings" theme="scdl">
      <form
        key={`${params.type ?? ""}|${params.season ?? ""}|${params.division ?? ""}|${params.edition ?? ""}|${params.author ?? ""}`}
        method="GET"
        className="xp-panel p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end"
      >
        <div>
          <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
            Type
          </label>
          <select
            name="type"
            defaultValue={params.type ?? ""}
            className="w-full xp-inset px-2 py-1.5 text-xs"
          >
            <option value="">All Types</option>
            <option value="team">Team Power Rankings</option>
            <option value="player">Player Tier Lists</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
            Season
          </label>
          <select
            name="season"
            defaultValue={params.season ?? ""}
            className="w-full xp-inset px-2 py-1.5 text-xs"
          >
            <option value="">All Seasons</option>
            {(seasons ?? []).map((s) => {
              const league = Array.isArray(s.leagues)
                ? s.leagues[0]
                : s.leagues;
              const prefix =
                (league as { short_name?: string | null; slug?: string; name?: string } | null)
                  ?.short_name ||
                (league?.slug === "scdl" ? "SCDL" : league?.name);
              return (
                <option key={s.id} value={s.slug}>
                  {prefix ? `${prefix}: ` : ""}
                  {s.name}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
            Division
          </label>
          <select
            name="division"
            defaultValue={params.division ?? ""}
            className="w-full xp-inset px-2 py-1.5 text-xs"
          >
            <option value="">All Divisions</option>
            {uniqueDivisionSlugs.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
            Edition
          </label>
          <select
            name="edition"
            defaultValue={params.edition ?? ""}
            className="w-full xp-inset px-2 py-1.5 text-xs"
          >
            <option value="">All Editions</option>
            {uniqueEditionSlugs.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#d4d2c5] mb-1">
            Author
          </label>
          <input
            type="text"
            name="author"
            defaultValue={params.author ?? ""}
            placeholder="Author name..."
            className="w-full xp-inset px-2 py-1.5 text-xs"
          />
        </div>

        <div className="flex gap-2">
          <button type="submit" className="xp-btn xp-btn-primary text-xs flex-1">
            <Search className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
          <Link href="/browse" className="xp-btn text-xs">
            Reset
          </Link>
        </div>
      </form>

      {filteredBallots.length === 0 ? (
        <div className="xp-inset p-8 text-center text-xs text-[#a6a89e]">
          No published rankings match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredBallots.map((b) => (
            <BallotCard key={b.id} ballot={b} />
          ))}
        </div>
      )}
    </RetroWindow>
  );
}

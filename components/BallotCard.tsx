import Link from "next/link";
import { Award } from "lucide-react";

type MaybeArray<T> = T | T[] | null | undefined;

function unwrap<T>(val: MaybeArray<T>): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export interface BallotCardData {
  id: string;
  title: string | null;
  published_at: string | null;
  league_name_snapshot?: string | null;
  season_name_snapshot?: string | null;
  division_name_snapshot?: string | null;
  division_logo_snapshot?: string | null;
  edition_name_snapshot?: string | null;
  profiles?: MaybeArray<{ username: string; avatar_url: string | null }>;
  seasons?: MaybeArray<{
    name: string;
    slug?: string;
    leagues?: MaybeArray<{
      name?: string;
      short_name?: string | null;
      slug?: string;
    }>;
  }>;
  divisions?: MaybeArray<{
    name: string;
    slug?: string;
    logo_url: string | null;
  }>;
  editions?: MaybeArray<{ name: string }>;
}

export function getLeaguePrefix(
  league: { name?: string; short_name?: string | null; slug?: string } | null,
  fallbackName?: string | null
): string {
  if (league?.short_name) return league.short_name;
  if (league?.slug === "scdl") return "SCDL";
  if (league?.name) return league.name;
  if (fallbackName === "Scuttle Crab Draft League") return "SCDL";
  return fallbackName ?? "";
}

export function BallotCard({ ballot }: { ballot: BallotCardData }) {
  const profile = unwrap(ballot.profiles);
  const season = unwrap(ballot.seasons);
  const league = unwrap(season?.leagues);
  const division = unwrap(ballot.divisions);
  const edition = unwrap(ballot.editions);

  const divLogo = division?.logo_url ?? ballot.division_logo_snapshot;
  const divName = division?.name ?? ballot.division_name_snapshot ?? "Division";
  const edName = edition?.name ?? ballot.edition_name_snapshot ?? "Edition";
  const sName = season?.name ?? ballot.season_name_snapshot ?? "";
  const leaguePrefix = getLeaguePrefix(league, ballot.league_name_snapshot);
  const publishedDate = ballot.published_at
    ? new Date(ballot.published_at).toLocaleDateString()
    : null;

  return (
    <Link
      href={`/ballot/${ballot.id}`}
      className="xp-panel p-3.5 hover:brightness-110 transition flex flex-col justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        {divLogo ? (
          <img
            src={divLogo}
            alt={divName}
            className="w-10 h-10 object-contain shrink-0"
          />
        ) : (
          <Award className="w-9 h-9 text-[#7cd438] shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-[#f0ede0] truncate">
            {edName}
          </div>
          <div className="text-xs font-bold text-[#d6d3c4] truncate">
            {divName}
          </div>
          <div className="text-[11px] text-[#a6a89e] truncate">
            {leaguePrefix ? `${leaguePrefix}: ` : ""}
            {sName}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded bg-black/25 border border-white/10">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username}
            className="w-6 h-6 rounded-sm object-cover border border-white/30 shrink-0"
          />
        ) : (
          <span className="w-6 h-6 rounded-sm bg-[#5865f2] text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
            {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="text-sm font-bold text-[#f0c020] truncate">
          {profile?.username ?? "Unknown"}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
        <span className="text-[#a6a89e]">
          {publishedDate ? `Published ${publishedDate}` : ""}
        </span>
        <span className="text-[#7cd438] font-bold shrink-0">Open →</span>
      </div>
    </Link>
  );
}

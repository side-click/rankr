import Link from "next/link";
import { FileText } from "lucide-react";
import { getLeaguePrefix } from "@/components/BallotCard";

type MaybeArray<T> = T | T[] | null | undefined;

function unwrap<T>(val: MaybeArray<T>): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export interface BlogCardData {
  id: string;
  title: string;
  subtitle?: string | null;
  banner_url?: string | null;
  author_name?: string | null;
  published_at: string | null;
  season_id?: string | null;
  season_name_snapshot?: string | null;
  league_name_snapshot?: string | null;
  profiles?: MaybeArray<{ username: string; avatar_url: string | null }>;
  seasons?: MaybeArray<{
    name: string;
    slug?: string;
    leagues?: MaybeArray<{
      name?: string;
      short_name?: string | null;
      slug?: string;
      logo_url?: string | null;
    }>;
  }>;
}

export function BlogCard({
  blog,
  layout = "grid",
}: {
  blog: BlogCardData;
  layout?: "grid" | "list";
}) {
  const profile = unwrap(blog.profiles);
  const season = unwrap(blog.seasons);
  const league = unwrap(season?.leagues);

  const authorDisplay =
    blog.author_name?.trim() || profile?.username || "Unknown";
  const leaguePrefix = getLeaguePrefix(league, blog.league_name_snapshot);
  const seasonName = season?.name ?? blog.season_name_snapshot ?? "";
  const scopeLabel = seasonName
    ? `${leaguePrefix ? `${leaguePrefix}: ` : ""}${seasonName}`
    : "General";

  const publishedDate = blog.published_at
    ? new Date(blog.published_at).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      })
    : null;

  const cardStyle: React.CSSProperties = {
    borderLeftWidth: "3px",
    borderLeftColor: "#3b82f6",
    backgroundImage:
      "linear-gradient(110deg, rgba(59, 130, 246, 0.24) 0%, rgba(59, 130, 246, 0.09) 46%, rgba(18, 22, 21, 0.92) 100%)",
  };

  if (layout === "list") {
    return (
      <Link
        href={`/blog/${blog.id}`}
        style={cardStyle}
        className="xp-panel px-3 py-2.5 hover:brightness-110 transition flex flex-col gap-2.5 lg:grid lg:grid-cols-[148px_1fr_auto] lg:items-center lg:gap-3"
      >
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/25 border border-white/10 min-w-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={authorDisplay}
              width={32}
              height={32}
              className="w-8 h-8 rounded-md object-cover border border-white/30 shrink-0"
            />
          ) : (
            <span className="w-8 h-8 rounded-md bg-[#2563eb] text-white text-sm font-bold inline-flex items-center justify-center shrink-0">
              {authorDisplay.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-bold text-[#f0c020] truncate">
            {authorDisplay}
          </span>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          {blog.banner_url && (
            <img
              src={blog.banner_url}
              alt={blog.title}
              className="w-16 h-11 rounded object-cover border border-white/15 shrink-0 hidden sm:block"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1c2b42] border border-[#60a5fa]/40 text-[10px] font-bold text-[#93c5fd] shrink-0">
                <FileText className="w-2.5 h-2.5" />
                <span>Blog</span>
              </span>
              <span className="wow-heading text-base font-bold text-[#f0ede0] truncate">
                {blog.title}
              </span>
            </div>
            {blog.subtitle && (
              <p className="text-xs text-[#c7c5b8] truncate mt-0.5">
                {blog.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-2 text-[11px] text-[#a6a89e] shrink-0">
          <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-[#d4d2c5] font-semibold">
            {scopeLabel}
          </span>
          {publishedDate && <span>{publishedDate}</span>}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${blog.id}`}
      style={cardStyle}
      className="xp-panel p-3.5 hover:brightness-110 transition flex flex-col justify-between gap-3"
    >
      <div className="space-y-2.5">
        {blog.banner_url && (
          <div className="rounded overflow-hidden border border-white/15 bg-black/30 h-32">
            <img
              src={blog.banner_url}
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1c2b42] border border-[#60a5fa]/40 font-bold text-[#93c5fd]">
            <FileText className="w-3 h-3" />
            <span>Blog</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-[#d4d2c5] font-semibold truncate">
            {scopeLabel}
          </span>
        </div>

        <div>
          <h3 className="wow-heading text-base font-bold text-[#f0ede0] line-clamp-2 leading-snug">
            {blog.title}
          </h3>
          {blog.subtitle && (
            <p className="text-xs text-[#c7c5b8] line-clamp-2 mt-1">
              {blog.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={authorDisplay}
              className="w-6 h-6 rounded-full object-cover border border-white/30 shrink-0"
            />
          ) : (
            <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
              {authorDisplay.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-bold text-[#f0c020] truncate">
            {authorDisplay}
          </span>
        </div>
        {publishedDate && (
          <span className="text-[11px] text-[#a6a89e] shrink-0">
            {publishedDate}
          </span>
        )}
      </div>
    </Link>
  );
}

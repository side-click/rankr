import Link from "next/link";
import { FileText } from "lucide-react";
import { getLeaguePrefix } from "@/components/ContentCard";

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
  const hasSeason = Boolean(seasonName);
  const scopeLabel = hasSeason
    ? `${leaguePrefix ? `${leaguePrefix}: ` : ""}${seasonName}`
    : "Blog Post";
  const seasonLogo = hasSeason ? league?.logo_url ?? null : null;

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
        className="xp-panel px-3 py-2.5 hover:brightness-110 transition flex flex-col gap-2.5 lg:grid lg:grid-cols-[148px_auto_minmax(0,1fr)_auto] lg:items-center lg:gap-3"
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

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded bg-black/35 border border-[#c89b3c]/40 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-[#f0c020]" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#f0ede0] whitespace-nowrap">
              {seasonLogo && (
                <img
                  src={seasonLogo}
                  alt={scopeLabel}
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain shrink-0"
                />
              )}
              <span>{scopeLabel}</span>
            </div>
            {hasSeason && (
              <div className="text-[11px] text-[#a6a89e] whitespace-nowrap">
                Blog Post
              </div>
            )}
          </div>
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
            <div className="wow-heading text-base font-bold text-[#f0ede0] truncate">
              {blog.title}
            </div>
            {blog.subtitle && (
              <p className="text-xs text-[#c7c5b8] truncate mt-0.5">
                {blog.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="text-[11px] text-[#a6a89e] whitespace-nowrap text-right shrink-0">
          {publishedDate ? `Published ${publishedDate}` : ""}
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
      <div className="space-y-2.5 min-w-0">
        {blog.banner_url && (
          <div className="rounded overflow-hidden border border-white/15 bg-black/30 h-32">
            <img
              src={blog.banner_url}
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 text-xs font-bold text-[#d4d2c5]">
            {seasonLogo && (
              <img
                src={seasonLogo}
                alt={scopeLabel}
                width={16}
                height={16}
                className="w-4 h-4 object-contain shrink-0"
              />
            )}
            <span className="truncate">{scopeLabel}</span>
          </div>
          <div
            className="w-7 h-7 rounded bg-black/35 border border-[#c89b3c]/40 flex items-center justify-center shrink-0"
            title="Blog Post"
          >
            <FileText className="w-4 h-4 text-[#f0c020]" />
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="wow-heading text-base font-bold text-[#f0ede0] truncate leading-snug">
            {blog.title}
          </h3>
          {blog.subtitle && (
            <p className="text-xs text-[#c7c5b8] line-clamp-2 break-words [overflow-wrap:anywhere] mt-1">
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
            Published {publishedDate}
          </span>
        )}
      </div>
    </Link>
  );
}

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

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

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

  const isNew =
    !!blog.published_at &&
    Date.now() - new Date(blog.published_at).getTime() < NEW_WINDOW_MS;
  const newBadge = isNew ? (
    <span aria-label="New" className="retro-new-badge">
      {["N", "E", "W", "!"].map((ch, i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 0.12}s` }}
          className="retro-new-letter"
        >
          {ch}
        </span>
      ))}
    </span>
  ) : null;

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
        prefetch={false}
        style={cardStyle}
        className="xp-panel relative overflow-hidden px-3 py-2.5 hover:brightness-110 transition flex flex-col gap-2 lg:grid lg:grid-cols-[148px_145px_minmax(0,1fr)_auto] lg:items-center lg:gap-3"
      >
        {newBadge}
        <div className="flex items-center gap-3 min-w-0 lg:contents">
          <div className="w-36 sm:w-40 lg:w-full shrink-0 flex items-center gap-2 px-2 py-1.5 rounded bg-black/25 border border-white/10 min-w-0">
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

          <div className="min-w-0 flex-1 lg:flex-none">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="wow-heading text-base font-bold text-[#f0ede0] leading-tight truncate">
                  Blog Post
                </div>
                {hasSeason && (
                  <div className="text-xs font-bold text-[#93c5fd] leading-tight truncate mt-0.5">
                    {scopeLabel}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 lg:hidden">
                {seasonLogo && (
                  <img
                    src={seasonLogo}
                    alt={scopeLabel}
                    width={20}
                    height={20}
                    className="w-5 h-5 object-contain shrink-0"
                  />
                )}
                <span
                  title="Blog Post"
                  className="w-5 h-5 rounded bg-[#2a2210] border border-[#c89b3c]/70 inline-flex items-center justify-center shrink-0"
                >
                  <FileText className="w-3 h-3 text-[#f0c020]" />
                </span>
              </div>
            </div>
            <div className="lg:hidden text-[11px] text-[#c7c5b8] truncate mt-0.5">
              {blog.title}
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 min-w-0">
          {seasonLogo ? (
            <img
              src={seasonLogo}
              alt={scopeLabel}
              width={24}
              height={24}
              className="w-6 h-6 object-contain shrink-0"
            />
          ) : (
            <span className="w-6 h-6 shrink-0" aria-hidden="true" />
          )}
          <span
            title="Blog Post"
            className="w-6 h-6 rounded bg-[#2a2210] border border-[#c89b3c]/70 inline-flex items-center justify-center shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#f0c020]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#c7c5b8] truncate">
              {blog.title}
            </div>
            {blog.subtitle && (
              <div className="text-[11px] text-[#a6a89e] truncate">
                {blog.subtitle}
              </div>
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
      prefetch={false}
      style={cardStyle}
      className="xp-panel relative overflow-hidden p-3.5 hover:brightness-110 transition flex flex-col justify-between gap-2.5"
    >
      {newBadge}
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        {seasonLogo && (
          <img
            src={seasonLogo}
            alt={scopeLabel}
            width={24}
            height={24}
            className="w-6 h-6 object-contain shrink-0"
          />
        )}
        <div
          className="w-6 h-6 rounded bg-[#2a2210] border border-[#c89b3c]/70 flex items-center justify-center shrink-0"
          title="Blog Post"
        >
          <FileText className="w-3.5 h-3.5 text-[#f0c020]" />
        </div>
      </div>

      <div className="flex items-stretch gap-3 min-w-0">
        <div className="w-20 sm:w-24 shrink-0 flex flex-col items-center justify-center text-center gap-1.5 p-2 rounded bg-black/25 border border-white/10">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={authorDisplay}
              width={48}
              height={48}
              loading="lazy"
              className="w-12 h-12 rounded-md object-cover border border-white/30 shrink-0"
            />
          ) : (
            <span className="w-12 h-12 rounded-md bg-[#2563eb] text-white text-lg font-bold inline-flex items-center justify-center shrink-0">
              {authorDisplay.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-xs font-bold text-[#f0c020] truncate w-full text-center">
            {authorDisplay}
          </span>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center py-0.5 space-y-0.5">
          <div className="wow-heading text-[15px] sm:text-base font-bold text-[#f0ede0] leading-tight truncate pr-12">
            Blog Post
          </div>
          {hasSeason && (
            <div className="text-xs font-bold text-[#93c5fd] leading-tight truncate">
              {scopeLabel}
            </div>
          )}
          <h3 className="text-xs font-semibold text-[#c7c5b8] line-clamp-2 break-words [overflow-wrap:anywhere] leading-snug pt-0.5">
            {blog.title}
          </h3>
        </div>
      </div>

      <div className="pt-2 border-t border-white/10 flex items-center justify-end text-[11px] text-[#a6a89e]">
        {publishedDate ? `Published ${publishedDate}` : ""}
      </div>
    </Link>
  );
}

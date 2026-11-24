"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Edit3, FileText, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cleanupBlogMedia } from "@/utils/blogMedia";
import { unwrap } from "@/utils/formatters";
import { RetroWindow } from "@/components/RetroWindow";
import { BlogMarkdown } from "@/components/BlogMarkdown";
import type { Blog } from "@/types/database";

interface BlogViewProps {
  blog: Blog;
  isOwner: boolean;
  isAdmin?: boolean;
}

export function BlogView({ blog, isOwner, isAdmin = false }: BlogViewProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const profile = unwrap(blog.profiles);
  const season = unwrap(blog.seasons);
  const league = unwrap(season?.leagues);

  const authorDisplay = blog.author_name?.trim() || profile?.username || "Author";
  const leaguePrefix =
    league?.short_name ||
    (league?.slug === "scdl" ? "SCDL" : league?.name) ||
    blog.league_name_snapshot ||
    "";
  const seasonName = season?.name ?? blog.season_name_snapshot ?? "";
  const hasSeason = Boolean(seasonName);
  const scopeLabel = hasSeason
    ? `${leaguePrefix ? `${leaguePrefix}: ` : ""}${seasonName}`
    : "Blog Post";
  const seasonLogo = hasSeason ? league?.logo_url ?? null : null;

  const truncatedTitle =
    blog.title.length > 42 ? `${blog.title.slice(0, 42)}...` : blog.title;
  const windowTitle = hasSeason
    ? `${scopeLabel} Blog Post - ${truncatedTitle}`
    : `Blog Post - ${truncatedTitle}`;

  const publishedDate = blog.published_at
    ? new Date(blog.published_at).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/blog/${blog.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this blog post? This cannot be undone.")) return;
    setDeleting(true);
    setErrorMsg(null);
    const supabase = createClient();
    await cleanupBlogMedia(supabase, blog.banner_url, blog.content);
    const res = await fetch("/api/publish", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "blog", id: blog.id }),
    }).catch(() => null);
    if (!res?.ok) {
      const json = (await res?.json().catch(() => null)) as {
        error?: string;
      } | null;
      setErrorMsg(`Failed to delete: ${json?.error ?? "Request failed"}`);
      setDeleting(false);
      return;
    }
    router.push("/browse");
    router.refresh();
  }

  return (
    <RetroWindow title="Blog Post" theme="scdl">
      <div className="space-y-5">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
          <Link href="/browse" className="xp-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse Content</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {blog.status === "draft" && (
              <span className="px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]">
                Draft
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="xp-btn xp-btn-primary text-xs"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied!" : "Copy Link"}</span>
            </button>

            {isOwner && (
              <Link
                href={`/create?type=blog&edit=${blog.id}`}
                className="xp-btn text-xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#f0c020]" />
                <span>Edit</span>
              </Link>
            )}

            {(isOwner || isAdmin) && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="xp-btn text-xs text-[#ff857a]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? "Deleting..." : "Delete"}</span>
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="xp-inset border-[#ff857a]/50 bg-[#3a1616]/50 px-3 py-2 text-xs text-[#ff857a]">
            {errorMsg}
          </div>
        )}

        {/* Article Container */}
        <article className="max-w-4xl mx-auto space-y-6">
          {blog.banner_url && (
            <div className="rounded-xl overflow-hidden border border-[#c89b3c]/35 bg-black/40 shadow-xl">
              <img
                src={blog.banner_url}
                alt={blog.title}
                className="w-full max-h-[420px] object-cover"
              />
            </div>
          )}

          <header className="space-y-3 border-b border-[#c89b3c]/25 pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#d4d2c5]">
              <FileText className="w-4 h-4 text-[#f0c020] shrink-0" />
              {hasSeason && (
                <>
                  {seasonLogo && (
                    <img
                      src={seasonLogo}
                      alt={scopeLabel}
                      width={18}
                      height={18}
                      className="w-[18px] h-[18px] object-contain shrink-0"
                    />
                  )}
                  {season?.slug ? (
                    <Link
                      href={`/browse?season=${encodeURIComponent(season.slug)}`}
                      className="text-[#f0c020] hover:underline"
                    >
                      {scopeLabel}
                    </Link>
                  ) : (
                    <span>{scopeLabel}</span>
                  )}
                </>
              )}
            </div>

            <h1 className="wow-heading text-2xl sm:text-4xl font-bold text-[#f0ede0] leading-tight break-words [overflow-wrap:anywhere]">
              {blog.title}
            </h1>

            {blog.subtitle && (
              <p className="text-base sm:text-lg text-[#c7c5b8] leading-snug break-words [overflow-wrap:anywhere]">
                {blog.subtitle}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-[#a6a89e]">
              {profile?.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={authorDisplay}
                  className="w-6 h-6 rounded-full border border-[#c89b3c]/50 object-cover"
                />
              )}
              <span>
                By <strong className="text-[#f0ede0]">{authorDisplay}</strong>
              </span>
              {publishedDate && (
                <>
                  <span>•</span>
                  <span>{publishedDate}</span>
                </>
              )}
            </div>
          </header>

          <div className="xp-panel p-5 sm:p-8">
            <BlogMarkdown content={blog.content} />
          </div>
        </article>
      </div>
    </RetroWindow>
  );
}

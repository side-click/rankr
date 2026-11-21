"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  Minus,
  PenLine,
  Quote,
  Save,
  Send,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { RetroWindow } from "@/components/RetroWindow";
import { BlogMarkdown } from "@/components/BlogMarkdown";
import type { Blog, Season } from "@/types/database";

interface BlogEditorProps {
  userId: string;
  initialAuthorName: string;
  discordDefaultName: string;
  seasons: Season[];
  initialSeasonSlug?: string;
  initialBlog?: Blog | null;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getLeaguePrefix(season: Season | undefined): string {
  if (!season?.leagues) return "";
  return (
    season.leagues.short_name ||
    (season.leagues.slug === "scdl" ? "SCDL" : season.leagues.name)
  );
}

export function BlogEditor({
  userId,
  initialAuthorName,
  discordDefaultName,
  seasons,
  initialSeasonSlug,
  initialBlog,
}: BlogEditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);

  const defaultSeasonId = useMemo(() => {
    if (initialBlog) return initialBlog.season_id ?? "";
    if (initialSeasonSlug) {
      const matched = seasons.find((s) => s.slug === initialSeasonSlug);
      if (matched) return matched.id;
    }
    return "";
  }, [initialBlog, initialSeasonSlug, seasons]);

  const [blogId, setBlogId] = useState<string | null>(initialBlog?.id ?? null);
  const [seasonId, setSeasonId] = useState<string>(defaultSeasonId);
  const [title, setTitle] = useState<string>(initialBlog?.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initialBlog?.subtitle ?? "");
  const [bannerUrl, setBannerUrl] = useState<string>(
    initialBlog?.banner_url ?? ""
  );
  const [content, setContent] = useState<string>(initialBlog?.content ?? "");

  const initialCustomAuthor =
    initialBlog?.author_name &&
    initialBlog.author_name !== discordDefaultName
      ? initialBlog.author_name
      : initialAuthorName !== discordDefaultName
      ? initialAuthorName
      : "";
  const [showAuthorField, setShowAuthorField] = useState<boolean>(
    Boolean(initialCustomAuthor)
  );
  const [authorName, setAuthorName] = useState<string>(
    initialBlog?.author_name ?? initialAuthorName
  );

  const [mode, setMode] = useState<"write" | "preview">("write");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const displayAuthor =
    (showAuthorField ? authorName.trim() : "") || discordDefaultName;

  async function uploadImageToBucket(
    file: File,
    prefix: "banner" | "inline"
  ): Promise<string | null> {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setErrorMsg("Supported formats: PNG, JPEG, WEBP, or GIF.");
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMsg("Image file size must be 5 MB or smaller.");
      return null;
    }

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("blog-media")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setErrorMsg(`Upload failed: ${uploadErr.message}`);
      return null;
    }

    const { data: pub } = supabase.storage
      .from("blog-media")
      .getPublicUrl(path);
    return pub.publicUrl;
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMsg(null);
    setUploadingBanner(true);
    const url = await uploadImageToBucket(file, "banner");
    if (url) setBannerUrl(url);
    setUploadingBanner(false);
  }

  async function handleInlineImageUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMsg(null);
    setUploadingInline(true);
    const url = await uploadImageToBucket(file, "inline");
    if (url) {
      insertSnippet(`\n![image](${url})\n`);
    }
    setUploadingInline(false);
  }

  function insertSnippet(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function wrapSelection(
    prefix: string,
    suffix: string,
    placeholder: string
  ) {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}${prefix}${placeholder}${suffix}`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || placeholder;
    const next =
      content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const selStart = start + prefix.length;
      el.setSelectionRange(selStart, selStart + selected.length);
    });
  }

  async function persistBlog(targetStatus: "draft" | "published") {
    setErrorMsg(null);
    setStatusMsg(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg("Please enter a title for your blog post.");
      return;
    }
    if (targetStatus === "published" && !content.trim()) {
      setErrorMsg("Please write some content before publishing.");
      return;
    }

    if (targetStatus === "published") {
      setPublishing(true);
    } else {
      setSaving(true);
    }

    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const seasonObj = seasons.find((s) => s.id === seasonId) ?? null;
    const leagueNameSnapshot = seasonObj?.leagues?.name ?? null;
    const seasonNameSnapshot = seasonObj?.name ?? null;

    const payload = {
      user_id: userId,
      author_name: displayAuthor,
      title: trimmedTitle,
      subtitle: subtitle.trim() || null,
      banner_url: bannerUrl.trim() || null,
      content,
      season_id: seasonId || null,
      season_name_snapshot: seasonNameSnapshot,
      league_name_snapshot: leagueNameSnapshot,
      status: targetStatus,
      published_at:
        targetStatus === "published"
          ? initialBlog?.published_at ?? nowIso
          : null,
      updated_at: nowIso,
    };

    let savedId = blogId;
    if (savedId) {
      const { error } = await supabase
        .from("blogs")
        .update(payload)
        .eq("id", savedId)
        .eq("user_id", userId);

      if (error) {
        setErrorMsg(`Failed to save blog: ${error.message}`);
        setSaving(false);
        setPublishing(false);
        return;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("blogs")
        .insert(payload)
        .select("id")
        .single();

      if (error || !inserted) {
        setErrorMsg(`Failed to create blog: ${error?.message ?? "Unknown error"}`);
        setSaving(false);
        setPublishing(false);
        return;
      }
      savedId = inserted.id;
      setBlogId(savedId);
    }

    if (targetStatus === "published" && savedId) {
      fetch("/api/notify-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId: savedId }),
      }).catch(() => {});
      router.push(`/blog/${savedId}`);
      router.refresh();
      return;
    }

    setSaving(false);
    setStatusMsg("Draft saved.");
    router.refresh();
  }

  return (
    <RetroWindow
      title={initialBlog ? "Edit Blog Post" : "Blog Post Editor"}
      theme="scdl"
    >
      <div className="space-y-4">
        {/* Top Metadata: Associated Season + Author in separate frames */}
        <div className="xp-panel p-3">
          <label className="block text-[11px] font-bold text-[#c7c5b8] mb-1">
            Associated Season (optional)
          </label>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className="w-full sm:w-80 xp-inset px-2.5 py-1.5 text-xs"
          >
            <option value="">General Post (No Associated Season)</option>
            {seasons.map((s) => {
              const prefix = getLeaguePrefix(s);
              return (
                <option key={s.id} value={s.id}>
                  {prefix ? `${prefix}: ` : ""}
                  {s.name}
                </option>
              );
            })}
          </select>
        </div>

        <div className="xp-panel p-3">
          <div className="w-full sm:w-80">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#c7c5b8] flex items-center gap-1">
                {showAuthorField && (
                  <UserCheck className="w-3 h-3 text-[#f0c020]" />
                )}
                <span>Author</span>
              </label>
              {showAuthorField && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthorField(false);
                    setAuthorName(discordDefaultName);
                  }}
                  className="text-[10px] text-[#a6a89e] hover:text-white cursor-pointer"
                >
                  Reset to Discord
                </button>
              )}
            </div>
            {!showAuthorField ? (
              <div className="flex items-center justify-between gap-2 xp-inset px-2.5 py-1.5 text-xs">
                <strong className="text-[#f0ede0] truncate">
                  {discordDefaultName}
                </strong>
                <button
                  type="button"
                  onClick={() => setShowAuthorField(true)}
                  className="text-[11px] font-bold text-[#f0c020] hover:underline shrink-0 cursor-pointer"
                >
                  + Custom Name
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={discordDefaultName}
                maxLength={60}
                className="w-full xp-inset px-2.5 py-1.5 text-xs"
              />
            )}
          </div>
        </div>

        {/* Title, Subtitle, Banner */}
        <div className="xp-panel p-3 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#c7c5b8] mb-1">
              Title <span className="text-[#ff857a]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your blog post a headline..."
              maxLength={70}
              className="w-full max-w-2xl xp-inset px-3 py-2 text-sm font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#c7c5b8] mb-1">
              Subtitle (Optional)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="A short deck or summary..."
              maxLength={155}
              className="w-full xp-inset px-3 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#c7c5b8] mb-1">
              Banner / Spotlight Image (Optional)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="Paste image/GIF URL or upload..."
                className="w-full sm:w-72 xp-inset px-2.5 py-1.5 text-xs"
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleBannerUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                className="xp-btn text-xs"
              >
                <ImagePlus className="w-3.5 h-3.5 text-[#f0c020]" />
                <span>{uploadingBanner ? "Uploading..." : "Upload Banner"}</span>
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setBannerUrl("")}
                  className="xp-btn text-xs text-[#ff857a]"
                  title="Remove banner"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Write / Preview Body */}
        <div className="xp-panel p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex xp-inset p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setMode("write")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xs cursor-pointer ${
                  mode === "write"
                    ? "bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]"
                    : "text-[#c7c5b8] hover:text-white"
                }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Write</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xs cursor-pointer ${
                  mode === "preview"
                    ? "bg-[#2a2210] border border-[#c89b3c] text-[#f0c020]"
                    : "text-[#c7c5b8] hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            {mode === "write" && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => insertSnippet("\n## Section Title\n")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Section Heading (##)"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                  <span>Section</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("\n### Subsection\n")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Subsection Heading (###)"
                >
                  <Heading3 className="w-3.5 h-3.5" />
                  <span>Subsection</span>
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection("**", "**", "bold text")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection("*", "*", "italic text")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("\n> Quote text\n")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Blockquote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("\n- List item\n")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet("\n---\n")}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Horizontal Divider"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    wrapSelection("[", "](https://example.com)", "link text")
                  }
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Link"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={inlineImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleInlineImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => inlineImageInputRef.current?.click()}
                  disabled={uploadingInline}
                  className="xp-btn px-2 py-1 text-[11px]"
                  title="Upload Image or GIF into body"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-[#f0c020]" />
                  <span>{uploadingInline ? "Uploading..." : "Image / GIF"}</span>
                </button>
              </div>
            )}
          </div>

          {mode === "write" ? (
            <div className="space-y-1.5">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                maxLength={25000}
                placeholder={`Write your post using basic Markdown...\n\n## Section Heading\nShare your thoughts, breakdowns, or stories.\n\n![Caption](https://...)`}
                className="w-full xp-inset p-3 text-sm font-mono leading-relaxed resize-y min-h-[280px]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#a6a89e]">
                <span>
                  Supports Markdown headings (<code>##</code>, <code>###</code>),
                  bold, italic, quotes (<code>&gt;</code>), lists, links, dividers (
                  <code>---</code>), and images/GIFs (<code>![alt](url)</code>).
                </span>
                <span className="tabular-nums shrink-0">
                  {content.length.toLocaleString()} / 25,000
                </span>
              </div>
            </div>
          ) : (
            <div className="xp-inset p-4 sm:p-6 space-y-5 min-h-[280px]">
              {bannerUrl && (
                <div className="rounded-lg overflow-hidden border border-white/15 bg-black/30">
                  <img
                    src={bannerUrl}
                    alt={title || "Banner preview"}
                    className="w-full max-h-80 object-cover"
                  />
                </div>
              )}
              <div className="space-y-1.5 border-b border-white/10 pb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#f0c020]">
                  {selectedSeason
                    ? `${getLeaguePrefix(selectedSeason) ? `${getLeaguePrefix(selectedSeason)}: ` : ""}${selectedSeason.name}`
                    : "General"}
                </div>
                <h1 className="wow-heading text-2xl sm:text-3xl font-bold text-[#f0ede0] break-words [overflow-wrap:anywhere]">
                  {title.trim() || "Untitled Blog Post"}
                </h1>
                {subtitle.trim() && (
                  <p className="text-sm sm:text-base text-[#c7c5b8] line-clamp-2 break-words [overflow-wrap:anywhere]">
                    {subtitle.trim()}
                  </p>
                )}
                <p className="text-xs text-[#a6a89e] pt-1">
                  By <strong className="text-[#f0ede0]">{displayAuthor}</strong>
                </p>
              </div>
              <BlogMarkdown content={content} />
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="xp-inset border-[#ff857a]/50 bg-[#3a1616]/50 px-3 py-2 text-xs text-[#ff857a]">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="xp-inset border-[#7cd438]/50 bg-[#14301a]/50 px-3 py-2 text-xs text-[#7cd438]">
            {statusMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {blogId && initialBlog && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Delete this blog post? This cannot be undone.")) {
                    return;
                  }
                  const supabase = createClient();
                  const { error } = await supabase
                    .from("blogs")
                    .delete()
                    .eq("id", blogId);
                  if (error) {
                    setErrorMsg(`Delete failed: ${error.message}`);
                    return;
                  }
                  router.push("/my-history");
                  router.refresh();
                }}
                className="xp-btn text-xs text-[#ff857a]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => persistBlog("draft")}
              disabled={saving || publishing}
              className="xp-btn text-xs px-3 py-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Draft"}</span>
            </button>
            <button
              type="button"
              onClick={() => persistBlog("published")}
              disabled={saving || publishing}
              className="xp-btn xp-btn-primary text-xs px-3 py-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {publishing
                  ? "Publishing..."
                  : initialBlog?.status === "published"
                  ? "Update Published Blog"
                  : "Publish Blog"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </RetroWindow>
  );
}

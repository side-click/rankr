import type { SupabaseClient } from "@supabase/supabase-js";

const BLOG_MEDIA_PUBLIC_MARKER = "/storage/v1/object/public/blog-media/";

/**
 * Resize and WebP-compress static PNG/JPEG/WEBP images client-side before
 * uploading to `blog-media`. GIFs are returned untouched to preserve animation.
 */
export async function optimizeBlogImageForUpload(
  file: File,
  kind: "banner" | "inline"
): Promise<File> {
  if (file.type === "image/gif") return file;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const maxWidth = kind === "banner" ? 1600 : 1200;
  const quality = kind === "banner" ? 0.86 : 0.85;

  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image decode failed"));
      el.src = objectUrl;
    }).finally(() => URL.revokeObjectURL(objectUrl));

    const scale =
      img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
    const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

/**
 * Extract unique `blog-media` storage object paths referenced by a blog's
 * banner URL and Markdown body.
 */
export function extractBlogMediaPaths(
  bannerUrl?: string | null,
  content?: string | null
): string[] {
  const paths = new Set<string>();
  const combined = `${bannerUrl ?? ""}\n${content ?? ""}`;
  const regex =
    /\/storage\/v1\/object\/public\/blog-media\/([^\s)"'<>]+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(combined)) !== null) {
    const raw = match[1]?.split("?")[0];
    if (raw) {
      try {
        paths.add(decodeURIComponent(raw));
      } catch {
        paths.add(raw);
      }
    }
  }
  return Array.from(paths);
}

/**
 * Best-effort removal of `blog-media` objects referenced by a deleted blog.
 */
export async function cleanupBlogMedia(
  supabase: SupabaseClient,
  bannerUrl?: string | null,
  content?: string | null
): Promise<void> {
  const paths = extractBlogMediaPaths(bannerUrl, content);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from("blog-media").remove(paths);
  } catch {
    // Non-fatal: row deletion should still proceed even if storage cleanup fails
  }
}

/**
 * Best-effort removal of `ballot-overlays` objects attached to a deleted ranking/tier list.
 */
export async function cleanupRankingOverlays(
  supabase: SupabaseClient,
  overlays?: { url?: string | null }[] | null
): Promise<void> {
  if (!Array.isArray(overlays) || overlays.length === 0) return;
  const marker = "/storage/v1/object/public/ballot-overlays/";
  const paths = new Set<string>();
  for (const item of overlays) {
    const url = item?.url;
    if (!url) continue;
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    const raw = url.slice(idx + marker.length).split("?")[0];
    if (raw) {
      try {
        paths.add(decodeURIComponent(raw));
      } catch {
        paths.add(raw);
      }
    }
  }
  if (paths.size === 0) return;
  try {
    await supabase.storage.from("ballot-overlays").remove(Array.from(paths));
  } catch {
    // Non-fatal
  }
}

export { BLOG_MEDIA_PUBLIC_MARKER };

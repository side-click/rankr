export type ModerationCategory =
  | "hate_speech"
  | "self_harm"
  | "explicit_illegal"
  | "doxxing"
  | "harassment_flag"
  | "external_media"
  | "custom_rule"
  | "ai_moderation";

export interface ModerationFieldInput {
  field: string;
  value: string | null | undefined;
}

export interface ModerationResult {
  action: "allow" | "flag" | "block";
  blockedFields: string[];
  flaggedFields: string[];
  categories: ModerationCategory[];
  matchedTerms: string[];
  externalImageCount: number;
  totalImageCount: number;
}

const BLOG_MEDIA_PUBLIC_MARKER = "/storage/v1/object/public/blog-media/";

export const BUILTIN_SAFE_WORDS = new Set<string>();

export function inspectMarkdownImages(markdown: string | null | undefined): {
  totalImages: number;
  externalImages: number;
  uploadedImages: number;
} {
  if (!markdown) {
    return { totalImages: 0, externalImages: 0, uploadedImages: 0 };
  }
  const matches = Array.from(markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g));
  let externalImages = 0;
  let uploadedImages = 0;
  for (const m of matches) {
    const url = (m[1] ?? "").trim();
    if (!url) continue;
    if (url.includes(BLOG_MEDIA_PUBLIC_MARKER)) {
      uploadedImages += 1;
    } else {
      externalImages += 1;
    }
  }
  return {
    totalImages: matches.length,
    externalImages,
    uploadedImages,
  };
}

export function formatBlockedMessage(blockedFields: string[]): string {
  const list =
    blockedFields.length > 0 ? blockedFields.join(", ") : "one or more fields";
  return `Unable to publish: prohibited content detected in ${list}. Please edit those fields and try again.`;
}

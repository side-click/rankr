/**
 * Validates user- or sheet-supplied external URLs so only safe `http:` or `https:` URLs are rendered.
 */
export function sanitizeExternalUrl(
  rawUrl: string | null | undefined,
  options?: { allowRelative?: boolean }
): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (options?.allowRelative && trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (trimmed.includes("\\")) return null;
    return trimmed;
  }

  // Reject protocol-relative URLs and control characters
  if (trimmed.startsWith("//") || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

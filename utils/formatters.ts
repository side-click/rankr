export type MaybeArray<T> = T | T[] | null | undefined;

/**
 * Unwraps a Supabase relation field that may be typed or returned as a
 * single object or a one-element array.
 */
export function unwrap<T>(val: MaybeArray<T>): T | null {
  if (Array.isArray(val)) return val[0] ?? null;
  return val ?? null;
}

/**
 * Derives a compact display prefix (e.g. "SCDL") from a league object or
 * fallback name.
 */
export function getLeaguePrefix(
  league: { name?: string; short_name?: string | null; slug?: string } | null | undefined,
  fallbackName?: string | null
): string {
  if (league?.short_name) return league.short_name;
  if (league?.slug === "scdl") return "SCDL";
  if (league?.name) return league.name;
  if (fallbackName === "Scuttle Crab Draft League") return "SCDL";
  return fallbackName ?? "";
}

/**
 * Derives an acronym/short prefix from a league name string (e.g.
 * "Scuttle Crab Draft League" -> "SCDL").
 */
export function deriveLeaguePrefix(leagueName?: string): string {
  const raw = (leagueName ?? "").trim();
  if (!raw) return "League";
  if (raw.length <= 6 && !raw.includes(" ")) return raw.toUpperCase();
  const initials = raw
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials || raw;
}

/**
 * Formats a signed numeric differential (e.g. +1,240 or -350).
 */
export function formatSigned(
  val: number | null | undefined,
  options?: { round?: boolean; fallback?: string }
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return options?.fallback ?? "\u2014";
  }
  const num = options?.round ? Math.round(val) : val;
  if (num > 0) return `+${options?.round ? num : num.toLocaleString()}`;
  return options?.round ? `${num}` : num.toLocaleString();
}

/**
 * Picks accessible light or dark foreground text based on a hex tier background.
 */
export function getTierContrastText(hex: string): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#111318" : "#ffffff";
}

/**
 * Normalizes champion names/IDs across Data Dragon, Google Sheets, and draft links.
 */
export function normalizeChampionKey(name: string): string {
  const k = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (k === "wukong") return "monkeyking";
  if (k === "renataglasc") return "renata";
  return k;
}

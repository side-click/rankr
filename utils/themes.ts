import type { DivisionTheme } from "@/types/database";

export const DEFAULT_DIVISION_THEMES: Record<string, DivisionTheme> = {
  baron: {
    key: "baron",
    name: "Baron Theme",
    primary_color: "#6b2d8b",
    secondary_color: "#00b8c9",
    accent_text_color: "#c77dff",
    default_logo_url: "/images/SCDL Logos/Baron.png",
  },
  dragon: {
    key: "dragon",
    name: "Dragon Theme",
    primary_color: "#e84a1b",
    secondary_color: "#3b1c4a",
    accent_text_color: "#ff8a5c",
    default_logo_url: "/images/SCDL Logos/Dragon.png",
  },
};

export function resolveDivisionTheme(
  themeKey: string | null | undefined,
  themes?: DivisionTheme[] | null
): DivisionTheme {
  const key = themeKey || "baron";
  const fromDb = themes?.find((t) => t.key === key);
  if (fromDb) return fromDb;
  return DEFAULT_DIVISION_THEMES[key] ?? DEFAULT_DIVISION_THEMES.baron;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [107, 45, 139];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mixHex(hexA: string, hexB: string, weightB: number): string {
  const [r1, g1, b1] = parseHex(hexA);
  const [r2, g2, b2] = parseHex(hexB);
  const w = Math.min(1, Math.max(0, weightB));
  const r = Math.round(r1 * (1 - w) + r2 * w);
  const g = Math.round(g1 * (1 - w) + g2 * w);
  const b = Math.round(b1 * (1 - w) + b2 * w);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getThemeGradients(theme: DivisionTheme) {
  const bannerStart = mixHex(theme.primary_color, "#0e0c14", 0.28);
  const bannerMid = mixHex(theme.primary_color, "#121018", 0.55);
  const bannerEnd = mixHex(theme.secondary_color, "#0e121c", 0.82);

  const titlebarStart = mixHex(theme.primary_color, "#0e0c14", 0.28);
  const titlebarMid = theme.primary_color;
  const titlebarEnd = mixHex(theme.secondary_color, "#161b22", 0.68);

  return {
    bannerGradient: `linear-gradient(90deg, ${bannerStart} 0%, ${bannerMid} 52%, ${bannerEnd} 100%)`,
    titlebarGradient: `linear-gradient(90deg, ${titlebarStart} 0%, ${titlebarMid} 50%, ${titlebarEnd} 100%)`,
  };
}

export interface RankColorStyle {
  /** Dark-mode card background gradient */
  cardBg: string;
  /** Solid fallback/row background for PNG export & table rows */
  rowBg: string;
  /** Subtle border / left accent color */
  borderColor: string;
  /** Rank badge background */
  badgeBg: string;
  /** Rank badge text color */
  badgeText: string;
}

interface RgbStop {
  t: number;
  card: [number, number, number];
  border: [number, number, number];
  badge: [number, number, number];
}

// Purple -> Blue -> Green -> Yellow -> Orange -> Red
const COLOR_STOPS: RgbStop[] = [
  { t: 0.0, card: [56, 36, 78], border: [148, 102, 208], badge: [92, 54, 138] }, // Purple
  { t: 0.2, card: [30, 48, 82], border: [82, 132, 214], badge: [44, 76, 138] }, // Blue
  { t: 0.4, card: [28, 62, 46], border: [74, 166, 114], badge: [40, 102, 68] }, // Green
  { t: 0.6, card: [68, 58, 24], border: [194, 166, 56], badge: [112, 94, 32] }, // Yellow
  { t: 0.8, card: [78, 44, 24], border: [212, 122, 58], badge: [128, 68, 32] }, // Orange
  { t: 1.0, card: [76, 30, 34], border: [204, 78, 82], badge: [124, 42, 46] }, // Red
];

function lerp(a: number, b: number, f: number): number {
  return Math.round(a + (b - a) * f);
}

function lerpRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  f: number
): [number, number, number] {
  return [lerp(c1[0], c2[0], f), lerp(c1[1], c2[1], f), lerp(c1[2], c2[2], f)];
}

function rgbStr([r, g, b]: [number, number, number], alpha = 1): string {
  return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
}

/**
 * Computes a smooth Purple -> Blue -> Green -> Yellow -> Orange -> Red
 * color scheme for a given 0-based position and total team count.
 * Position 0 is always Purple; the last position is always Red.
 */
export function getRankColor(index: number, total: number): RankColorStyle {
  const t = total <= 1 ? 0 : Math.min(1, Math.max(0, index / (total - 1)));

  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i].t && t <= COLOR_STOPS[i + 1].t) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }

  const span = upper.t - lower.t;
  const f = span === 0 ? 0 : (t - lower.t) / span;

  const cardRgb = lerpRgb(lower.card, upper.card, f);
  const cardDark: [number, number, number] = [
    Math.round(cardRgb[0] * 0.72),
    Math.round(cardRgb[1] * 0.72),
    Math.round(cardRgb[2] * 0.72),
  ];
  const borderRgb = lerpRgb(lower.border, upper.border, f);
  const badgeRgb = lerpRgb(lower.badge, upper.badge, f);

  return {
    cardBg: `linear-gradient(135deg, ${rgbStr(cardRgb, 0.95)} 0%, ${rgbStr(cardDark, 0.98)} 100%)`,
    rowBg: rgbStr(cardRgb, 0.88),
    borderColor: rgbStr(borderRgb, 0.55),
    badgeBg: rgbStr(badgeRgb, 0.95),
    badgeText: "#f8f6ea",
  };
}

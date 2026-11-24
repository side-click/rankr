import type {
  PlayerTierListPayload,
  TierPresetKey,
  TierRowData,
  TierVariant,
} from "@/types/database";
import { LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";

export interface TierPresetDefinition {
  key: Exclude<TierPresetKey, "custom">;
  name: string;
  description: string;
  tiers: { label: string; color: string }[];
}

export const TIER_PRESETS: TierPresetDefinition[] = [
  {
    key: "standard",
    name: "Standard Tiers",
    description: "S, A, B, C, D",
    tiers: [
      { label: "S", color: "#58367a" },
      { label: "A", color: "#344e78" },
      { label: "B", color: "#2f6343" },
      { label: "C", color: "#7d6a27" },
      { label: "D", color: "#8a5426" },
    ],
  },
  {
    key: "draft_day",
    name: "Draft Day Tiers",
    description: "Safe Baron → Safe Dragon",
    tiers: [
      { label: "Safe Baron", color: "#58367a" },
      { label: "Lean Baron", color: "#344e78" },
      { label: "On The Bubble", color: "#4f5561" },
      { label: "Lean Dragon", color: "#875427" },
      { label: "Safe Dragon", color: "#8f3826" },
    ],
  },
];

export const DEFAULT_TIER_COLORS = [
  "#8f3434",
  "#8f3826",
  "#8a5426",
  "#7d6a27",
  "#2f6343",
  "#2b5c6b",
  "#33517a",
  "#58367a",
  "#7a3659",
  "#4f5561",
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTierVariantKey(
  preset: Exclude<TierPresetKey, "custom">,
  splitByRole: boolean
): TierVariant {
  if (preset === "draft_day") {
    return splitByRole ? "draft_day_split" : "draft_day_overall";
  }
  return splitByRole ? "standard_split" : "standard_overall";
}

export function createPresetTierRows(
  presetKey: Exclude<TierPresetKey, "custom">
): TierRowData[] {
  const def =
    TIER_PRESETS.find((p) => p.key === presetKey) ?? TIER_PRESETS[0];
  return def.tiers.map((t) => ({
    id: makeId("tier"),
    label: t.label,
    color: t.color,
    commentary: "",
    players: [],
  }));
}

export function createEmptyTierRow(
  label = "New Tier",
  colorIndex = 0
): TierRowData {
  return {
    id: makeId("tier"),
    label,
    color: DEFAULT_TIER_COLORS[colorIndex % DEFAULT_TIER_COLORS.length],
    commentary: "",
    players: [],
  };
}

export function createInitialTierPayload(
  presetKey: Exclude<TierPresetKey, "custom">,
  splitByRole: boolean
): PlayerTierListPayload {
  if (!splitByRole) {
    return {
      preset: presetKey,
      splitByRole: false,
      sections: [
        {
          role: "all",
          tiers: createPresetTierRows(presetKey),
        },
      ],
    };
  }

  return {
    preset: presetKey,
    splitByRole: true,
    sections: LEAGUE_ROLES.map((r) => ({
      role: r.key,
      tiers: createPresetTierRows(presetKey),
    })),
  };
}

export function getRoleSectionTitle(role: LeagueRole | "all"): string {
  switch (role) {
    case "top":
      return "Top Lane";
    case "jungle":
      return "Jungle";
    case "mid":
      return "Mid Lane";
    case "bot":
      return "Bot Lane";
    case "support":
      return "Support";
    default:
      return "All Players";
  }
}

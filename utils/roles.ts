export type LeagueRole = "top" | "jungle" | "mid" | "bot" | "support";

export interface RosterSlot {
  role: LeagueRole;
  name: string;
  is_captain?: boolean;
}

export const LEAGUE_ROLES: {
  key: LeagueRole;
  label: string;
  icon: string;
}[] = [
  { key: "top", label: "Top", icon: "/images/Roles/120px-Top_icon.webp" },
  { key: "jungle", label: "Jungle", icon: "/images/Roles/120px-Jungle_icon.webp" },
  { key: "mid", label: "Mid", icon: "/images/Roles/120px-Middle_icon.webp" },
  { key: "bot", label: "Bot", icon: "/images/Roles/120px-Bottom_icon.webp" },
  { key: "support", label: "Support", icon: "/images/Roles/120px-Support_icon.webp" },
];

export const CAPTAIN_ICON = "/images/Roles/captain_crop.png";

export function getRoleMeta(role: LeagueRole) {
  return LEAGUE_ROLES.find((r) => r.key === role) ?? LEAGUE_ROLES[0];
}

export function normalizeRoster(
  rawRoster: (string | RosterSlot)[] | null | undefined,
  captainName?: string | null
): RosterSlot[] {
  const items = Array.isArray(rawRoster) ? rawRoster : [];
  const capLower = captainName?.trim().toLowerCase() ?? "";

  return LEAGUE_ROLES.map((roleDef, idx) => {
    const entry = items[idx];
    if (entry && typeof entry === "object" && "name" in entry) {
      return {
        role: (entry.role as LeagueRole) ?? roleDef.key,
        name: entry.name ?? "",
        is_captain: Boolean(entry.is_captain),
      };
    }

    const name = typeof entry === "string" ? entry : "";
    const isCap =
      Boolean(capLower) &&
      name.trim().toLowerCase().replace(/\s+/g, "").startsWith(capLower.replace(/\s+/g, ""));

    return {
      role: roleDef.key,
      name,
      is_captain: isCap,
    };
  });
}

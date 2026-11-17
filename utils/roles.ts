export type LeagueRole = "top" | "jungle" | "mid" | "bot" | "support";

export interface RosterSlot {
  role: LeagueRole;
  name: string;
  is_captain?: boolean;
  alt_accounts?: string[];
}

export const LEAGUE_ROLES: {
  key: LeagueRole;
  label: string;
  icon: string;
}[] = [
  { key: "top", label: "Top", icon: "/images/roles/top.webp" },
  { key: "jungle", label: "Jungle", icon: "/images/roles/jungle.webp" },
  { key: "mid", label: "Mid", icon: "/images/roles/mid.webp" },
  { key: "bot", label: "Bot", icon: "/images/roles/bot.webp" },
  { key: "support", label: "Support", icon: "/images/roles/support.webp" },
];

export const CAPTAIN_ICON = "/images/roles/captain.png";

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
      const alts = Array.isArray(entry.alt_accounts)
        ? entry.alt_accounts.map((a) => String(a).trim()).filter(Boolean)
        : [];
      return {
        role: (entry.role as LeagueRole) ?? roleDef.key,
        name: entry.name ?? "",
        is_captain: Boolean(entry.is_captain),
        ...(alts.length > 0 ? { alt_accounts: alts } : {}),
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

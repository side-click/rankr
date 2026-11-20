import { ImageResponse } from "next/og";
import { createClient } from "@/utils/supabase/server";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import { loadOgFonts, resolveOgImageSrc } from "@/utils/ogFonts";
import type { LeagueRole } from "@/utils/roles";
import type { DivisionTheme, PlayerTierListPayload } from "@/types/database";

export const alt = "Rankr — Published Ranking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SCDL_GREEN_THEME: DivisionTheme = {
  key: "scdl",
  name: "SCDL Green",
  primary_color: "#1b5e36",
  secondary_color: "#0f2e1f",
  accent_text_color: "#f0c020",
  default_logo_url: null,
};

function getTierContrastText(hex: string): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#111318" : "#ffffff";
}

const RANK_COLORS = ["#7c3aed", "#3b82f6", "#06b6d4"];

export default async function BallotOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ballot }, { data: themesData }, fonts] = await Promise.all([
    supabase
      .from("rankings")
      .select(
        `
        title,
        ranking_type,
        tier_data,
        division_id,
        division_theme_snapshot,
        author_notes,
        league_name_snapshot,
        season_name_snapshot,
        division_name_snapshot,
        edition_name_snapshot,
        profiles ( username, avatar_url ),
        seasons ( name, leagues ( name, logo_url ) ),
        divisions ( name, theme_key ),
        editions ( name ),
        ranking_entries ( rank, team_name_snapshot, team_logo_snapshot, commentary, teams ( name, logo_url ) )
      `
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle(),
    supabase.from("division_themes").select("*"),
    loadOgFonts(),
  ]);

  if (!ballot) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#121715",
            color: "#f0c020",
            fontFamily: "WowHeading, serif",
            fontSize: "48px",
            fontWeight: 700,
          }}
        >
          Rankr — Rankings
        </div>
      ),
      { ...size, ...(fonts.length > 0 ? { fonts } : {}) }
    );
  }

  const profile = Array.isArray(ballot.profiles)
    ? ballot.profiles[0]
    : ballot.profiles;
  const season = Array.isArray(ballot.seasons)
    ? ballot.seasons[0]
    : ballot.seasons;
  const division = Array.isArray(ballot.divisions)
    ? ballot.divisions[0]
    : ballot.divisions;
  const edition = Array.isArray(ballot.editions)
    ? ballot.editions[0]
    : ballot.editions;

  const leagueObj = season?.leagues
    ? Array.isArray(season.leagues)
      ? season.leagues[0]
      : season.leagues
    : null;

  const leagueName =
    leagueObj?.name ??
    ballot.league_name_snapshot ??
    "Scuttle Crab Draft League";
  const seasonName = season?.name ?? ballot.season_name_snapshot ?? "";
  const isPlayerTierList = ballot.ranking_type === "player";
  const hasDivision = Boolean(
    ballot.division_id || division?.name || ballot.division_name_snapshot
  );
  const divisionName =
    division?.name ?? ballot.division_name_snapshot ?? "Division";
  const editionName = edition?.name ?? ballot.edition_name_snapshot ?? "";
  const authorName = profile?.username ?? "Voter";

  const headlineTitle =
    editionName ||
    ballot.title ||
    (isPlayerTierList ? "Player Tier List" : divisionName);

  const subTitle = isPlayerTierList
    ? hasDivision
      ? `${divisionName} Player Tier List`
      : "Player Tier List"
    : editionName
    ? `${divisionName} Team Power Rankings`
    : "Team Power Rankings";

  const theme =
    isPlayerTierList && !hasDivision
      ? SCDL_GREEN_THEME
      : resolveDivisionTheme(
          division?.theme_key ?? ballot.division_theme_snapshot,
          (themesData ?? []) as DivisionTheme[]
        );
  const { bannerGradient } = getThemeGradients(theme);

  const ROLE_PNG_ICONS: Record<LeagueRole, string> = {
    top: "/images/roles/top.png",
    jungle: "/images/roles/jungle.png",
    mid: "/images/roles/mid.png",
    bot: "/images/roles/bot.png",
    support: "/images/roles/support.png",
  };

  function fitPlayers(
    allNames: string[],
    maxPx: number,
    charPx: number,
    padPx: number,
    gapPx: number,
    maxLines = 1
  ): { players: string[]; extraCount: number } {
    const fitted: string[] = [];
    let currentLine = 1;
    let usedPx = 0;
    const extraBadgeReservePx = 62;

    for (let i = 0; i < allNames.length; i++) {
      const name = allNames[i];
      const pillPx = name.length * charPx + padPx;
      const gapBefore = usedPx > 0 ? gapPx : 0;
      const hasMoreAfter = i < allNames.length - 1;
      const reserve =
        currentLine === maxLines && hasMoreAfter
          ? gapPx + extraBadgeReservePx
          : 0;

      if (usedPx === 0 || usedPx + gapBefore + pillPx + reserve <= maxPx) {
        fitted.push(name);
        usedPx += gapBefore + pillPx;
      } else if (currentLine < maxLines) {
        currentLine += 1;
        const reserveOnNewLine = hasMoreAfter
          ? gapPx + extraBadgeReservePx
          : 0;
        if (pillPx + reserveOnNewLine <= maxPx || fitted.length === 0) {
          fitted.push(name);
          usedPx = pillPx;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return {
      players: fitted,
      extraCount: Math.max(0, allNames.length - fitted.length),
    };
  }

  const [avatarSrc, leagueLogoSrc, topIconSrc, jglIconSrc, midIconSrc, botIconSrc, supIconSrc] =
    await Promise.all([
      resolveOgImageSrc(profile?.avatar_url),
      resolveOgImageSrc(leagueObj?.logo_url),
      resolveOgImageSrc(ROLE_PNG_ICONS.top),
      resolveOgImageSrc(ROLE_PNG_ICONS.jungle),
      resolveOgImageSrc(ROLE_PNG_ICONS.mid),
      resolveOgImageSrc(ROLE_PNG_ICONS.bot),
      resolveOgImageSrc(ROLE_PNG_ICONS.support),
    ]);

  const roleIconMap: Record<LeagueRole, string | null> = {
    top: topIconSrc,
    jungle: jglIconSrc,
    mid: midIconSrc,
    bot: botIconSrc,
    support: supIconSrc,
  };

  const items = Array.isArray(ballot.ranking_entries) ? ballot.ranking_entries : [];
  const top3Raw = !isPlayerTierList
    ? [...items].sort((a, b) => a.rank - b.rank).slice(0, 3)
    : [];
  const top3 = await Promise.all(
    top3Raw.map(async (item) => {
      const team = Array.isArray(item.teams) ? item.teams[0] : item.teams;
      const teamName = team?.name ?? item.team_name_snapshot ?? "Team";
      const logoSrc = await resolveOgImageSrc(
        item.team_logo_snapshot || team?.logo_url
      );
      return { ...item, teamName, logoSrc };
    })
  );

  // Build preview data for Player Tier List cards
  const tierPayload = isPlayerTierList
    ? (ballot.tier_data as PlayerTierListPayload | null)
    : null;
  const isSplitRoleTierList = Boolean(
    isPlayerTierList && tierPayload?.splitByRole
  );

  type SplitRolePreviewCard = {
    role: LeagueRole;
    roleIconSrc: string | null;
    badgeText: string;
    color: string;
    players: string[];
    extraCount: number;
  };

  function buildSplitRoleCard(role: LeagueRole): SplitRolePreviewCard {
    const sec = tierPayload?.sections?.find((s) => s.role === role);
    const topTier = sec?.tiers?.[0];
    const allNames = (topTier?.players ?? []).map(
      (p) => p.name.split("#")[0].trim() || p.name
    );
    const rawTierLabel = (topTier?.label || "S").trim();
    const badgeText =
      rawTierLabel.length <= 3
        ? rawTierLabel
        : hasDivision
        ? divisionName.split(/\s+/)[0]
        : rawTierLabel.replace(/^Safe\s+/i, "").trim() || rawTierLabel;

    const { players, extraCount } = fitPlayers(
      allNames,
      344,
      10.5,
      26,
      8,
      2
    );

    return {
      role,
      roleIconSrc: roleIconMap[role],
      badgeText,
      color: topTier?.color || "#9333ea",
      players,
      extraCount,
    };
  }

  const splitLeftColumn: SplitRolePreviewCard[] = isSplitRoleTierList
    ? (["top", "jungle", "mid"] as LeagueRole[]).map(buildSplitRoleCard)
    : [];
  const splitRightColumn: SplitRolePreviewCard[] = isSplitRoleTierList
    ? (["bot", "support"] as LeagueRole[]).map(buildSplitRoleCard)
    : [];

  const playerPreviewRows: {
    key: string;
    badgeTitle: string;
    color: string;
    players: string[];
    extraCount: number;
    commentPreview: string;
  }[] = [];

  if (tierPayload && Array.isArray(tierPayload.sections) && !isSplitRoleTierList) {
    const firstSec = tierPayload.sections[0];
    const tiersToShow = (firstSec?.tiers ?? [])
      .filter((t) => t.players.length > 0)
      .slice(0, 3);
    for (const tier of tiersToShow) {
      const cleanComment = (tier.commentary ?? "")
        .replace(/\s+/g, " ")
        .trim();
      const commentPreview =
        cleanComment.length > 74
          ? `${cleanComment.slice(0, 71)}...`
          : cleanComment;
      const allNames = tier.players.map(
        (p) => p.name.split("#")[0].trim() || p.name
      );
      const { players, extraCount } = fitPlayers(
        allNames,
        commentPreview ? 540 : 850,
        12,
        34,
        10,
        1
      );
      playerPreviewRows.push({
        key: tier.id,
        badgeTitle: tier.label || "Tier",
        color: tier.color || "#ef4444",
        players,
        extraCount,
        commentPreview,
      });
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#141917",
          border: `14px solid ${!hasDivision ? "#5c6662" : theme.primary_color}`,
          color: "#ffffff",
          fontFamily: "SiteBody, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 44px",
            gap: "24px",
            background: bannerGradient,
            borderBottom: "3px solid #39443f",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              flex: 1,
              minWidth: 0,
            }}
          >
            {leagueLogoSrc && (
              <img
                src={leagueLogoSrc}
                alt={leagueName}
                width={88}
                height={72}
                style={{ objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: "19px",
                  fontWeight: 700,
                  color: "#f0c020",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}
              >
                {leagueName} {seasonName ? `(${seasonName})` : ""}
              </span>
              <span
                style={{
                  fontFamily: "WowHeading, serif",
                  fontSize: "50px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  textShadow: "0 2px 4px rgba(0,0,0,0.6)",
                }}
              >
                {headlineTitle}
              </span>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.9)",
                  lineHeight: 1.2,
                }}
              >
                {subTitle}
              </span>
              {ballot.author_notes && (
                <span
                  style={{
                    fontSize: "18px",
                    color: "#e8e6b8",
                    marginTop: "6px",
                  }}
                >
                  {ballot.author_notes}
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              maxWidth: "400px",
              overflow: "hidden",
              flexShrink: 0,
              padding: "12px 22px",
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.45)",
              border: "2px solid rgba(255, 255, 255, 0.25)",
            }}
          >
            {avatarSrc && (
              <img
                src={avatarSrc}
                alt={authorName}
                width={44}
                height={44}
                style={{
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: "2px solid rgba(255, 255, 255, 0.5)",
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {authorName.length > 16
                ? `${authorName.slice(0, 15)}…`
                : authorName}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            padding: "20px 36px",
            gap: "16px",
          }}
        >
          {isSplitRoleTierList ? (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "16px",
                flex: 1,
                alignItems: "stretch",
              }}
            >
              {[splitLeftColumn, splitRightColumn].map((col, colIdx) => (
                <div
                  key={colIdx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: "12px",
                    justifyContent: "center",
                  }}
                >
                  {col.map((card) => {
                    const contrastColor = getTierContrastText(card.color);
                    return (
                      <div
                        key={card.role}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          background: "#1c2421",
                          border: "2px solid #303b36",
                          gap: "14px",
                          ...(colIdx === 0 ? { flex: 1 } : { minHeight: "116px" }),
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                            width: "144px",
                            minHeight: "86px",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            background: card.color,
                            color: contrastColor,
                            flexShrink: 0,
                          }}
                        >
                          {card.roleIconSrc && (
                            <img
                              src={card.roleIconSrc}
                              alt={card.role}
                              width={30}
                              height={30}
                              style={{ objectFit: "contain", flexShrink: 0 }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: "24px",
                              fontWeight: 900,
                              lineHeight: 1,
                            }}
                          >
                            {card.badgeText}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "8px",
                            flex: 1,
                            overflow: "hidden",
                          }}
                        >
                          {card.players.length === 0 ? (
                            <span
                              style={{
                                fontSize: "20px",
                                color: "rgba(255,255,255,0.35)",
                              }}
                            >
                              —
                            </span>
                          ) : (
                            card.players.map((pName) => (
                              <span
                                key={pName}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  background: "#26312d",
                                  border: "2px solid #3d4a44",
                                  fontSize: "19px",
                                  fontWeight: 700,
                                  color: "#ffffff",
                                }}
                              >
                                {pName}
                              </span>
                            ))
                          )}
                          {card.extraCount > 0 && (
                            <span
                              style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                background: "rgba(240, 192, 32, 0.16)",
                                border: "2px solid rgba(240, 192, 32, 0.55)",
                                fontSize: "18px",
                                fontWeight: 700,
                                color: "#f0c020",
                              }}
                            >
                              +{card.extraCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : isPlayerTierList
            ? playerPreviewRows.map((row) => {
                const contrastColor = getTierContrastText(row.color);
                return (
                  <div
                    key={row.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 22px",
                      borderRadius: "12px",
                      background: "#1c2421",
                      border: "2px solid #303b36",
                      gap: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "178px",
                        minHeight: "76px",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        background: row.color,
                        color: contrastColor,
                        flexShrink: 0,
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "24px",
                          fontWeight: 900,
                          lineHeight: 1.1,
                        }}
                      >
                        {row.badgeTitle}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "nowrap",
                        alignItems: "center",
                        gap: "10px",
                        flex: 1,
                        overflow: "hidden",
                      }}
                    >
                      {row.players.map((pName) => (
                        <span
                          key={pName}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            background: "#26312d",
                            border: "2px solid #3d4a44",
                            fontSize: "22px",
                            fontWeight: 700,
                            color: "#ffffff",
                          }}
                        >
                          {pName}
                        </span>
                      ))}
                      {row.extraCount > 0 && (
                        <span
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "rgba(240, 192, 32, 0.16)",
                            border: "2px solid rgba(240, 192, 32, 0.55)",
                            fontSize: "20px",
                            fontWeight: 700,
                            color: "#f0c020",
                          }}
                        >
                          +{row.extraCount}
                        </span>
                      )}
                    </div>

                    {row.commentPreview && (
                      <div
                        style={{
                          display: "flex",
                          width: "310px",
                          flexShrink: 0,
                          alignItems: "center",
                          justifyContent: "flex-start",
                          borderLeft: "2px solid #303b36",
                          paddingLeft: "20px",
                          minHeight: "64px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "20px",
                            lineHeight: 1.28,
                            color: "#d4ddd8",
                            textAlign: "left",
                          }}
                        >
                          {row.commentPreview}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            : top3.map((item, idx) => {
                const badgeColor = RANK_COLORS[idx] ?? "#4a5568";
                const cleanComment = item.commentary
                  ? item.commentary.replace(/\s+/g, " ").trim()
                  : "";
                const commentPreview =
                  cleanComment.length > 92
                    ? `${cleanComment.slice(0, 89)}...`
                    : cleanComment;

                return (
                  <div
                    key={item.rank}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 24px",
                      borderRadius: "12px",
                      background: "#1c2421",
                      border: "2px solid #303b36",
                      gap: "24px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "18px",
                        width: "490px",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "76px",
                          height: "76px",
                          borderRadius: "12px",
                          background: badgeColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "42px",
                          fontWeight: 900,
                          color: "#ffffff",
                          flexShrink: 0,
                        }}
                      >
                        {item.rank}
                      </div>
                      {item.logoSrc && (
                        <img
                          src={item.logoSrc}
                          alt={item.teamName}
                          width={72}
                          height={72}
                          style={{ objectFit: "contain", flexShrink: 0 }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: "34px",
                          fontWeight: 700,
                          color: "#ffffff",
                          lineHeight: 1.15,
                        }}
                      >
                        {item.teamName}
                      </span>
                    </div>

                    {commentPreview && (
                      <div
                        style={{
                          display: "flex",
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "flex-start",
                          borderLeft: "2px solid #303b36",
                          paddingLeft: "24px",
                          minHeight: "64px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "22px",
                            lineHeight: 1.3,
                            color: "#d4ddd8",
                            textAlign: "left",
                          }}
                        >
                          {commentPreview}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
    ),
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}

import { ImageResponse } from "next/og";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { computeRoleNormalizedRatings } from "@/utils/riotStatsAggregation";
import { fetchScdlSheetStats } from "@/utils/scdlSheetStats";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import { loadOgFonts, resolveOgImageSrc } from "@/utils/ogFonts";

export const PLAYER_OG_SIZE = { width: 1200, height: 630 };

const ROLE_PNG_ICONS: Record<LeagueRole, string> = {
  top: "/images/roles/top.png",
  jungle: "/images/roles/jungle.png",
  mid: "/images/roles/mid.png",
  bot: "/images/roles/bot.png",
  support: "/images/roles/support.png",
};

function getRoleRankColor(rank: number, total: number): string {
  const t = total <= 1 ? 0 : Math.min(1, Math.max(0, (rank - 1) / (total - 1)));
  let r: number;
  let g: number;
  let b: number;
  if (t <= 0.5) {
    const u = t / 0.5;
    r = Math.round(74 + (166 - 74) * u);
    g = Math.round(222 + (168 - 222) * u);
    b = Math.round(128 + (158 - 128) * u);
  } else {
    const u = (t - 0.5) / 0.5;
    r = Math.round(166 + (248 - 166) * u);
    g = Math.round(168 + (113 - 168) * u);
    b = Math.round(158 + (113 - 158) * u);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export async function renderPlayerOpenGraphImage(
  decodedKey: string,
  seasonSlug?: string
) {
  const [ctx, fonts] = await Promise.all([
    loadPublicStatsContext(seasonSlug || undefined, {
      playerKeyFilter: decodedKey,
    }),
    loadOgFonts(),
  ]);

  const soloPlayer = ctx.players.find(
    (p) =>
      p.playerKey === decodedKey ||
      p.displayName.toLowerCase() === decodedKey ||
      p.riotId.split("#")[0]?.trim().toLowerCase() === decodedKey
  );

  if (!soloPlayer) {
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
            border: "14px solid #c89b3c",
            color: "#f0c020",
            fontFamily: "WowHeading, serif",
            fontSize: "48px",
            fontWeight: 700,
          }}
        >
          Rankr — Player Stats
        </div>
      ),
      { ...PLAYER_OG_SIZE, ...(fonts.length > 0 ? { fonts } : {}) }
    );
  }

  const sheetSummary = await fetchScdlSheetStats(
    ctx.players,
    ctx.teams,
    ctx.sheetConfig
  ).catch(() => null);

  const rawDivPlayers = (sheetSummary?.players ?? []).filter(
    (p) => p.divisionId === soloPlayer.divisionId && p.games > 0
  );
  const ratedDivPlayers = computeRoleNormalizedRatings(rawDivPlayers);
  const lp =
    ratedDivPlayers.find((p) => p.playerKey === soloPlayer.playerKey) ?? null;

  const sameRoleDiv = ratedDivPlayers
    .filter((p) => p.role === soloPlayer.role)
    .sort((a, b) => b.leagueRating - a.leagueRating);
  const roleRankIdx = sameRoleDiv.findIndex(
    (p) => p.playerKey === soloPlayer.playerKey
  );
  const roleRank = roleRankIdx >= 0 ? roleRankIdx + 1 : null;

  const divObj = ctx.divisions.find((d) => d.id === soloPlayer.divisionId);
  const theme = resolveDivisionTheme(divObj?.theme_key ?? "scdl");
  const { bannerGradient } = getThemeGradients(theme);
  const roleKey = (soloPlayer.role?.toLowerCase() || "mid") as LeagueRole;
  const roleMeta = getRoleMeta(roleKey);
  const rolePngPath = ROLE_PNG_ICONS[roleKey] ?? ROLE_PNG_ICONS.mid;

  const statPlayer = lp ?? soloPlayer;
  const hasGames = statPlayer.games > 0;
  const ratingDisplay = hasGames ? statPlayer.leagueRating.toFixed(1) : "—";
  const kdaDisplay = hasGames ? statPlayer.kda.toFixed(2) : "—";
  const rankColor =
    roleRank !== null
      ? getRoleRankColor(roleRank, sameRoleDiv.length)
      : "#a6a89e";
  const isRankOne = roleRank === 1;

  const topChamps = (lp?.topChampions ?? soloPlayer.topChampions).slice(0, 3);

  const [leagueLogoSrc, divLogoSrc, teamLogoSrc, roleIconSrc, ...champIconSrcs] =
    await Promise.all([
      resolveOgImageSrc(ctx.leagueLogoUrl),
      resolveOgImageSrc(divObj?.logo_url),
      resolveOgImageSrc(soloPlayer.teamLogoUrl),
      resolveOgImageSrc(rolePngPath),
      ...topChamps.map((c) =>
        resolveOgImageSrc(getChampionIconUrl(c.name, ctx.ddVersion))
      ),
    ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#141917",
          border: `14px solid ${theme.primary_color}`,
          color: "#ffffff",
          fontFamily: "SiteBody, sans-serif",
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 44px",
            gap: "24px",
            background: bannerGradient,
            borderBottom: "3px solid #39443f",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              flex: 1,
              minWidth: 0,
            }}
          >
            {leagueLogoSrc && (
              <img
                src={leagueLogoSrc}
                alt={ctx.leagueName}
                width={84}
                height={68}
                style={{ objectFit: "contain", flexShrink: 0 }}
              />
            )}
            {divLogoSrc && (
              <img
                src={divLogoSrc}
                alt={soloPlayer.divisionName}
                width={72}
                height={72}
                style={{ objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontFamily: "WowHeading, serif",
                  fontSize: "58px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.05,
                  textShadow: "0 2px 6px rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {soloPlayer.displayName}
              </span>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.9)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {soloPlayer.teamName} • {soloPlayer.divisionName}
              </span>
            </div>
          </div>

          {teamLogoSrc && (
            <img
              src={teamLogoSrc}
              alt={soloPlayer.teamName}
              width={88}
              height={88}
              style={{ objectFit: "contain", flexShrink: 0 }}
            />
          )}
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
            padding: "26px 40px 30px",
            gap: "20px",
          }}
        >
          {/* 3 Bold KPI Cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "20px",
              flex: 1,
            }}
          >
            {/* Card 1: Role Rank */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "18px 20px",
                borderRadius: "14px",
                background: isRankOne
                  ? "linear-gradient(180deg, rgba(240, 192, 32, 0.14) 0%, #1c2421 100%)"
                  : "#1c2421",
                border: isRankOne
                  ? "2px solid #c89b3c"
                  : "2px solid #303b36",
                gap: "12px",
              }}
            >
              {roleIconSrc && (
                <img
                  src={roleIconSrc}
                  alt={roleMeta.label}
                  width={76}
                  height={76}
                  style={{ objectFit: "contain", flexShrink: 0 }}
                />
              )}
              <span
                style={{
                  fontSize: roleMeta.label.length >= 6 ? "44px" : "52px",
                  fontWeight: 900,
                  color: isRankOne ? "#f0c020" : rankColor,
                  lineHeight: 1.0,
                }}
              >
                {roleRank !== null
                  ? `#${roleRank} ${roleMeta.label}`
                  : roleMeta.label}
              </span>
            </div>

            {/* Card 2: Rankr Rating */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "18px 20px",
                borderRadius: "14px",
                background: "#1c2421",
                border: "2px solid #303b36",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg
                  width="26"
                  height="22"
                  viewBox="0 0 28 24"
                  fill="none"
                  stroke="#f0c020"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5.5" y="3" width="17" height="18" rx="1.4" />
                  <line x1="5.5" y1="6.6" x2="22.5" y2="6.6" />
                  <line x1="5.5" y1="10.2" x2="22.5" y2="10.2" />
                  <line x1="5.5" y1="13.8" x2="22.5" y2="13.8" />
                  <line x1="5.5" y1="17.4" x2="22.5" y2="17.4" />
                  <polygon
                    points="5,6 1.8,10.2 3.7,10.2 3.7,17.5 6.3,17.5 6.3,10.2 8.2,10.2"
                    fill="#1c2421"
                    stroke="#f0c020"
                    strokeWidth="1.6"
                  />
                  <polygon
                    points="21.7,6.5 24.3,6.5 24.3,13.8 26.2,13.8 23,18 19.8,13.8 21.7,13.8"
                    fill="#1c2421"
                    stroke="#f0c020"
                    strokeWidth="1.6"
                  />
                </svg>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#a6a89e",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  Rankr Rating
                </span>
              </div>
              <span
                style={{
                  fontSize: "66px",
                  fontWeight: 900,
                  color: hasGames ? rankColor : "#a6a89e",
                  lineHeight: 1.0,
                }}
              >
                {ratingDisplay}
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#c7c5b8",
                }}
              >
                {hasGames ? `${statPlayer.games} Games` : "No Games"}
              </span>
            </div>

            {/* Card 3: League KDA */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "18px 20px",
                borderRadius: "14px",
                background: "#1c2421",
                border: "2px solid #303b36",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f0c020"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                  <line x1="13" y1="19" x2="19" y2="13" />
                  <line x1="16" y1="16" x2="20" y2="20" />
                  <line x1="19" y1="21" x2="21" y2="19" />
                  <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
                  <line x1="5" y1="14" x2="9" y2="18" />
                  <line x1="7" y1="17" x2="4" y2="20" />
                  <line x1="3" y1="19" x2="5" y2="21" />
                </svg>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#a6a89e",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  League KDA
                </span>
              </div>
              <span
                style={{
                  fontSize: "66px",
                  fontWeight: 900,
                  color: "#f0ede0",
                  lineHeight: 1.0,
                }}
              >
                {kdaDisplay}
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#c7c5b8",
                }}
              >
                {hasGames
                  ? `${statPlayer.killsPerGame.toFixed(1)} / ${statPlayer.deathsPerGame.toFixed(1)} / ${statPlayer.assistsPerGame.toFixed(1)}`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Bottom Strip: Top 3 Champions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderRadius: "14px",
              background: "#1c2421",
              border: "2px solid #303b36",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#f0c020",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Top Champions
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flex: 1,
                justifyContent: "flex-end",
              }}
            >
              {topChamps.length === 0 ? (
                <span style={{ fontSize: "22px", color: "#a6a89e" }}>
                  No games recorded yet
                </span>
              ) : (
                topChamps.map((c, idx) => (
                  <div
                    key={c.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      background: "#26312d",
                      border: "2px solid #3d4a44",
                    }}
                  >
                    {champIconSrcs[idx] && (
                      <img
                        src={champIconSrcs[idx] as string}
                        alt={c.name}
                        width={56}
                        height={56}
                        style={{
                          borderRadius: "8px",
                          objectFit: "cover",
                          border: "2px solid #c89b3c",
                        }}
                      />
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "22px",
                          fontWeight: 700,
                          color: "#ffffff",
                          lineHeight: 1.1,
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: "17px",
                          fontWeight: 700,
                          color: "#a6a89e",
                        }}
                      >
                        {c.games}G • {c.wins}W-{c.games - c.wins}L
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...PLAYER_OG_SIZE, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}

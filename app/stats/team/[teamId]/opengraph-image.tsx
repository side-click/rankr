import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import {
  loadPublicStatsContext,
  loadTeamScoutingData,
} from "@/utils/riotStatsServer";
import { computeRoleNormalizedRatings } from "@/utils/riotStatsAggregation";
import { fetchScdlSheetStats } from "@/utils/leagueStats";
import { getChampionIconUrl } from "@/utils/riotApi";
import { LEAGUE_ROLES, type LeagueRole } from "@/utils/roles";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import {
  loadOgFonts,
  resolveOgImageSrc,
  safeDecodeParam,
} from "@/utils/ogFonts";

export const alt = "Rankr — Team Stats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default async function TeamOpenGraphImage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const decodedId = safeDecodeParam(teamId);
  if (!decodedId) {
    return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });
  }

  const [ctx, fonts] = await Promise.all([
    loadPublicStatsContext(undefined, { teamIdFilter: decodedId }),
    loadOgFonts(),
  ]);

  const scouting = await loadTeamScoutingData(ctx, decodedId);

  if (!scouting) {
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
          Rankr — Team Stats
        </div>
      ),
      { ...size, ...(fonts.length > 0 ? { fonts } : {}) }
    );
  }

  const { team, leagueTeam, divisionThemeKey, roleRankByPlayerKey } = scouting;
  const divObj = ctx.divisions.find((d) => d.id === team.divisionId);
  const theme = resolveDivisionTheme(divisionThemeKey);
  const { bannerGradient } = getThemeGradients(theme);

  const sheetSummary = await fetchScdlSheetStats(
    ctx.players,
    ctx.teams,
    ctx.sheetConfig
  ).catch(() => null);
  const ratedDivPlayers = computeRoleNormalizedRatings(
    (sheetSummary?.players ?? []).filter(
      (p) => p.divisionId === team.divisionId && p.games > 0
    )
  );
  const ratingByKey = new Map(
    ratedDivPlayers.map((p) => [p.playerKey, p.leagueRating])
  );

  const activeTeam = leagueTeam ?? team;
  const recordStr =
    typeof activeTeam.seriesWins === "number" &&
    typeof activeTeam.seriesLosses === "number"
      ? `${activeTeam.seriesWins}-${activeTeam.seriesLosses} Record`
      : `${activeTeam.wins}W-${activeTeam.games - activeTeam.wins}L`;
  const seedStr = activeTeam.seed ? ` • #${activeTeam.seed} Seed` : "";

  const starters = LEAGUE_ROLES.map((r) => {
    const rosterPlayer =
      activeTeam.players.find((p) => p.role.toLowerCase() === r.key) ?? null;
    const rating = rosterPlayer
      ? ratingByKey.get(rosterPlayer.playerKey) ?? 0
      : 0;
    const rankInfo = rosterPlayer
      ? roleRankByPlayerKey[rosterPlayer.playerKey] ?? null
      : null;
    const top3Champs = (rosterPlayer?.topChampions ?? []).slice(0, 3);
    return {
      roleMeta: r,
      rosterPlayer,
      rating,
      rankInfo,
      top3Champs,
    };
  });

  const maxTeamRating = Math.max(0, ...starters.map((s) => s.rating));

  const [leagueLogoSrc, divLogoSrc, teamLogoSrc, roleIconSrcs, champIconGrid] =
    await Promise.all([
      resolveOgImageSrc(ctx.leagueLogoUrl),
      resolveOgImageSrc(divObj?.logo_url),
      resolveOgImageSrc(team.logoUrl),
      Promise.all(
        LEAGUE_ROLES.map((r) =>
          resolveOgImageSrc(ROLE_PNG_ICONS[r.key] ?? ROLE_PNG_ICONS.mid)
        )
      ),
      Promise.all(
        starters.map((s) =>
          Promise.all(
            s.top3Champs.map((c) =>
              resolveOgImageSrc(getChampionIconUrl(c.name, ctx.ddVersion))
            )
          )
        )
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
                alt={team.divisionName}
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
                {team.teamName}
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
                {team.divisionName} • {recordStr}
                {seedStr}
              </span>
            </div>
          </div>

          {teamLogoSrc && (
            <img
              src={teamLogoSrc}
              alt={team.teamName}
              width={96}
              height={96}
              style={{ objectFit: "contain", flexShrink: 0 }}
            />
          )}
        </div>

        {/* Body: 5-Role Roster Strip */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flex: 1,
            alignItems: "stretch",
            padding: "28px 36px",
            gap: "14px",
          }}
        >
          {starters.map((s, idx) => {
            const { roleMeta, rosterPlayer, rating, rankInfo } = s;
            const iconSrc = roleIconSrcs[idx];
            const champIcons = (champIconGrid[idx] ?? []).filter(
              (u): u is string => Boolean(u)
            );
            const isTeamTop = rating > 0 && rating === maxTeamRating;
            const ratingColor =
              rating > 0 && rankInfo
                ? getRoleRankColor(rankInfo.rank, rankInfo.total)
                : rating > 0
                ? "#f0ede0"
                : "#6e7268";

            return (
              <div
                key={roleMeta.key}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 12px",
                  borderRadius: "14px",
                  background: isTeamTop
                    ? "linear-gradient(180deg, rgba(240, 192, 32, 0.08) 0%, #1c2421 100%)"
                    : "#1c2421",
                  border: isTeamTop
                    ? "2px solid rgba(200, 155, 60, 0.85)"
                    : "2px solid #303b36",
                  textAlign: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {iconSrc && (
                    <img
                      src={iconSrc}
                      alt={roleMeta.label}
                      width={42}
                      height={42}
                      style={{ objectFit: "contain" }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#a6a89e",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {roleMeta.label}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    color: rosterPlayer ? "#ffffff" : "#6e7268",
                    lineHeight: 1.15,
                    wordBreak: "break-word",
                  }}
                >
                  {rosterPlayer ? rosterPlayer.displayName : "Open"}
                </span>

                {/* Top 3 Champions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    minHeight: "50px",
                  }}
                >
                  {champIcons.length === 0 ? (
                    <span style={{ fontSize: "18px", color: "#6e7268" }}>
                      —
                    </span>
                  ) : (
                    champIcons.map((src, cIdx) => (
                      <img
                        key={cIdx}
                        src={src}
                        alt=""
                        width={48}
                        height={48}
                        style={{
                          borderRadius: "8px",
                          objectFit: "cover",
                          border: "2px solid #3d4a44",
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Rankr Rating Pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px 18px",
                    borderRadius: "10px",
                    background: isTeamTop
                      ? "rgba(240, 192, 32, 0.14)"
                      : "rgba(0, 0, 0, 0.35)",
                    border: isTeamTop
                      ? "2px solid #c89b3c"
                      : "2px solid #303b36",
                  }}
                >
                  <span
                    style={{
                      fontSize: "28px",
                      fontWeight: 900,
                      color: ratingColor,
                    }}
                  >
                    {rating > 0 ? rating.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}

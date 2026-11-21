import { ImageResponse } from "next/og";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { fetchAllScdlSeries } from "@/utils/scdlSheetStats";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import { loadOgFonts, resolveOgImageSrc } from "@/utils/ogFonts";

export const MATCH_OG_SIZE = { width: 1200, height: 630 };

function formatClock(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return "";
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function renderMatchOpenGraphImage(
  decodedKey: string,
  seasonSlug?: string
) {
  const [ctx, fonts] = await Promise.all([
    loadPublicStatsContext(seasonSlug || undefined, {
      includeRiotStats: false,
    }),
    loadOgFonts(),
  ]);
  const allSeries = await fetchAllScdlSeries(ctx.sheetConfig).catch(() => []);
  const series = allSeries.find((s) => s.seriesKey === decodedKey);

  if (!series) {
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
          Rankr — Match Series
        </div>
      ),
      { ...MATCH_OG_SIZE, ...(fonts.length > 0 ? { fonts } : {}) }
    );
  }

  const teamByName = new Map(
    ctx.teams.map((t) => [t.teamName.trim().toLowerCase(), t])
  );
  const teamAObj = teamByName.get(series.teamA.trim().toLowerCase()) ?? null;
  const teamBObj = teamByName.get(series.teamB.trim().toLowerCase()) ?? null;
  const divId = teamAObj?.divisionId ?? teamBObj?.divisionId ?? null;
  const divObj = divId ? ctx.divisions.find((d) => d.id === divId) : null;
  const theme = resolveDivisionTheme(divObj?.theme_key ?? "scdl");
  const { bannerGradient } = getThemeGradients(theme);

  const [leagueLogoSrc, divLogoSrc, teamALogoSrc, teamBLogoSrc] =
    await Promise.all([
      resolveOgImageSrc(ctx.leagueLogoUrl),
      resolveOgImageSrc(divObj?.logo_url),
      resolveOgImageSrc(teamAObj?.logoUrl),
      resolveOgImageSrc(teamBObj?.logoUrl),
    ]);

  const aWonSeries = series.teamAWins > series.teamBWins;
  const bWonSeries = series.teamBWins > series.teamAWins;

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
            gap: "20px",
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
                alt={divObj?.name ?? "Division"}
                width={72}
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
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontFamily: "WowHeading, serif",
                  fontSize: "48px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.08,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {series.teamA} vs {series.teamB}
              </span>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                {divObj?.name ? `${divObj.name} • ` : ""}
                {series.roundLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Center VS Scoreboard + Game Badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: "28px 48px",
            gap: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "28px 40px",
              borderRadius: "18px",
              background: "#1c2421",
              border: "2px solid #303b36",
              gap: "24px",
            }}
          >
            {/* Team A */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                minWidth: 0,
              }}
            >
              {teamALogoSrc && (
                <img
                  src={teamALogoSrc}
                  alt={series.teamA}
                  width={116}
                  height={116}
                  style={{ objectFit: "contain" }}
                />
              )}
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 900,
                  color: aWonSeries ? "#f0c020" : "#ffffff",
                  textAlign: "center",
                  lineHeight: 1.15,
                }}
              >
                {series.teamA}
              </span>
            </div>

            {/* Score */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                padding: "16px 34px",
                borderRadius: "16px",
                background: "rgba(0, 0, 0, 0.45)",
                border: "2px solid rgba(240, 192, 32, 0.45)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "78px",
                  fontWeight: 900,
                  color: aWonSeries ? "#f0c020" : "#ffffff",
                  lineHeight: 1.0,
                }}
              >
                {series.teamAWins}
              </span>
              <span
                style={{
                  fontSize: "54px",
                  fontWeight: 700,
                  color: "#6e7268",
                  lineHeight: 1.0,
                }}
              >
                –
              </span>
              <span
                style={{
                  fontSize: "78px",
                  fontWeight: 900,
                  color: bWonSeries ? "#f0c020" : "#ffffff",
                  lineHeight: 1.0,
                }}
              >
                {series.teamBWins}
              </span>
            </div>

            {/* Team B */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                minWidth: 0,
              }}
            >
              {teamBLogoSrc && (
                <img
                  src={teamBLogoSrc}
                  alt={series.teamB}
                  width={116}
                  height={116}
                  style={{ objectFit: "contain" }}
                />
              )}
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 900,
                  color: bWonSeries ? "#f0c020" : "#ffffff",
                  textAlign: "center",
                  lineHeight: 1.15,
                }}
              >
                {series.teamB}
              </span>
            </div>
          </div>

          {series.games.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              {series.games.map((g, idx) => {
                const dur = formatClock(g.gameDuration);
                const winKey = g.winnerTeam.trim().toLowerCase();
                const winnerLogo =
                  winKey === series.teamA.trim().toLowerCase()
                    ? teamALogoSrc
                    : winKey === series.teamB.trim().toLowerCase()
                    ? teamBLogoSrc
                    : null;
                return (
                  <div
                    key={g.gameId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      minHeight: "76px",
                      padding: "16px 28px",
                      borderRadius: "14px",
                      background: "#1c2421",
                      border: "2px solid #303b36",
                      fontSize: "24px",
                      fontWeight: 700,
                      color: "#e8e5d8",
                    }}
                  >
                    <span style={{ color: "#f0c020" }}>G{idx + 1}:</span>
                    {winnerLogo ? (
                      <img
                        src={winnerLogo}
                        alt={g.winnerTeam}
                        width={46}
                        height={46}
                        style={{ objectFit: "contain", flexShrink: 0 }}
                      />
                    ) : (
                      <span>{g.winnerTeam}</span>
                    )}
                    {dur && (
                      <span style={{ color: "#a6a89e" }}>({dur})</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    ),
    { ...MATCH_OG_SIZE, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}

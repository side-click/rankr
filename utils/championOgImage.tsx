import { ImageResponse } from "next/og";
import { loadPublicStatsContext } from "@/utils/riotStatsServer";
import { fetchAllScdlSeries } from "@/utils/scdlSheetStats";
import { computeChampionStats } from "@/utils/championStats";
import { getChampionIconUrl } from "@/utils/riotApi";
import { resolveDivisionTheme } from "@/utils/themes";
import {
  getOgChampionCenteredSplashJpg,
  loadOgFonts,
  resolveOgImageSrc,
} from "@/utils/ogFonts";

export const CHAMPION_OG_SIZE = { width: 1200, height: 630 };

export async function renderChampionOpenGraphImage(
  championName: string,
  divisionSlug?: string,
  seasonSlug?: string
) {
  const [ctx, fonts] = await Promise.all([
    loadPublicStatsContext(seasonSlug || undefined, {
      includeRiotStats: false,
    }),
    loadOgFonts(),
  ]);
  const series = await fetchAllScdlSeries(ctx.sheetConfig).catch(() => []);

  const divObj =
    divisionSlug && divisionSlug !== "all"
      ? ctx.divisions.find(
          (d) => d.slug.toLowerCase() === divisionSlug.toLowerCase()
        ) ?? null
      : null;

  const stats = computeChampionStats(
    ctx,
    series,
    championName,
    divObj ? divObj.slug : "all"
  );
  const displayChampName = stats.championName || championName;

  const theme = divObj ? resolveDivisionTheme(divObj.theme_key) : null;
  const borderColor = theme ? theme.primary_color : "#5c6662";
  const subtitle = divObj
    ? `${divObj.name} • ${ctx.seasonName}`
    : `Champion Stats • ${ctx.seasonName}`;

  const [splashSrc, iconSrc, leagueLogoSrc, divLogoSrc] = await Promise.all([
    resolveOgImageSrc(getOgChampionCenteredSplashJpg(displayChampName)),
    resolveOgImageSrc(getChampionIconUrl(displayChampName, ctx.ddVersion)),
    resolveOgImageSrc(ctx.leagueLogoUrl),
    divObj?.logo_url ? resolveOgImageSrc(divObj.logo_url) : Promise.resolve(null),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          background: "#121715",
          border: `14px solid ${borderColor}`,
          color: "#ffffff",
          fontFamily: "SiteBody, sans-serif",
          overflow: "hidden",
        }}
      >
        {splashSrc && (
          <img
            src={splashSrc}
            alt={displayChampName}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Dark vignette gradient overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(12, 16, 15, 0.86) 0%, rgba(12, 16, 15, 0.56) 48%, rgba(12, 16, 15, 0.94) 100%)",
          }}
        />

        {/* Top Bar */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 48px",
            gap: "24px",
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
                alt={ctx.leagueName}
                width={92}
                height={74}
                style={{ objectFit: "contain", flexShrink: 0 }}
              />
            )}
            {divLogoSrc && (
              <img
                src={divLogoSrc}
                alt={divObj?.name ?? "Division"}
                width={76}
                height={76}
                style={{ objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "WowHeading, serif",
                  fontSize: "68px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.02,
                  textShadow: "0 3px 10px rgba(0, 0, 0, 0.85)",
                }}
              >
                {displayChampName}
              </span>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#f0c020",
                  textShadow: "0 2px 6px rgba(0, 0, 0, 0.85)",
                }}
              >
                {subtitle}
              </span>
            </div>
          </div>

          {iconSrc && (
            <img
              src={iconSrc}
              alt={displayChampName}
              width={96}
              height={96}
              style={{
                borderRadius: "14px",
                objectFit: "cover",
                border: "3px solid #c89b3c",
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* Bottom 3 KPI Cards */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            gap: "22px",
            padding: "0 48px 42px",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "22px 24px",
              borderRadius: "16px",
              background: "rgba(18, 24, 21, 0.86)",
              border: "2px solid #c89b3c",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#f0c020",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Presence
            </span>
            <span
              style={{
                fontSize: "62px",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.0,
              }}
            >
              {stats.presence.toFixed(0)}%
            </span>
            <span
              style={{
                fontSize: "19px",
                fontWeight: 700,
                color: "#c7c5b8",
              }}
            >
              {stats.totalLeagueGames} League Games
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "22px 24px",
              borderRadius: "16px",
              background: "rgba(18, 24, 21, 0.86)",
              border: "2px solid #3d4a44",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#a6a89e",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Win Rate
            </span>
            <span
              style={{
                fontSize: "62px",
                fontWeight: 900,
                color:
                  stats.games === 0
                    ? "#a6a89e"
                    : stats.winRate >= 50
                    ? "#7cd438"
                    : "#f87171",
                lineHeight: 1.0,
              }}
            >
              {stats.games > 0 ? `${stats.winRate.toFixed(0)}%` : "—"}
            </span>
            <span
              style={{
                fontSize: "19px",
                fontWeight: 700,
                color: "#c7c5b8",
              }}
            >
              {stats.wins}W - {stats.losses}L
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "22px 24px",
              borderRadius: "16px",
              background: "rgba(18, 24, 21, 0.86)",
              border: "2px solid #3d4a44",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#a6a89e",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Picks / Bans
            </span>
            <span
              style={{
                fontSize: "58px",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.05,
              }}
            >
              {stats.games}P / {stats.bans}B
            </span>
            <span
              style={{
                fontSize: "19px",
                fontWeight: 700,
                color: "#c7c5b8",
              }}
            >
              {stats.pickRate.toFixed(0)}% Pick • {stats.banRate.toFixed(0)}% Ban
            </span>
          </div>
        </div>
      </div>
    ),
    { ...CHAMPION_OG_SIZE, ...(fonts.length > 0 ? { fonts } : {}) }
  );
}

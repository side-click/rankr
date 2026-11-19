import { ImageResponse } from "next/og";
import { loadConsensusPageData } from "@/utils/consensusData";
import { loadOgFonts, resolveOgImageSrc } from "@/utils/ogFonts";
import { getThemeGradients } from "@/utils/themes";

export const runtime = "nodejs";

const RANK_COLORS = ["#7c3aed", "#3b82f6", "#06b6d4"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const [data, fonts] = await Promise.all([
    loadConsensusPageData({
      season: searchParams.get("season") ?? undefined,
      division: searchParams.get("division") ?? undefined,
      edition: searchParams.get("edition") ?? undefined,
    }),
    loadOgFonts(),
  ]);

  const top3 = data.rows.slice(0, 3);
  const [leagueLogoSrc, ...teamLogoSrcs] = await Promise.all([
    resolveOgImageSrc(data.leagueLogoUrl),
    ...top3.map((r) => resolveOgImageSrc(r.logoUrl)),
  ]);

  const gradient = getThemeGradients(data.divisionTheme).bannerGradient;
  const countLabel = `${data.submissionCount} ${
    data.submissionCount === 1 ? "Ranking" : "Rankings"
  }`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#121716",
          color: "#f4f2e8",
          fontFamily: "SiteBody, sans-serif",
          border: `14px solid ${data.divisionTheme.primary_color}`,
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "30px 48px",
            background: gradient,
            borderBottom: "3px solid rgba(255,255,255,0.16)",
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
                alt={data.leagueName}
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
                {data.leagueName} {data.seasonName ? `(${data.seasonName})` : ""}
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
                {data.editionName} Consensus
              </span>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.9)",
                  lineHeight: 1.2,
                }}
              >
                {data.divisionName} Team Power Rankings
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexShrink: 0,
              padding: "12px 22px",
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.45)",
              border: "2px solid rgba(240, 192, 32, 0.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#f0c020",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                }}
              >
                Average Of
              </span>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {countLabel}
              </span>
            </div>
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f0c020"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
        </div>

        {/* Top 3 Consensus Rows */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "24px 48px",
            gap: "18px",
          }}
        >
          {top3.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: 700,
                color: "#a6a89e",
              }}
            >
              No published team rankings yet for this edition.
            </div>
          ) : (
            top3.map((row, idx) => {
              const rankBg = RANK_COLORS[idx] ?? "#4b5563";
              const logoSrc = teamLogoSrcs[idx];
              return (
                <div
                  key={row.teamKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "24px",
                    padding: "16px 26px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "22px",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "10px",
                        background: rankBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "30px",
                        fontWeight: 700,
                        color: "#ffffff",
                        flexShrink: 0,
                      }}
                    >
                      {row.consensusRank}
                    </div>

                    {logoSrc && (
                      <img
                        src={logoSrc}
                        alt={row.teamName}
                        width={64}
                        height={64}
                        style={{ objectFit: "contain", flexShrink: 0 }}
                      />
                    )}

                    <span
                      style={{
                        fontSize: "34px",
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {row.teamName}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 24px",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.45)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      fontSize: "34px",
                      fontWeight: 700,
                      color: "#f0ede0",
                      flexShrink: 0,
                    }}
                  >
                    {row.averageRank.toFixed(2)} avg
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts.length > 0 ? { fonts } : {}),
    }
  );
}

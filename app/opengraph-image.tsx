import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Rankr — League Power Rankings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "public/images/rankr_crop.png");
    const buffer = await readFile(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const logoUrl = await loadLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background:
            "linear-gradient(135deg, #0b110f 0%, #14221d 55%, #1d2b24 100%)",
          border: "8px solid #c89b3c",
          color: "#f4f2e8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Rankr"
                width={96}
                height={96}
                style={{ objectFit: "contain" }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "4px",
                  color: "#f0c020",
                  textTransform: "uppercase",
                }}
              >
                SCUTTLE CRAB DRAFT LEAGUE
              </span>
              <span
                style={{
                  fontSize: "58px",
                  fontWeight: 900,
                  letterSpacing: "-1px",
                  color: "#ffffff",
                  lineHeight: 1.05,
                }}
              >
                RANKR
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: "8px",
              border: "2px solid #c89b3c",
              background: "rgba(200, 155, 60, 0.14)",
              color: "#f0c020",
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "1px",
            }}
          >
            POWER RANKINGS
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "920px",
          }}
        >
          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.2,
            }}
          >
            Rank your division, drop your hot takes, and export shareable
            power rankings.
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#b7c2bc",
            }}
          >
            Drag-and-drop team tiers • Roster snapshots • One-click PNG export
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid #2e3d36",
            paddingTop: "20px",
            fontSize: "20px",
            color: "#9aa8a0",
          }}
        >
          <span>league-rankr.vercel.app</span>
          <span style={{ color: "#f0c020", fontWeight: 700 }}>
            Sign in with Discord to publish
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

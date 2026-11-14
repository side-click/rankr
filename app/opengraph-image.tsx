import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadOgFonts } from "@/utils/ogFonts";

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
  const [logoUrl, fonts] = await Promise.all([
    loadLogoDataUrl(),
    loadOgFonts(),
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
          padding: "64px 72px",
          background:
            "linear-gradient(135deg, #0b110f 0%, #14221d 55%, #1d2b24 100%)",
          border: "8px solid #c89b3c",
          color: "#f4f2e8",
          fontFamily: "SiteBody, sans-serif",
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
              gap: "24px",
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
                  fontFamily: "WowHeading, serif",
                  fontSize: "72px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  color: "#f0c020",
                  lineHeight: 1.05,
                  textShadow: "0 3px 6px rgba(0, 0, 0, 0.7)",
                }}
              >
                Rankr
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "2px solid #c89b3c",
              background: "rgba(200, 155, 60, 0.14)",
              color: "#f0c020",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "1.5px",
            }}
          >
            POWER RANKINGS
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "960px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontFamily: "WowHeading, serif",
              fontSize: "46px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.25,
            }}
          >
            Rank your division, drop your hot takes, and export shareable
            power rankings.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    }
  );
}

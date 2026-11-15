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

  const listRows = [
    { num: "1.", barWidth: 230, opacity: 1 },
    { num: "2.", barWidth: 195, opacity: 0.88 },
    { num: "3.", barWidth: 160, opacity: 0.76 },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 68px",
          gap: "48px",
          background:
            "linear-gradient(135deg, #0b110f 0%, #14221d 55%, #1d2b24 100%)",
          border: "8px solid #c89b3c",
          color: "#f4f2e8",
          fontFamily: "SiteBody, sans-serif",
        }}
      >
        {/* Left column: Larger Logo + Wordmark + Tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "34px",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "28px",
            }}
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Rankr"
                width={132}
                height={132}
                style={{ objectFit: "contain" }}
              />
            )}
            <span
              style={{
                fontFamily: "WowHeading, serif",
                fontSize: "108px",
                fontWeight: 700,
                letterSpacing: "1px",
                color: "#f0c020",
                lineHeight: 1.0,
                textShadow: "0 4px 10px rgba(0, 0, 0, 0.75)",
              }}
            >
              Rankr
            </span>
          </div>

          <div
            style={{
              fontFamily: "WowHeading, serif",
              fontSize: "40px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.24,
              maxWidth: "660px",
            }}
          >
            Rank the teams, drop your hot takes, and share them with the world.
          </div>
        </div>

        {/* Right column: Big golden 1. - 2. - 3. ordered list emblem */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "28px",
            padding: "40px 38px",
            borderRadius: "20px",
            background: "rgba(12, 18, 16, 0.72)",
            border: "3px solid rgba(240, 192, 32, 0.45)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
            width: "370px",
            flexShrink: 0,
          }}
        >
          {listRows.map((row) => (
            <div
              key={row.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                opacity: row.opacity,
              }}
            >
              <span
                style={{
                  fontFamily: "WowHeading, serif",
                  fontSize: "52px",
                  fontWeight: 700,
                  color: "#f0c020",
                  lineHeight: 1,
                  width: "52px",
                }}
              >
                {row.num}
              </span>
              <div
                style={{
                  height: "18px",
                  width: `${row.barWidth}px`,
                  borderRadius: "9px",
                  background:
                    "linear-gradient(90deg, #f0c020 0%, #c89b3c 100%)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length > 0 ? { fonts } : {}),
    }
  );
}

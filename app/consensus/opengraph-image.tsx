import { ImageResponse } from "next/og";
import { loadOgFonts, resolveOgImageSrc } from "@/utils/ogFonts";

export const alt = "Rankr — Consensus Rankings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ConsensusOpenGraphImage() {
  const [logoUrl, fonts] = await Promise.all([
    resolveOgImageSrc("/images/brand/rankr-icon.png"),
    loadOgFonts(),
  ]);

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
          border: "14px solid #c89b3c",
          color: "#f4f2e8",
          fontFamily: "SiteBody, sans-serif",
        }}
      >
        {/* Left column: Rankr Logo + Wordmark + Consensus Rankings */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "30px",
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
              fontSize: "54px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.15,
            }}
          >
            Consensus Rankings
          </div>
        </div>

        {/* Right column: Big golden Trophy emblem */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "340px",
            height: "340px",
            borderRadius: "28px",
            background: "rgba(12, 18, 16, 0.72)",
            border: "3px solid rgba(240, 192, 32, 0.45)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
            flexShrink: 0,
          }}
        >
          <svg
            width="196"
            height="196"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f0c020"
            strokeWidth="1.75"
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
    ),
    {
      ...size,
      ...(fonts.length > 0 ? { fonts } : {}),
    }
  );
}

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/utils/supabase/server";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import { loadOgFonts } from "@/utils/ogFonts";
import type { DivisionTheme } from "@/types/database";

export const alt = "Rankr — Published Power Rankings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RANK_COLORS = ["#7c3aed", "#3b82f6", "#06b6d4"];

const SUPPORTED_OG_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
]);

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentTypeHeader = res.headers.get("content-type") || "";
    const mime = contentTypeHeader.split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_OG_MIMES.has(mime)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function resolveLogoSrc(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:image/")) {
    return logoUrl;
  }
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return fetchImageAsDataUri(logoUrl);
  }
  if (logoUrl.startsWith("/")) {
    try {
      const relative = decodeURIComponent(logoUrl).replace(/^\/+/, "");
      const filePath = path.join(process.cwd(), "public", relative);
      const buffer = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".gif"
          ? "image/gif"
          : ext === ".png"
          ? "image/png"
          : null;
      if (!mime) return null;
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://league-rankr.vercel.app";
      const absoluteUrl = new URL(
        encodeURI(decodeURI(logoUrl)),
        baseUrl
      ).toString();
      return fetchImageAsDataUri(absoluteUrl);
    }
  }
  return null;
}

export default async function BallotOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ballot }, { data: themesData }, fonts] = await Promise.all([
    supabase
      .from("ballots")
      .select(
        `
        title,
        author_notes,
        league_name_snapshot,
        season_name_snapshot,
        division_name_snapshot,
        edition_name_snapshot,
        profiles ( username ),
        seasons ( name, leagues ( name ) ),
        divisions ( name, theme_key ),
        editions ( name ),
        ballot_entries ( rank, team_name_snapshot, team_logo_snapshot, commentary, teams ( name, logo_url ) )
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
          Rankr — Power Rankings
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
  const divisionName =
    division?.name ?? ballot.division_name_snapshot ?? "Power Rankings";
  const editionName = edition?.name ?? ballot.edition_name_snapshot ?? "";
  const authorName = profile?.username ?? "Voter";

  const displayTitle = editionName
    ? `${divisionName} — ${editionName}`
    : ballot.title || divisionName;

  const theme = resolveDivisionTheme(
    division?.theme_key,
    (themesData ?? []) as DivisionTheme[]
  );
  const { bannerGradient } = getThemeGradients(theme);

  const items = Array.isArray(ballot.ballot_entries) ? ballot.ballot_entries : [];
  const top3Raw = [...items].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const top3 = await Promise.all(
    top3Raw.map(async (item) => {
      const team = Array.isArray(item.teams) ? item.teams[0] : item.teams;
      const teamName = team?.name ?? item.team_name_snapshot ?? "Team";
      const logoSrc = await resolveLogoSrc(
        item.team_logo_snapshot || team?.logo_url
      );
      return { ...item, teamName, logoSrc };
    })
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#141917",
          border: `6px solid ${theme.primary_color}`,
          color: "#ffffff",
          fontFamily: "SiteBody, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 52px",
            background: bannerGradient,
            borderBottom: "3px solid #39443f",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "20px",
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
                fontSize: "52px",
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.1,
                textShadow: "0 2px 4px rgba(0,0,0,0.6)",
              }}
            >
              {displayTitle}
            </span>
            {ballot.author_notes && (
              <span
                style={{
                  fontSize: "20px",
                  color: "#e8e6b8",
                  marginTop: "6px",
                }}
              >
                {ballot.author_notes}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 28px",
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.45)",
              border: "2px solid rgba(255, 255, 255, 0.25)",
              fontSize: "34px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            by {authorName}
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
          {top3.map((item, idx) => {
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
                    flexShrink: 0,
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
                      fontSize: "40px",
                      fontWeight: 700,
                      color: "#ffffff",
                    }}
                  >
                    #{item.rank}
                  </div>
                  {item.logoSrc && (
                    <img
                      src={item.logoSrc}
                      alt={item.teamName}
                      width={72}
                      height={72}
                      style={{ objectFit: "contain" }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "38px",
                      fontWeight: 700,
                      color: "#ffffff",
                      maxWidth: "340px",
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
                      justifyContent: "flex-end",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "24px",
                        lineHeight: 1.25,
                        color: "#d4ddd8",
                        textAlign: "right",
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

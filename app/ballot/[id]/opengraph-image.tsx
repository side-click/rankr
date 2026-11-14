import { ImageResponse } from "next/og";
import { createClient } from "@/utils/supabase/server";
import { getThemeGradients, resolveDivisionTheme } from "@/utils/themes";
import type { DivisionTheme } from "@/types/database";

export const alt = "Rankr — Published Power Rankings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RANK_COLORS = ["#7c3aed", "#3b82f6", "#06b6d4"];

export default async function BallotOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ballot }, { data: themesData }] = await Promise.all([
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
        ballot_entries ( rank, team_name_snapshot, commentary, teams ( name ) )
      `
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle(),
    supabase.from("division_themes").select("*"),
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
            fontSize: "44px",
            fontWeight: 800,
          }}
        >
          Rankr — Power Rankings
        </div>
      ),
      { ...size }
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
  const top3 = [...items].sort((a, b) => a.rank - b.rank).slice(0, 3);

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
          fontFamily: "sans-serif",
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
                fontWeight: 800,
                color: "#f0c020",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              {leagueName} {seasonName ? `(${seasonName})` : ""}
            </span>
            <span
              style={{
                fontSize: "48px",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
              }}
            >
              {displayTitle}
            </span>
            {ballot.author_notes && (
              <span
                style={{
                  fontSize: "22px",
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
              padding: "14px 26px",
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.45)",
              border: "2px solid rgba(255, 255, 255, 0.25)",
              fontSize: "28px",
              fontWeight: 800,
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
            padding: "28px 52px",
            gap: "16px",
          }}
        >
          {top3.map((item, idx) => {
            const team = Array.isArray(item.teams) ? item.teams[0] : item.teams;
            const teamName = team?.name ?? item.team_name_snapshot ?? "Team";
            const badgeColor = RANK_COLORS[idx] ?? "#4a5568";
            return (
              <div
                key={item.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 26px",
                  borderRadius: "10px",
                  background: "#1c2421",
                  border: "2px solid #303b36",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "8px",
                      background: badgeColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                      fontWeight: 900,
                      color: "#ffffff",
                    }}
                  >
                    #{item.rank}
                  </div>
                  <span
                    style={{
                      fontSize: "32px",
                      fontWeight: 800,
                      color: "#ffffff",
                    }}
                  >
                    {teamName}
                  </span>
                </div>

                {item.commentary && (
                  <span
                    style={{
                      fontSize: "20px",
                      color: "#b7c2bc",
                      maxWidth: "480px",
                    }}
                  >
                    {item.commentary.length > 55
                      ? `${item.commentary.slice(0, 52)}...`
                      : item.commentary}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 52px",
            borderTop: "2px solid #2b3530",
            fontSize: "18px",
            color: "#9aa8a0",
          }}
        >
          <span>league-rankr.vercel.app</span>
          <span style={{ color: "#f0c020", fontWeight: 700 }}>
            View full ranking &amp; roster notes
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

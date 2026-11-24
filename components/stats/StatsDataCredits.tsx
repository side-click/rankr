import type { SheetSourceConfig } from "@/utils/leagueStats";
import { sanitizeExternalUrl } from "@/utils/sanitizeUrl";

const SCDL_45_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A";

interface StatsDataCreditsProps {
  leagueName?: string;
  seasonName?: string;
  sheetConfig?: SheetSourceConfig;
  variant?: "full" | "compact";
}

export function StatsDataCredits({
  leagueName,
  seasonName,
  sheetConfig,
  variant = "compact",
}: StatsDataCreditsProps) {
  const isScdl = (leagueName ?? "").toLowerCase().includes("scdl") ||
    (leagueName ?? "").toLowerCase().includes("scuttle crab");
  const isSeason45 =
    (seasonName ?? "").includes("4.5") ||
    sheetConfig?.seasonSlug === "season-4-5";

  const rawSheetId = sheetConfig?.sheetId?.trim() ?? "";
  const validSheetId = /^[a-zA-Z0-9_-]{10,120}$/.test(rawSheetId)
    ? rawSheetId
    : "";

  const resolvedUrl = sanitizeExternalUrl(
    sheetConfig?.creditsUrl?.trim() ||
      (validSheetId
        ? `https://docs.google.com/spreadsheets/d/${validSheetId}`
        : isSeason45 || (isScdl && !seasonName)
        ? SCDL_45_SHEET_URL
        : null)
  );

  const resolvedLabel =
    sheetConfig?.creditsLabel?.trim() ||
    (isSeason45 || (isScdl && !seasonName)
      ? "SCDL 4.5 Master Google Sheet"
      : resolvedUrl
      ? `${leagueName ? `${leagueName} ` : ""}${
          seasonName ? `${seasonName} ` : ""
        }Master Google Sheet`.trim()
      : null);

  const resolvedAttribution =
    sheetConfig?.creditsAttribution?.trim() ||
    (isScdl
      ? "the SCDL Admin Team (special thanks to Pandora)"
      : leagueName
      ? `the ${leagueName} Admin Team`
      : "the League Admin Team");

  const showSheetCredit =
    sheetConfig?.provider !== "none" && Boolean(resolvedUrl && resolvedLabel);

  if (variant === "full") {
    return (
      <div className="xp-inset px-4 py-3 text-xs text-[#a6a89e] leading-relaxed space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8d5c5]">
          Data Sources &amp; Credits
        </div>
        {showSheetCredit && resolvedUrl && resolvedLabel && (
          <p>
            Official match &amp; draft stats
            {seasonName ? ` for ${leagueName ? `${leagueName} ` : ""}${seasonName}` : ""}{" "}
            are sourced from the{" "}
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f0c020] hover:underline font-semibold"
            >
              {resolvedLabel}
            </a>
            , built and maintained by {resolvedAttribution}.
          </p>
        )}
        <p>
          Solo/Duo ranks, match history, and champion mastery are retrieved via
          the Riot Games API &amp; Data Dragon.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-white/10 text-[11px] text-[#a6a89e] text-center leading-relaxed">
      {showSheetCredit && resolvedUrl && resolvedLabel ? (
        <>
          Match &amp; draft data courtesy of {resolvedAttribution} via the{" "}
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f0c020] hover:underline font-semibold"
          >
            {resolvedLabel}
          </a>{" "}
          • Solo/Duo data via Riot Games API &amp; Data Dragon
        </>
      ) : (
        <>Solo/Duo data via Riot Games API &amp; Data Dragon</>
      )}
    </div>
  );
}

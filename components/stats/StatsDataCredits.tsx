const SCDL_45_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1tdi8ftaQ50sYS92H39YybU29SIPGVSyRNeT_HdOHP8A";

interface StatsDataCreditsProps {
  leagueName?: string;
  seasonName?: string;
  variant?: "full" | "compact";
}

export function StatsDataCredits({
  leagueName,
  seasonName,
  variant = "compact",
}: StatsDataCreditsProps) {
  const isScdl = (leagueName ?? "").toLowerCase().includes("scdl");
  const isSeason45 = (seasonName ?? "").includes("4.5");
  const showScdlSheetCredit = isScdl || isSeason45;

  if (variant === "full") {
    return (
      <div className="xp-inset px-4 py-3 text-xs text-[#a6a89e] leading-relaxed space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8d5c5]">
          Data Sources &amp; Credits
        </div>
        {showScdlSheetCredit && (
          <p>
            Official match &amp; draft stats for SCDL Season 4.5 are sourced
            from the{" "}
            <a
              href={SCDL_45_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f0c020] hover:underline font-semibold"
            >
              SCDL 4.5 Master Google Sheet
            </a>
            , built and maintained by the SCDL Admin Team (special thanks to{" "}
            <span className="text-[#f0ede0] font-semibold">Pandora</span>).
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
      {showScdlSheetCredit ? (
        <>
          Match &amp; draft data courtesy of the SCDL Admin Team (special thanks
          to <span className="text-[#f0ede0] font-semibold">Pandora</span>) via
          the{" "}
          <a
            href={SCDL_45_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f0c020] hover:underline font-semibold"
          >
            SCDL 4.5 Master Google Sheet
          </a>{" "}
          • Solo/Duo data via Riot Games API &amp; Data Dragon
        </>
      ) : (
        <>Solo/Duo data via Riot Games API &amp; Data Dragon</>
      )}
    </div>
  );
}

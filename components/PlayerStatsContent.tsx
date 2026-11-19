import Link from "next/link";
import { ArrowLeft, Calendar, ExternalLink, HelpCircle } from "lucide-react";
import { LocalTimestamp } from "@/components/LocalTimestamp";
import { RetroWindow } from "@/components/RetroWindow";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import {
  computeRoleNormalizedRatings,
  formatMinutesSeconds,
  getPriorityPickClass,
  getPriorityPickRanks,
  getRoleFilteredSoloChampions,
} from "@/utils/riotStatsAggregation";
import type { LoadedAdminStatsContext } from "@/utils/riotStatsServer";
import {
  fetchAllScdlSeries,
  fetchScdlSheetStats,
  type ScdlGamePlayerRow,
} from "@/utils/scdlSheetStats";
import { resolveDivisionTheme } from "@/utils/themes";

export const dynamic = "force-dynamic";

const RANK_COLOR_MAP: Record<string, string> = {
  CHALLENGER: "text-[#38bdf8]",
  GRANDMASTER: "text-[#f87171]",
  MASTER: "text-[#c084fc]",
  DIAMOND: "text-[#60a5fa]",
  EMERALD: "text-[#34d399]",
  PLATINUM: "text-[#9ca3af]",
  GOLD: "text-[#f0c020]",
  SILVER: "text-[#d1d5db]",
  BRONZE: "text-[#cd7f32]",
  IRON: "text-[#78716c]",
};

function formatStyledSoloRank(
  tier: string | null,
  rank: string | null,
  lp: number | null
): { label: string; className: string } {
  if (!tier) return { label: "Unranked", className: "text-[#8e9286]" };
  const t = tier.toUpperCase();
  const titleTier = t.charAt(0) + t.slice(1).toLowerCase();
  const color = RANK_COLOR_MAP[t] ?? "text-[#f0c020]";
  if (t === "MASTER" || t === "GRANDMASTER" || t === "CHALLENGER") {
    return {
      label: lp != null ? `${titleTier} ${lp} LP` : titleTier,
      className: color,
    };
  }
  return {
    label: rank ? `${titleTier} ${rank}` : titleTier,
    className: color,
  };
}

function deriveLeaguePrefix(leagueName?: string): string {
  const raw = (leagueName ?? "").trim();
  if (!raw) return "League";
  if (raw.length <= 6 && !raw.includes(" ")) return raw.toUpperCase();
  const initials = raw
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials || raw;
}

function formatMasteryPoints(pts: number): string {
  if (pts >= 1_000_000) return `${(pts / 1_000_000).toFixed(1)}M`;
  if (pts >= 1_000) return `${Math.round(pts / 1_000)}k`;
  return String(pts);
}

function getRoleRankColor(rank: number, total: number): string {
  const t = total <= 1 ? 0 : Math.min(1, Math.max(0, (rank - 1) / (total - 1)));
  let r: number;
  let g: number;
  let b: number;
  if (t <= 0.5) {
    const u = t / 0.5;
    r = Math.round(74 + (166 - 74) * u);
    g = Math.round(222 + (168 - 222) * u);
    b = Math.round(128 + (158 - 128) * u);
  } else {
    const u = (t - 0.5) / 0.5;
    r = Math.round(166 + (248 - 166) * u);
    g = Math.round(168 + (113 - 168) * u);
    b = Math.round(158 + (113 - 158) * u);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function computeStatRank(
  sameRolePlayers: { playerKey: string }[],
  playerKey: string,
  getter: (p: any) => number | null | undefined
): { color: string; rank: number; total: number } | null {
  const valid = sameRolePlayers
    .map((p) => ({ key: p.playerKey, val: getter(p) }))
    .filter((x): x is { key: string; val: number } => typeof x.val === "number" && Number.isFinite(x.val));
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.val - a.val);
  const idx = valid.findIndex((x) => x.key === playerKey);
  if (idx < 0) return null;
  // Tie-aware rank (share rank if exact same value)
  let rank = idx + 1;
  while (rank > 1 && valid[rank - 2].val === valid[idx].val) {
    rank--;
  }
  return {
    color: getRoleRankColor(rank, valid.length),
    rank,
    total: valid.length,
  };
}

const DUAL_PRIORITY_FLEX_STYLE = {
  border: "1px solid transparent",
  backgroundImage:
    "linear-gradient(90deg, rgba(255, 90, 82, 0.22), rgba(0, 184, 201, 0.22)), linear-gradient(90deg, #141816, #141816), linear-gradient(90deg, #ff5a52, #00b8c9)",
  backgroundOrigin: "padding-box, padding-box, border-box",
  backgroundClip: "padding-box, padding-box, border-box",
} as const;

function formatSigned(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const rounded = Math.round(val);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

export async function PlayerStatsContent({
  ctx,
  decodedKey,
  basePath = "/admin/stats",
}: {
  ctx: LoadedAdminStatsContext;
  decodedKey: string;
  basePath?: string;
}) {
  const soloPlayer = ctx.players.find((p) => p.playerKey === decodedKey);
  if (!soloPlayer) {
    return (
      <RetroWindow title="Player Not Found" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            Player not found in active season.
          </p>
          <Link href={basePath} className="xp-btn text-xs">
            ← Back to Stats Dashboard
          </Link>
        </div>
      </RetroWindow>
    );
  }

  const [sheetSummary, allSeries] = await Promise.all([
    fetchScdlSheetStats(ctx.players, ctx.teams, ctx.sheetConfig).catch(
      () => null
    ),
    fetchAllScdlSeries(ctx.sheetConfig).catch(() => []),
  ]);

  const rawDivPlayers = (sheetSummary?.players ?? []).filter(
    (p) => p.divisionId === soloPlayer.divisionId && p.games > 0
  );
  const ratedDivPlayers = computeRoleNormalizedRatings(rawDivPlayers);
  const lp =
    ratedDivPlayers.find((p) => p.playerKey === soloPlayer.playerKey) ?? null;

  const sameRoleDiv = ratedDivPlayers
    .filter((p) => p.role === soloPlayer.role)
    .sort((a, b) => b.leagueRating - a.leagueRating);
  const roleRankIdx = sameRoleDiv.findIndex(
    (p) => p.playerKey === soloPlayer.playerKey
  );
  const roleRank = roleRankIdx >= 0 ? roleRankIdx + 1 : null;

  const teamLeague = sheetSummary?.teams.find(
    (t) => t.teamId === soloPlayer.teamId
  );

  // Player's official league games + draft scouting (bans against team, R5 counterpicks, B1/R1-2)
  const playerGames: {
    seriesKey: string;
    roundLabel: string;
    oppTeam: string;
    duration: number;
    row: ScdlGamePlayerRow;
    oppRow: ScdlGamePlayerRow | null;
    pickSlot: string | null;
  }[] = [];

  const riotKeyNorm = soloPlayer.riotId.replace(/\s+#/g, "#").trim().toLowerCase();
  const displayLower = soloPlayer.displayName.trim().toLowerCase();

  for (const s of allSeries) {
    for (const g of s.games) {
      const myRow = g.players.find((gp) => {
        const gpKey = gp.playerName.replace(/\s+#/g, "#").trim().toLowerCase();
        return (
          gpKey === riotKeyNorm ||
          gp.displayName.trim().toLowerCase() === displayLower
        );
      });
      if (!myRow) continue;

      const isBlue = myRow.side === "Blue";
      const oppTeam = isBlue ? g.redTeam : g.blueTeam;
      const oppRow =
        g.players.find(
          (gp) => gp.side !== myRow.side && gp.role === myRow.role
        ) ?? null;

      let pickSlot: string | null = null;
      if (g.draft) {
        const myPicks = isBlue ? g.draft.bluePicks : g.draft.redPicks;
        const pIdx = myPicks.findIndex(
          (c) => c.toLowerCase() === myRow.champion.toLowerCase()
        );
        if (pIdx >= 0) {
          pickSlot = `${isBlue ? "B" : "R"}${pIdx + 1}`;
        }
      }

      playerGames.push({
        seriesKey: s.seriesKey,
        roundLabel: g.roundLabel,
        oppTeam,
        duration: g.gameDuration,
        row: myRow,
        oppRow,
        pickSlot,
      });
    }
  }

  const roleMeta = getRoleMeta(soloPlayer.role as LeagueRole);
  const styledRank = formatStyledSoloRank(
    soloPlayer.soloTier,
    soloPlayer.soloRank,
    soloPlayer.soloLp
  );
  const leaguePrefix = deriveLeaguePrefix(ctx.leagueName);
  const divThemeKey =
    ctx.divisions.find((d) => d.id === soloPlayer.divisionId)?.theme_key ??
    "scdl";
  const divTheme = resolveDivisionTheme(divThemeKey);
  const windowTheme =
    divThemeKey === "dragon"
      ? "dragon"
      : divThemeKey === "baron"
      ? "baron"
      : "scdl";

  const leagueChamps = lp?.topChampions ?? [];
  const leaguePrioRanks = getPriorityPickRanks(
    leagueChamps,
    soloPlayer.masteryTop4
  );

  const soloChamps = getRoleFilteredSoloChampions(
    soloPlayer.matches,
    soloPlayer.role,
    7
  );
  const soloPrioRanks = getPriorityPickRanks(
    soloChamps,
    soloPlayer.masteryTop4
  );

  const syncIso = soloPlayer.deepSyncedAt ?? soloPlayer.syncedAt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={basePath} className="xp-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Stats Dashboard</span>
          </Link>
          {soloPlayer.teamId && (
            <Link
              href={`${basePath}/team/${encodeURIComponent(soloPlayer.teamId)}`}
              className="xp-btn text-xs"
            >
              {soloPlayer.teamLogoUrl && (
                <img
                  src={soloPlayer.teamLogoUrl}
                  alt={soloPlayer.teamName}
                  className="w-3.5 h-3.5 object-contain"
                />
              )}
              <span>{soloPlayer.teamName} Team Stats</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[#a6a89e]">
          <Calendar className="w-3.5 h-3.5 text-[#f0c020]" />
          <span>
            Last SoloQ Sync:{" "}
            <strong className="text-[#f0ede0]">
              <LocalTimestamp iso={syncIso} fallback="Not synced yet" />
            </strong>
          </span>
        </div>
      </div>

      <RetroWindow title="Player Stats" theme={windowTheme} customTheme={divTheme}>
        {/* Player Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <img
              src={roleMeta.icon}
              alt={roleMeta.label}
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h1 className="wow-heading text-3xl sm:text-4xl font-extrabold text-white">
                  {soloPlayer.displayName}
                </h1>
                <span className="text-sm tabular-nums text-[#a6a89e]">
                  {soloPlayer.riotId}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 text-sm">
                <div className="flex items-center gap-2 text-base sm:text-lg font-extrabold text-[#f0ede0]">
                  {soloPlayer.teamLogoUrl && (
                    <img
                      src={soloPlayer.teamLogoUrl}
                      alt={soloPlayer.teamName}
                      className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
                    />
                  )}
                  <span>{soloPlayer.teamName}</span>
                </div>
                <div className="font-bold text-[#f0c020]">
                  <span style={{ color: divTheme.accent_text_color }}>
                    {soloPlayer.divisionName}
                  </span>{" "}
                  • {leaguePrefix} {ctx.seasonName}
                </div>
                <div className="font-bold text-[#a6a89e]">
                  Solo Q:{" "}
                  <span className={styledRank.className}>
                    {styledRank.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-center w-full sm:w-auto shrink-0">
            <div className="xp-inset px-4 py-2.5 min-w-[110px]">
              <div className="text-[11px] uppercase text-[#a6a89e]">
                Role Rank
              </div>
              <div
                style={
                  roleRank !== null
                    ? { color: getRoleRankColor(roleRank, sameRoleDiv.length) }
                    : undefined
                }
                className="text-xl sm:text-2xl font-black text-white"
              >
                {roleRank !== null
                  ? `#${roleRank} ${
                      soloPlayer.role === "jungle"
                        ? "Jgl"
                        : soloPlayer.role === "support"
                        ? "Sup"
                        : roleMeta.label
                    }`
                  : "—"}
              </div>
            </div>
            <div className="xp-inset px-4 py-2.5 min-w-[110px]">
              <div className="text-[11px] uppercase text-[#a6a89e]">
                Rankr Rating
              </div>
              <div
                style={
                  roleRank !== null
                    ? { color: getRoleRankColor(roleRank, sameRoleDiv.length) }
                    : undefined
                }
                className="text-xl sm:text-2xl font-black text-white"
              >
                {lp && lp.games > 0 ? lp.leagueRating.toFixed(1) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Full Season Individual Stats Strip (Strictly League Data, Color-Coded vs Role Peers) */}
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5 text-center">
            {[
              {
                label: "KDA",
                val: lp && lp.games > 0 ? lp.kda.toFixed(2) : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(sameRoleDiv, lp.playerKey, (p) => p.kda)
                    : null,
              },
              {
                label: "KP%",
                val: lp && lp.games > 0 ? `${lp.kpPct.toFixed(0)}%` : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(sameRoleDiv, lp.playerKey, (p) => p.kpPct)
                    : null,
              },
              {
                label: "DPM",
                val: lp && lp.games > 0 ? `${Math.round(lp.dpm)}` : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(sameRoleDiv, lp.playerKey, (p) => p.dpm)
                    : null,
              },
              {
                label: "GPM",
                val: lp && lp.games > 0 ? `${Math.round(lp.gpm)}` : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(sameRoleDiv, lp.playerKey, (p) => p.gpm)
                    : null,
              },
              {
                label: "CS/m",
                val: lp && lp.games > 0 ? lp.csPerMin.toFixed(1) : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(
                        sameRoleDiv,
                        lp.playerKey,
                        (p) => p.csPerMin
                      )
                    : null,
              },
              {
                label: "DMG%",
                val:
                  lp && lp.games > 0 ? `${lp.damageSharePct.toFixed(0)}%` : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(
                        sameRoleDiv,
                        lp.playerKey,
                        (p) => p.damageSharePct
                      )
                    : null,
              },
              {
                label: "VS/m",
                val: lp && lp.games > 0 ? lp.visionPerMin.toFixed(2) : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(
                        sameRoleDiv,
                        lp.playerKey,
                        (p) => p.visionPerMin
                      )
                    : null,
              },
              {
                label: "GD@15",
                val:
                  lp && lp.games > 0 ? formatSigned(lp.avgGoldDiff15) : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(
                        sameRoleDiv,
                        lp.playerKey,
                        (p) => p.avgGoldDiff15
                      )
                    : null,
              },
              {
                label: "Solo Kills",
                val: lp && lp.games > 0 ? `${lp.soloKills ?? 0}` : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(
                        sameRoleDiv,
                        lp.playerKey,
                        (p) => p.soloKills ?? 0
                      )
                    : null,
              },
              {
                label: "FB%",
                val:
                  lp && lp.games > 0 && lp.firstBloodPct != null
                    ? `${lp.firstBloodPct.toFixed(0)}%`
                    : "—",
                rankInfo:
                  lp && lp.games > 0
                    ? computeStatRank(
                        sameRoleDiv,
                        lp.playerKey,
                        (p) => p.firstBloodPct
                      )
                    : null,
              },
            ].map((s) => (
              <div
                key={s.label}
                title={
                  s.rankInfo
                    ? `#${s.rankInfo.rank} of ${s.rankInfo.total} ${roleMeta.label} in ${soloPlayer.divisionName}`
                    : undefined
                }
                className="xp-inset px-2.5 py-2.5"
              >
                <div className="text-[11px] font-bold uppercase text-[#a6a89e]">
                  {s.label}
                </div>
                <div
                  style={s.rankInfo ? { color: s.rankInfo.color } : undefined}
                  className="text-lg sm:text-xl font-black text-white mt-0.5 tabular-nums"
                >
                  {s.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 12-Col Champion & Mastery Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-6">
          {/* 1. This Season Champions */}
          <div className="xp-panel p-3.5 space-y-2.5 md:col-span-1 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
                This Season
              </h3>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-[#ff5a52]">
                  <span className="w-2.5 h-2.5 rounded-xs border border-[#ff5a52] bg-[#ff5a52]/25 inline-block" />
                  High Priority
                </span>
              </div>
            </div>
            {leagueChamps.length > 0 ? (
              <div className="space-y-1.5">
                {leagueChamps.map((c) => {
                  const prioRank = leaguePrioRanks.get(c.name);
                  const losses = c.games - c.wins;
                  return (
                    <div
                      key={c.name}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-xs sm:text-[13px] ${
                        prioRank !== undefined
                          ? getPriorityPickClass(prioRank)
                          : "border-white/10 bg-black/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getChampionIconUrl(c.name, ctx.ddVersion)}
                          alt={c.name}
                          className="w-6 h-6 rounded object-cover shrink-0"
                        />
                        <span className="font-bold text-[#f0ede0] truncate">
                          {c.name}
                        </span>
                      </div>
                      <span className="tabular-nums font-bold text-[#7cd438] shrink-0">
                        {c.wins}-{losses}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#a6a89e] italic">
                No {leaguePrefix} games played yet.
              </div>
            )}
          </div>

          {/* 2. Role-Filtered SoloQ Top 7 */}
          <div className="xp-panel p-3.5 space-y-2.5 md:col-span-1 lg:col-span-5">
            <h3
              title="Analyzes up to the 200 most recent SoloQ games (within the last year)"
              className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020] cursor-help inline-flex items-center gap-1.5"
            >
              <span>SoloQ Top 7 ({roleMeta.label})</span>
              <HelpCircle className="w-3.5 h-3.5 text-[#a6a89e]/80" />
            </h3>
            {soloChamps.length > 0 ? (
              <div className="space-y-1.5">
                {soloChamps.map((c) => {
                  const prioRank = soloPrioRanks.get(c.name);
                  const wr = (c.wins / c.games) * 100;
                  return (
                    <div
                      key={c.name}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-xs sm:text-[13px] ${
                        prioRank !== undefined
                          ? getPriorityPickClass(prioRank)
                          : "border-white/10 bg-black/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getChampionIconUrl(c.name, ctx.ddVersion)}
                          alt={c.name}
                          className="w-6 h-6 rounded object-cover shrink-0"
                        />
                        <span className="font-bold text-[#f0ede0] truncate">
                          {c.name}
                        </span>
                      </div>
                      <span className="inline-flex items-center text-xs shrink-0 tabular-nums">
                        <span className="w-6 text-right text-[#c7c5b8]">
                          {c.games}
                        </span>
                        <span className="w-4 text-center text-[#a6a89e]/50">
                          /
                        </span>
                        <span
                          className={`w-8 text-right font-bold ${
                            wr >= 50 ? "text-[#7cd438]" : "text-[#ff857a]"
                          }`}
                        >
                          {wr.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#a6a89e] italic">
                No {roleMeta.label} SoloQ games synced.
              </div>
            )}
          </div>

          {/* 3. Account Mastery Top 4 (2x2 Grid) */}
          <div className="xp-panel p-3.5 space-y-2.5 md:col-span-2 lg:col-span-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#f0c020]">
              Account Mastery Top 4
            </h3>
            {soloPlayer.masteryTop4.length > 0 ? (
              <div className="grid grid-cols-4 lg:grid-cols-2 gap-2.5">
                {soloPlayer.masteryTop4.map((m) => (
                  <div
                    key={m.championName}
                    title={`${m.championName} • ${m.championPoints.toLocaleString()} pts`}
                    className="bg-black/40 border border-white/10 rounded overflow-hidden text-center"
                  >
                    <img
                      src={getChampionIconUrl(m.championName, ctx.ddVersion)}
                      alt={m.championName}
                      className="w-full aspect-square object-cover block"
                    />
                    <div className="text-xs font-bold text-[#f0c020] py-1">
                      {formatMasteryPoints(m.championPoints)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#a6a89e] italic">
                Pending deep sync
              </div>
            )}
          </div>
        </div>

        {/* League Match History */}
        <div className="xp-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#f0c020]">
              Player Match History ({playerGames.length})
            </h2>
            <span className="text-xs text-[#a6a89e]">
              Click any game for full series draft &amp; box score
            </span>
          </div>

          {playerGames.length > 0 ? (
            <div className="divide-y divide-white/10">
              {playerGames.map((g, idx) => {
                const mins = Math.max(g.duration / 60, 1);
                const dpm = Math.round(g.row.damageDealt / mins);
                const kda =
                  g.row.deaths > 0
                    ? ((g.row.kills + g.row.assists) / g.row.deaths).toFixed(2)
                    : (g.row.kills + g.row.assists).toFixed(2);
                return (
                  <Link
                    key={`${g.seriesKey}-${idx}`}
                    href={`${basePath}/match/${encodeURIComponent(g.seriesKey)}`}
                    className="py-3 px-2.5 flex flex-wrap items-center justify-between gap-3 hover:bg-white/5 transition rounded text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <span
                        className={`w-1.5 h-11 rounded-full shrink-0 ${
                          g.row.win ? "bg-[#7cd438]" : "bg-[#ff857a]"
                        }`}
                      />
                      <img
                        src={getChampionIconUrl(g.row.champion, ctx.ddVersion)}
                        alt={g.row.champion}
                        className="w-11 h-11 rounded border border-white/20 object-cover shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2 font-bold text-[#f0ede0] text-sm sm:text-[15px]">
                          <span>{g.row.champion}</span>
                          {g.pickSlot && (
                            <span
                              className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
                                g.pickSlot.startsWith("B")
                                  ? "bg-[#5ea3ff]/20 text-[#5ea3ff]"
                                  : "bg-[#ff7b72]/20 text-[#ff7b72]"
                              }`}
                            >
                              {g.pickSlot}
                            </span>
                          )}
                          {g.oppRow && (
                            <span className="text-xs sm:text-[13px] font-normal text-[#a6a89e]">
                              vs{" "}
                              <strong className="text-[#ff857a]">
                                {g.oppRow.champion}
                              </strong>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#a6a89e] mt-0.5">
                          <span
                            className={
                              g.row.win ? "text-[#7cd438] font-bold" : "text-[#ff857a] font-bold"
                            }
                          >
                            {g.row.win ? "Win" : "Loss"}
                          </span>{" "}
                          • {g.roundLabel} vs {g.oppTeam} •{" "}
                          {formatMinutesSeconds(mins)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-5 tabular-nums text-xs sm:text-[13px]">
                      <div>
                        <strong className="text-white">
                          {g.row.kills}/{g.row.deaths}/{g.row.assists}
                        </strong>{" "}
                        <span className="text-[#a6a89e]">({kda})</span>
                      </div>
                      <div className="text-[#c7c5b8]">
                        {g.row.cs} CS ({(g.row.cs / mins).toFixed(1)}/m)
                      </div>
                      <div className="text-[#ff857a] font-bold">{dpm} DPM</div>
                      <div className="text-[#f0c020] font-bold">
                        GD@15 {formatSigned(g.row.goldDiff15)}
                      </div>
                      <ExternalLink className="w-4 h-4 text-[#a6a89e]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-[#a6a89e] italic py-3">
              No {leaguePrefix} games recorded yet.
            </div>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { StatsDataCredits } from "@/components/stats/StatsDataCredits";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import { formatMinutesSeconds } from "@/utils/riotStatsAggregation";
import type { LoadedStatsContext } from "@/utils/riotStatsServer";
import {
  fetchAllScdlSeries,
  type ScdlGameDetail,
  type ScdlGamePlayerRow,
} from "@/utils/scdlSheetStats";
import { resolveDivisionTheme } from "@/utils/themes";

export const dynamic = "force-dynamic";

const ROLE_ORDER: Record<string, number> = {
  top: 0,
  jungle: 1,
  mid: 2,
  bot: 3,
  support: 4,
};

function sortByRole(rows: ScdlGamePlayerRow[]): ScdlGamePlayerRow[] {
  return [...rows].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99),
  );
}

function formatSigned(val: number | null): string {
  if (val === null) return "—";
  return val >= 0 ? `+${val.toLocaleString()}` : val.toLocaleString();
}

function SideBoxScore({
  side,
  teamName,
  teamHref,
  isWinner,
  kills,
  rows,
  durationSec,
  ddVersion,
  basePath,
  playerKeyByName,
}: {
  side: "Blue" | "Red";
  teamName: string;
  teamHref?: string;
  isWinner: boolean;
  kills: number;
  rows: ScdlGamePlayerRow[];
  durationSec: number;
  ddVersion: string;
  basePath: string;
  playerKeyByName: Map<string, string>;
}) {
  const mins = Math.max(durationSec / 60, 1);
  const sideColor =
    side === "Blue"
      ? "text-[#78b7ff] border-[#4f8ee8]/30 bg-[#4f8ee8]/10"
      : "text-[#ff8f85] border-[#e85f4f]/30 bg-[#e85f4f]/10";

  return (
    <div className="rounded border border-[#2a2d28] bg-[#141614]/80 overflow-hidden">
      <div
        className={`flex items-center justify-between px-3.5 py-2 border-b border-[#262824] ${sideColor}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider">
            {side} Side
          </span>
          {teamHref ? (
            <Link
              href={teamHref}
              className="text-sm sm:text-base font-extrabold text-[#eaeade] hover:text-[#f0c020] transition-colors"
            >
              {teamName}
            </Link>
          ) : (
            <span className="text-sm sm:text-base font-extrabold text-[#eaeade]">
              {teamName}
            </span>
          )}
          {isWinner && (
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold uppercase bg-[#4ade80]/15 text-[#4ade80] border border-[#4ade80]/30">
              <Trophy className="w-3 h-3" />
              Win
            </span>
          )}
        </div>
        <span className="text-xs sm:text-sm font-bold tabular-nums">
          {kills} Kills
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#252824] text-[11px] uppercase tracking-wider text-[#8e9286] whitespace-nowrap">
              <th className="py-2 px-2.5 text-left">Player</th>
              <th className="py-2 px-2.5 text-center">K/D/A</th>
              <th className="py-2 px-2.5 text-right">CS</th>
              <th className="py-2 px-2.5 text-right">Gold</th>
              <th className="py-2 px-2.5 text-right">DPM</th>
              <th className="py-2 px-2.5 text-right">VS</th>
              <th className="py-2 px-2.5 text-right">GD</th>
              <th className="py-2 px-2.5 text-right">GD@15</th>
              <th className="py-2 px-2.5 text-right">SK</th>
            </tr>
          </thead>
          <tbody>
            {sortByRole(rows).map((p) => {
              const roleMeta = getRoleMeta(p.role as LeagueRole);
              const dpm = Math.round(p.damageDealt / mins);
              const matchedKey =
                playerKeyByName.get(p.displayName.toLowerCase()) ??
                playerKeyByName.get(p.playerName.toLowerCase());
              return (
                <tr
                  key={`${p.playerName}-${p.champion}`}
                  className="border-b border-[#1d201c] last:border-b-0 hover:bg-[#1e211d]"
                >
                  <td className="py-2 px-2.5">
                    <div className="flex items-center gap-2.5 min-w-[175px]">
                      {roleMeta?.icon && (
                        <img
                          src={roleMeta.icon}
                          alt={roleMeta.label}
                          className="w-4 h-4 shrink-0 opacity-85"
                        />
                      )}
                      <img
                        src={getChampionIconUrl(p.champion, ddVersion)}
                        alt={p.champion}
                        className="w-8 h-8 rounded border border-[#3a3e37] shrink-0 object-cover"
                      />
                      <div className="min-w-0">
                        {matchedKey ? (
                          <Link
                            href={`${basePath}/player/${encodeURIComponent(
                              matchedKey
                            )}`}
                            className="text-sm font-bold text-[#e6e8dd] hover:text-[#f0c020] transition-colors truncate block"
                          >
                            {p.displayName}
                          </Link>
                        ) : (
                          <div className="text-sm font-bold text-[#e6e8dd] truncate">
                            {p.displayName}
                          </div>
                        )}
                        <div className="text-xs text-[#9aa092]">
                          {p.champion}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2.5 text-center font-semibold tabular-nums text-[#dfe2d5]">
                    {p.kills}/{p.deaths}/{p.assists}
                  </td>
                  <td className="py-2 px-2.5 text-right tabular-nums text-[#c4c7ba]">
                    {p.cs}
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold tabular-nums text-[#f0c020]">
                    {(p.gold / 1000).toFixed(1)}k
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold tabular-nums text-[#ff857a]">
                    {dpm}
                  </td>
                  <td className="py-2 px-2.5 text-right tabular-nums text-[#c4c7ba]">
                    {p.visionScore}
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-semibold tabular-nums ${
                      (p.goldDiff ?? 0) >= 0
                        ? "text-[#4ade80]"
                        : "text-[#f87171]"
                    }`}
                  >
                    {formatSigned(p.goldDiff)}
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-semibold tabular-nums ${
                      p.goldDiff15 >= 0 ? "text-[#4ade80]" : "text-[#f87171]"
                    }`}
                  >
                    {formatSigned(p.goldDiff15)}
                  </td>
                  <td className="py-2 px-2.5 text-right tabular-nums text-[#c4c7ba]">
                    {p.soloKills}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DraftStrip({
  game,
  ddVersion,
}: {
  game: ScdlGameDetail;
  ddVersion: string;
}) {
  const draft = game.draft;
  if (!draft) return null;

  const hasPicks = draft.bluePicks.length > 0 || draft.redPicks.length > 0;
  const hasBans = draft.blueBans.length > 0 || draft.redBans.length > 0;
  if (!hasPicks && !hasBans) return null;

  return (
    <div className="rounded border border-[#2a2d28] bg-[#141614]/70 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#b7baae]">
          Draft Order & Bans
        </span>
        {draft.sourceUrl && (
          <a
            href={draft.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#78b7ff] hover:underline"
          >
            Drafter Link <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#78b7ff] uppercase">
            Blue — {game.blueTeam}
          </div>
          {draft.blueBans.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase text-[#7f8377] w-10 shrink-0">
                Bans
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.blueBans.map((champ, i) => (
                  <div
                    key={`bb-${champ}-${i}`}
                    className="relative w-8 h-8 rounded border border-[#3a2828] bg-[#201616] overflow-hidden shrink-0"
                    title={`Blue Ban ${i + 1}: ${champ}`}
                  >
                    <img
                      src={getChampionIconUrl(champ, ddVersion)}
                      alt={champ}
                      className="w-full h-full grayscale opacity-80 object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {draft.bluePicks.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase text-[#7f8377] w-10 shrink-0">
                Picks
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.bluePicks.map((champ, i) => (
                  <div
                    key={`bp-${champ}-${i}`}
                    className="relative w-8 h-8 rounded border border-[#2a4569] bg-[#142030] overflow-hidden shrink-0"
                    title={`B${i + 1}: ${champ}`}
                  >
                    <img
                      src={getChampionIconUrl(champ, ddVersion)}
                      alt={champ}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-0 left-0 px-1 text-[9px] font-bold leading-tight bg-black/80 text-[#78b7ff] rounded-br">
                      B{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-[#ff8f85] uppercase">
            Red — {game.redTeam}
          </div>
          {draft.redBans.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase text-[#7f8377] w-10 shrink-0">
                Bans
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.redBans.map((champ, i) => (
                  <div
                    key={`rb-${champ}-${i}`}
                    className="relative w-8 h-8 rounded border border-[#3a2828] bg-[#201616] overflow-hidden shrink-0"
                    title={`Red Ban ${i + 1}: ${champ}`}
                  >
                    <img
                      src={getChampionIconUrl(champ, ddVersion)}
                      alt={champ}
                      className="w-full h-full grayscale opacity-80 object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {draft.redPicks.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase text-[#7f8377] w-10 shrink-0">
                Picks
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.redPicks.map((champ, i) => (
                  <div
                    key={`rp-${champ}-${i}`}
                    className="relative w-8 h-8 rounded border border-[#612d2a] bg-[#2a1717] overflow-hidden shrink-0"
                    title={`R${i + 1}: ${champ}`}
                  >
                    <img
                      src={getChampionIconUrl(champ, ddVersion)}
                      alt={champ}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-0 left-0 px-1 text-[9px] font-bold leading-tight bg-black/80 text-[#ff8f85] rounded-br">
                      R{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function MatchSeriesContent({
  ctx,
  decodedKey,
  basePath = "/admin/stats",
}: {
  ctx: LoadedStatsContext;
  decodedKey: string;
  basePath?: string;
}) {
  const allSeries = await fetchAllScdlSeries(ctx.sheetConfig).catch(() => []);
  const series = allSeries.find((s) => s.seriesKey === decodedKey);

  if (!series) {
    return (
      <RetroWindow title="Match Results" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            Series not found ({decodedKey}).
          </p>
          <Link href={basePath} className="xp-btn text-xs">
            ← Back to Stats Dashboard
          </Link>
        </div>
      </RetroWindow>
    );
  }

  const teamByName = new Map(
    ctx.teams.map((t) => [t.teamName.toLowerCase(), t])
  );
  const teamAData = teamByName.get(series.teamA.toLowerCase());
  const teamBData = teamByName.get(series.teamB.toLowerCase());
  const divId = teamAData?.divisionId ?? teamBData?.divisionId;
  const division = ctx.divisions.find((d) => d.id === divId);
  const divThemeKey = division?.theme_key ?? "scdl";
  const divTheme = resolveDivisionTheme(divThemeKey);
  const windowTheme =
    divThemeKey === "dragon"
      ? "dragon"
      : divThemeKey === "baron"
      ? "baron"
      : "scdl";

  const playerKeyByName = new Map<string, string>();
  for (const pl of ctx.players) {
    playerKeyByName.set(pl.playerKey.toLowerCase(), pl.playerKey);
    playerKeyByName.set(pl.displayName.toLowerCase(), pl.playerKey);
    const riotBase = pl.riotId.split("#")[0]?.trim().toLowerCase();
    if (riotBase) playerKeyByName.set(riotBase, pl.playerKey);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={basePath}
          className="xp-btn inline-flex items-center gap-1.5 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Stats Dashboard</span>
        </Link>
        {teamAData && (
          <Link
            href={`${basePath}/team/${encodeURIComponent(teamAData.teamId)}`}
            className="xp-btn inline-flex items-center gap-1.5 text-xs"
          >
            {teamAData.logoUrl && (
              <img
                src={teamAData.logoUrl}
                alt={teamAData.teamName}
                className="w-4 h-4 object-contain"
              />
            )}
            <span>{teamAData.teamName} Team Stats</span>
          </Link>
        )}
        {teamBData && (
          <Link
            href={`${basePath}/team/${encodeURIComponent(teamBData.teamId)}`}
            className="xp-btn inline-flex items-center gap-1.5 text-xs"
          >
            {teamBData.logoUrl && (
              <img
                src={teamBData.logoUrl}
                alt={teamBData.teamName}
                className="w-4 h-4 object-contain"
              />
            )}
            <span>{teamBData.teamName} Team Stats</span>
          </Link>
        )}
      </div>

      <RetroWindow title="Match Results" theme={windowTheme} customTheme={divTheme}>
        <div className="space-y-4">
          {/* Series Banner */}
          <div className="rounded border border-[#2f332d] bg-[#171917] px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {teamAData?.logoUrl && (
                <img
                  src={teamAData.logoUrl}
                  alt={series.teamA}
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded"
                />
              )}
              {teamAData ? (
                <Link
                  href={`${basePath}/team/${encodeURIComponent(teamAData.teamId)}`}
                  className="text-xl sm:text-2xl font-extrabold text-[#eaeade] hover:text-[#f0c020] transition-colors"
                >
                  {series.teamA}
                </Link>
              ) : (
                <div className="text-xl sm:text-2xl font-extrabold text-[#eaeade]">
                  {series.teamA}
                </div>
              )}
            </div>

            <div className="text-center px-5 py-2 rounded border border-[#32362f] bg-[#111311] space-y-0.5 shrink-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#a6a89e] sm:whitespace-nowrap">
                {series.roundLabel}
                {division && (
                  <>
                    {" • "}
                    <span style={{ color: divTheme.primary_color }}>
                      {division.name}
                    </span>
                  </>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black tracking-wider text-[#f0c020] tabular-nums">
                {series.teamAWins} - {series.teamBWins}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[#8e9286] whitespace-nowrap">
                {series.games.length === 1
                  ? "Bo1"
                  : `Best of ${series.games.length <= 3 ? 3 : 5}`}{" "}
                • {ctx.seasonName}
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              {teamBData?.logoUrl && (
                <img
                  src={teamBData.logoUrl}
                  alt={series.teamB}
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded sm:order-2"
                />
              )}
              {teamBData ? (
                <Link
                  href={`${basePath}/team/${encodeURIComponent(teamBData.teamId)}`}
                  className="text-xl sm:text-2xl font-extrabold text-[#eaeade] hover:text-[#f0c020] transition-colors sm:order-1"
                >
                  {series.teamB}
                </Link>
              ) : (
                <div className="text-xl sm:text-2xl font-extrabold text-[#eaeade] sm:order-1">
                  {series.teamB}
                </div>
              )}
            </div>
          </div>

          {/* Per-game breakdown */}
          {series.games.map((g, idx) => {
            const bluePlayers = g.players.filter((p) => p.side === "Blue");
            const redPlayers = g.players.filter((p) => p.side === "Red");
            const blueTeamData = teamByName.get(g.blueTeam.toLowerCase());
            const redTeamData = teamByName.get(g.redTeam.toLowerCase());
            return (
              <div
                key={g.gameId}
                className="rounded border border-[#2c302a] bg-[#1a1c19] p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#272a25] pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#f0c020]">
                      Game {idx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[#c7c5b8] tabular-nums">
                      {formatMinutesSeconds(g.gameDuration / 60)}
                    </span>
                  </div>
                </div>

                <DraftStrip game={g} ddVersion={ctx.ddVersion} />

                <div className="space-y-3">
                  <SideBoxScore
                    side="Blue"
                    teamName={g.blueTeam}
                    teamHref={
                      blueTeamData
                        ? `${basePath}/team/${encodeURIComponent(
                            blueTeamData.teamId
                          )}`
                        : undefined
                    }
                    isWinner={
                      g.winnerTeam.toLowerCase() === g.blueTeam.toLowerCase()
                    }
                    kills={g.blueKills}
                    rows={bluePlayers}
                    durationSec={g.gameDuration}
                    ddVersion={ctx.ddVersion}
                    basePath={basePath}
                    playerKeyByName={playerKeyByName}
                  />
                  <SideBoxScore
                    side="Red"
                    teamName={g.redTeam}
                    teamHref={
                      redTeamData
                        ? `${basePath}/team/${encodeURIComponent(
                            redTeamData.teamId
                          )}`
                        : undefined
                    }
                    isWinner={
                      g.winnerTeam.toLowerCase() === g.redTeam.toLowerCase()
                    }
                    kills={g.redKills}
                    rows={redPlayers}
                    durationSec={g.gameDuration}
                    ddVersion={ctx.ddVersion}
                    basePath={basePath}
                    playerKeyByName={playerKeyByName}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <StatsDataCredits
            leagueName={ctx.leagueName}
            seasonName={ctx.seasonName}
            variant="compact"
          />
        </div>
      </RetroWindow>
    </div>
  );
}

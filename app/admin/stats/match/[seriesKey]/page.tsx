import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldAlert, Trophy } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";
import { getChampionIconUrl } from "@/utils/riotApi";
import { getRoleMeta, type LeagueRole } from "@/utils/roles";
import { formatMinutesSeconds } from "@/utils/riotStatsAggregation";
import { loadAdminStatsContext } from "@/utils/riotStatsServer";
import {
  fetchAllScdlSeries,
  type ScdlGameDetail,
  type ScdlGamePlayerRow,
} from "@/utils/scdlSheetStats";

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
  isWinner,
  kills,
  rows,
  durationSec,
  ddVersion,
}: {
  side: "Blue" | "Red";
  teamName: string;
  isWinner: boolean;
  kills: number;
  rows: ScdlGamePlayerRow[];
  durationSec: number;
  ddVersion: string;
}) {
  const mins = Math.max(durationSec / 60, 1);
  const sideColor =
    side === "Blue"
      ? "text-[#78b7ff] border-[#4f8ee8]/30 bg-[#4f8ee8]/10"
      : "text-[#ff8f85] border-[#e85f4f]/30 bg-[#e85f4f]/10";

  return (
    <div className="rounded border border-[#2a2d28] bg-[#141614]/80 overflow-hidden">
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b border-[#262824] ${sideColor}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {side} Side
          </span>
          <span className="text-xs font-bold text-[#eaeade]">{teamName}</span>
          {isWinner && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#4ade80]/15 text-[#4ade80] border border-[#4ade80]/30">
              <Trophy className="w-2.5 h-2.5" />
              Win
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono font-bold tabular-nums">
          {kills} Kills
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-[#252824] text-[9px] uppercase tracking-wider text-[#8e9286]">
              <th className="py-1.5 px-2 text-left">Player</th>
              <th className="py-1.5 px-2 text-center">K / D / A</th>
              <th className="py-1.5 px-2 text-right">CS</th>
              <th className="py-1.5 px-2 text-right">Gold</th>
              <th className="py-1.5 px-2 text-right">DPM</th>
              <th className="py-1.5 px-2 text-right">VS</th>
              <th className="py-1.5 px-2 text-right">GD</th>
              <th className="py-1.5 px-2 text-right">GD@15</th>
              <th className="py-1.5 px-2 text-right">SK</th>
            </tr>
          </thead>
          <tbody>
            {sortByRole(rows).map((p) => {
              const roleMeta = getRoleMeta(p.role as LeagueRole);
              const dpm = Math.round(p.damageDealt / mins);
              return (
                <tr
                  key={`${p.playerName}-${p.champion}`}
                  className="border-b border-[#1d201c] last:border-b-0 hover:bg-[#1e211d]"
                >
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-2 min-w-[150px]">
                      {roleMeta?.icon && (
                        <img
                          src={roleMeta.icon}
                          alt={roleMeta.label}
                          className="w-4 h-4 shrink-0 opacity-85"
                        />
                      )}
                      <img
                        src={getChampionIconUrl(ddVersion, p.champion)}
                        alt={p.champion}
                        className="w-6 h-6 rounded border border-[#3a3e37] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-[#e6e8dd] truncate">
                          {p.displayName}
                        </div>
                        <div className="text-[9px] text-[#8e9286]">
                          {p.champion}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono tabular-nums text-[#dfe2d5]">
                    {p.kills}/{p.deaths}/{p.assists}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#c4c7ba]">
                    {p.cs}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#e8c670]">
                    {(p.gold / 1000).toFixed(1)}k
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#c4c7ba]">
                    {dpm}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#c4c7ba]">
                    {p.visionScore}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                      (p.goldDiff ?? 0) >= 0
                        ? "text-[#4ade80]"
                        : "text-[#f87171]"
                    }`}
                  >
                    {formatSigned(p.goldDiff)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                      p.goldDiff15 >= 0 ? "text-[#4ade80]" : "text-[#f87171]"
                    }`}
                  >
                    {formatSigned(p.goldDiff15)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#c4c7ba]">
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
    <div className="rounded border border-[#2a2d28] bg-[#141614]/70 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#b7baae]">
          Draft Order & Bans
        </span>
        {draft.sourceUrl && (
          <a
            href={draft.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-[#78b7ff] hover:underline"
          >
            Drafter Link <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-[#78b7ff] uppercase">
            Blue — {game.blueTeam}
          </div>
          {draft.blueBans.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase text-[#7f8377] w-8">
                Bans
              </span>
              {draft.blueBans.map((champ, i) => (
                <div
                  key={`bb-${champ}-${i}`}
                  className="flex items-center gap-1 rounded border border-[#3a2828] bg-[#201616] px-1.5 py-0.5"
                  title={`Blue Ban ${i + 1}: ${champ}`}
                >
                  <img
                    src={getChampionIconUrl(ddVersion, champ)}
                    alt={champ}
                    className="w-4 h-4 rounded grayscale opacity-75"
                  />
                  <span className="text-[10px] text-[#c8a3a3]">{champ}</span>
                </div>
              ))}
            </div>
          )}
          {draft.bluePicks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase text-[#7f8377] w-8">
                Picks
              </span>
              {draft.bluePicks.map((champ, i) => (
                <div
                  key={`bp-${champ}-${i}`}
                  className="flex items-center gap-1 rounded border border-[#2a4569] bg-[#142030] px-1.5 py-0.5"
                  title={`B${i + 1}: ${champ}`}
                >
                  <span className="text-[9px] font-mono font-bold text-[#78b7ff]">
                    B{i + 1}
                  </span>
                  <img
                    src={getChampionIconUrl(ddVersion, champ)}
                    alt={champ}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[10px] text-[#dfe7f5]">{champ}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-[#ff8f85] uppercase">
            Red — {game.redTeam}
          </div>
          {draft.redBans.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase text-[#7f8377] w-8">
                Bans
              </span>
              {draft.redBans.map((champ, i) => (
                <div
                  key={`rb-${champ}-${i}`}
                  className="flex items-center gap-1 rounded border border-[#3a2828] bg-[#201616] px-1.5 py-0.5"
                  title={`Red Ban ${i + 1}: ${champ}`}
                >
                  <img
                    src={getChampionIconUrl(ddVersion, champ)}
                    alt={champ}
                    className="w-4 h-4 rounded grayscale opacity-75"
                  />
                  <span className="text-[10px] text-[#c8a3a3]">{champ}</span>
                </div>
              ))}
            </div>
          )}
          {draft.redPicks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase text-[#7f8377] w-8">
                Picks
              </span>
              {draft.redPicks.map((champ, i) => (
                <div
                  key={`rp-${champ}-${i}`}
                  className="flex items-center gap-1 rounded border border-[#612d2a] bg-[#2a1717] px-1.5 py-0.5"
                  title={`R${i + 1}: ${champ}`}
                >
                  <span className="text-[9px] font-mono font-bold text-[#ff8f85]">
                    R{i + 1}
                  </span>
                  <img
                    src={getChampionIconUrl(ddVersion, champ)}
                    alt={champ}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[10px] text-[#f5dfdf]">{champ}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function AdminMatchSeriesPage({
  params,
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  const decodedKey = decodeURIComponent(seriesKey);
  const ctx = await loadAdminStatsContext();

  if (!ctx.authorized) {
    return (
      <RetroWindow title="Match Results — Access Denied" theme="xp">
        <div className="py-8 px-4 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
          <p className="text-xs text-[#a6a89e]">Admin Access Required.</p>
        </div>
      </RetroWindow>
    );
  }

  const allSeries = await fetchAllScdlSeries().catch(() => []);
  const series = allSeries.find((s) => s.seriesKey === decodedKey);

  if (!series) {
    return (
      <RetroWindow title="Match Results" theme="scdl">
        <div className="p-6 text-center space-y-3">
          <p className="text-xs text-[#a6a89e]">
            Series not found ({decodedKey}).
          </p>
          <Link href="/admin/stats" className="xp-btn text-xs">
            ← Back to Stats Lab
          </Link>
        </div>
      </RetroWindow>
    );
  }

  const teamByName = new Map(
    ctx.teams.map((t) => [t.teamName.toLowerCase(), t]),
  );
  const teamAData = teamByName.get(series.teamA.toLowerCase());
  const teamBData = teamByName.get(series.teamB.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/stats"
          className="xp-btn inline-flex items-center gap-1.5 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Stats Lab
        </Link>
        {teamAData && (
          <Link
            href={`/admin/stats/team/${encodeURIComponent(teamAData.teamId)}`}
            className="xp-btn inline-flex items-center gap-1.5 text-xs"
          >
            {teamAData.teamName}
          </Link>
        )}
        {teamBData && (
          <Link
            href={`/admin/stats/team/${encodeURIComponent(teamBData.teamId)}`}
            className="xp-btn inline-flex items-center gap-1.5 text-xs"
          >
            {teamBData.teamName}
          </Link>
        )}
      </div>

      <RetroWindow title="Match Results" theme="scdl">
        <div className="p-4 space-y-5">
          {/* Series Banner */}
          <div className="rounded border border-[#2f332d] bg-[#171917] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {teamAData?.logoUrl && (
                <img
                  src={teamAData.logoUrl}
                  alt={series.teamA}
                  className="w-10 h-10 object-contain rounded"
                />
              )}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#8e9286]">
                  {series.roundLabel} • {ctx.seasonName}
                </div>
                {teamAData ? (
                  <Link
                    href={`/admin/stats/team/${encodeURIComponent(teamAData.teamId)}`}
                    className="text-base font-bold text-[#eaeade] hover:text-[#e8c670] transition-colors"
                  >
                    {series.teamA}
                  </Link>
                ) : (
                  <div className="text-base font-bold text-[#eaeade]">
                    {series.teamA}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center px-4 py-1.5 rounded border border-[#32362f] bg-[#111311]">
              <div className="text-xl font-mono font-bold tracking-wider text-[#e8c670]">
                {series.teamAWins} - {series.teamBWins}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#8e9286]">
                {series.games.length === 1
                  ? "Bo1"
                  : `Best of ${series.games.length <= 3 ? 3 : 5}`}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-[#8e9286]">
                  {series.matchLabel}
                </div>
                {teamBData ? (
                  <Link
                    href={`/admin/stats/team/${encodeURIComponent(teamBData.teamId)}`}
                    className="text-base font-bold text-[#eaeade] hover:text-[#e8c670] transition-colors"
                  >
                    {series.teamB}
                  </Link>
                ) : (
                  <div className="text-base font-bold text-[#eaeade]">
                    {series.teamB}
                  </div>
                )}
              </div>
              {teamBData?.logoUrl && (
                <img
                  src={teamBData.logoUrl}
                  alt={series.teamB}
                  className="w-10 h-10 object-contain rounded"
                />
              )}
            </div>
          </div>

          {/* Per-game breakdown */}
          {series.games.map((g, idx) => {
            const bluePlayers = g.players.filter((p) => p.side === "Blue");
            const redPlayers = g.players.filter((p) => p.side === "Red");
            return (
              <div
                key={g.gameId}
                className="rounded border border-[#2c302a] bg-[#1a1c19] p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#272a25] pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#e8c670]">
                      Game {idx + 1}
                    </span>
                    <span className="text-[11px] font-mono text-[#a6a89e]">
                      {formatMinutesSeconds(g.gameDuration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#8e9286]">Winner:</span>
                    <span className="font-bold text-[#4ade80]">
                      {g.winnerTeam}
                    </span>
                  </div>
                </div>

                <DraftStrip game={g} ddVersion={ctx.ddVersion} />

                <div className="space-y-3">
                  <SideBoxScore
                    side="Blue"
                    teamName={g.blueTeam}
                    isWinner={
                      g.winnerTeam.toLowerCase() === g.blueTeam.toLowerCase()
                    }
                    kills={g.blueKills}
                    rows={bluePlayers}
                    durationSec={g.gameDuration}
                    ddVersion={ctx.ddVersion}
                  />
                  <SideBoxScore
                    side="Red"
                    teamName={g.redTeam}
                    isWinner={
                      g.winnerTeam.toLowerCase() === g.redTeam.toLowerCase()
                    }
                    kills={g.redKills}
                    rows={redPlayers}
                    durationSec={g.gameDuration}
                    ddVersion={ctx.ddVersion}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </RetroWindow>
    </div>
  );
}

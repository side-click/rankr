export interface CompactRiotMatch {
  matchId: string;
  gameCreation: number;
  gameDuration: number; // seconds
  queueId: number;
  win: boolean;
  championName: string;
  teamId: number; // 100 = Blue, 200 = Red
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  visionScore: number;
  teamKills: number;
  teamDamage: number;
  teamGold: number;
}

export interface SyncedPlayerInput {
  playerKey: string;
  riotId: string;
  seasonId: string | null;
  divisionId: string | null;
  teamId: string | null;
  role: string | null;
}

export interface SyncedPlayerResult {
  player_key: string;
  riot_id: string;
  puuid: string | null;
  season_id: string | null;
  division_id: string | null;
  team_id: string | null;
  role: string | null;
  solo_tier: string | null;
  solo_rank: string | null;
  solo_lp: number | null;
  solo_wins: number | null;
  solo_losses: number | null;
  matches: CompactRiotMatch[];
  sync_error: string | null;
  synced_at: string;
}

let cachedDdVersion: { version: string; fetchedAt: number } | null = null;

export async function getLatestDdragonVersion(): Promise<string> {
  const now = Date.now();
  if (cachedDdVersion && now - cachedDdVersion.fetchedAt < 3600_000) {
    return cachedDdVersion.version;
  }
  try {
    const res = await fetch(
      "https://ddragon.leagueoflegends.com/api/versions.json",
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const versions = (await res.json()) as string[];
      if (Array.isArray(versions) && versions[0]) {
        cachedDdVersion = { version: versions[0], fetchedAt: now };
        return versions[0];
      }
    }
  } catch {
    // fallback below
  }
  return cachedDdVersion?.version ?? "15.22.1";
}

export function getChampionIconUrl(
  championName: string,
  ddVersion: string
): string {
  // Riot match-v5 returns "FiddleSticks" in some patches whereas ddragon uses "Fiddlesticks"
  const normalized =
    championName === "FiddleSticks" ? "Fiddlesticks" : championName;
  return `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${encodeURIComponent(
    normalized
  )}.png`;
}

export function parseRiotId(raw: string): { gameName: string; tagLine: string } {
  const trimmed = raw.trim();
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx === -1) {
    return { gameName: trimmed, tagLine: "NA1" };
  }
  const gameName = trimmed.slice(0, hashIdx).trim();
  const tagLine = trimmed.slice(hashIdx + 1).trim() || "NA1";
  return { gameName, tagLine };
}

export class RiotRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Riot API rate limit hit; retry after ${retryAfterSeconds}s`);
    this.name = "RiotRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function riotFetch<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
    cache: "no-store",
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "30");
    throw new RiotRateLimitError(Math.max(1, Math.ceil(retryAfter)));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Riot API ${res.status}: ${text.slice(0, 120)}`);
  }

  return (await res.json()) as T;
}

interface RiotAccountResponse {
  puuid: string;
  gameName: string;
  tagLine: string;
}

interface RiotLeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

interface RiotMatchParticipant {
  puuid: string;
  teamId: number;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  visionScore: number;
}

interface RiotMatchResponse {
  metadata: { matchId: string };
  info: {
    gameCreation: number;
    gameDuration: number;
    queueId: number;
    participants: RiotMatchParticipant[];
  };
}

export async function syncPlayerFromRiot(
  input: SyncedPlayerInput,
  apiKey: string,
  matchCount = 5
): Promise<SyncedPlayerResult> {
  const nowIso = new Date().toISOString();
  const { gameName, tagLine } = parseRiotId(input.riotId);

  try {
    const account = await riotFetch<RiotAccountResponse>(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`,
      apiKey
    );

    const puuid = account.puuid;

    // Fetch Solo/Duo rank (ignore errors if unranked)
    let soloEntry: RiotLeagueEntry | undefined;
    try {
      const entries = await riotFetch<RiotLeagueEntry[]>(
        `https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(
          puuid
        )}`,
        apiKey
      );
      soloEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
    } catch {
      soloEntry = undefined;
    }

    // Fetch recent ranked match IDs; fall back to any SR matches if none
    let matchIds = await riotFetch<string[]>(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?type=ranked&start=0&count=${matchCount}`,
      apiKey
    );
    if (matchIds.length === 0) {
      matchIds = await riotFetch<string[]>(
        `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
          puuid
        )}/ids?start=0&count=${matchCount}`,
        apiKey
      );
    }

    const matches: CompactRiotMatch[] = [];
    for (const matchId of matchIds) {
      try {
        const matchData = await riotFetch<RiotMatchResponse>(
          `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(
            matchId
          )}`,
          apiKey
        );
        const me = matchData.info.participants.find((p) => p.puuid === puuid);
        if (!me || matchData.info.gameDuration < 180) continue;

        const allies = matchData.info.participants.filter(
          (p) => p.teamId === me.teamId
        );
        const teamKills = allies.reduce((s, p) => s + p.kills, 0);
        const teamDamage = allies.reduce(
          (s, p) => s + p.totalDamageDealtToChampions,
          0
        );
        const teamGold = allies.reduce((s, p) => s + p.goldEarned, 0);

        matches.push({
          matchId: matchData.metadata.matchId,
          gameCreation: matchData.info.gameCreation,
          gameDuration: matchData.info.gameDuration,
          queueId: matchData.info.queueId,
          win: me.win,
          championName: me.championName,
          teamId: me.teamId,
          kills: me.kills,
          deaths: me.deaths,
          assists: me.assists,
          cs: me.totalMinionsKilled + me.neutralMinionsKilled,
          totalDamageDealtToChampions: me.totalDamageDealtToChampions,
          goldEarned: me.goldEarned,
          visionScore: me.visionScore,
          teamKills,
          teamDamage,
          teamGold,
        });
      } catch (matchErr) {
        if (matchErr instanceof RiotRateLimitError) {
          throw matchErr;
        }
        // Skip failed individual match without failing whole player
      }
    }

    return {
      player_key: input.playerKey,
      riot_id: `${account.gameName}#${account.tagLine}`,
      puuid,
      season_id: input.seasonId,
      division_id: input.divisionId,
      team_id: input.teamId,
      role: input.role,
      solo_tier: soloEntry?.tier ?? null,
      solo_rank: soloEntry?.rank ?? null,
      solo_lp: soloEntry?.leaguePoints ?? null,
      solo_wins: soloEntry?.wins ?? null,
      solo_losses: soloEntry?.losses ?? null,
      matches,
      sync_error: null,
      synced_at: nowIso,
    };
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      throw err;
    }
    return {
      player_key: input.playerKey,
      riot_id: input.riotId,
      puuid: null,
      season_id: input.seasonId,
      division_id: input.divisionId,
      team_id: input.teamId,
      role: input.role,
      solo_tier: null,
      solo_rank: null,
      solo_lp: null,
      solo_wins: null,
      solo_losses: null,
      matches: [],
      sync_error: err instanceof Error ? err.message : "Sync failed",
      synced_at: nowIso,
    };
  }
}

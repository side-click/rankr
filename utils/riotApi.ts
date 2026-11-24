export interface CompactRiotMatch {
  matchId: string;
  gameCreation: number;
  gameDuration: number; // seconds
  gameVersion?: string;
  queueId: number;
  win: boolean;
  championName: string;
  teamId: number; // 100 = Blue, 200 = Red
  teamPosition?: string;
  champLevel?: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken?: number;
  damageSelfMitigated?: number;
  totalHealsOnTeammates?: number;
  totalDamageShieldedOnTeammates?: number;
  damageDealtToObjectives?: number;
  damageDealtToTurrets?: number;
  timeCCingOthers?: number;
  goldEarned: number;
  visionScore: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  controlWardsBought?: number;
  teamKills: number;
  teamDamage: number;
  teamGold: number;
  opponentChampion?: string;
  goldDiff?: number;
  csDiff?: number;
  dmgDiff?: number;
  xpDiff?: number;
  soloKills?: number;
  firstBlood?: boolean;
  firstTower?: boolean;
  doubleKills?: number;
  tripleKills?: number;
  quadraKills?: number;
  pentaKills?: number;
  largestKillingSpree?: number;
  turretKills?: number;
  dragonKills?: number;
  baronKills?: number;
  teamDragons?: number;
  teamBarons?: number;
  teamHeralds?: number;
  teamVoidgrubs?: number;
  teamTowers?: number;
  bans?: string[];
  flashKey?: "D" | "F";
  goldDiff15?: number;
  questionPings?: number;
  turretPlates?: number;
  objectivesStolen?: number;
  matchLabel?: string;
  isPlayoff?: boolean;
  teamName?: string;
}

export interface SyncedPlayerInput {
  playerKey: string;
  riotId: string;
  seasonId: string | null;
  divisionId: string | null;
  teamId: string | null;
  role: string | null;
}

export interface ChampionMasteryEntry {
  championName: string;
  championLevel: number;
  championPoints: number;
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
  mastery_top4?: ChampionMasteryEntry[];
  deep_synced_at?: string | null;
  sync_error: string | null;
  synced_at: string;
}

let cachedDdVersion: { version: string; fetchedAt: number } | null = null;
let cachedChampIdMap: {
  version: string;
  map: Map<number, string>;
} | null = null;

export async function getChampionIdToNameMap(
  ddVersion: string
): Promise<Map<number, string>> {
  if (cachedChampIdMap && cachedChampIdMap.version === ddVersion) {
    return cachedChampIdMap.map;
  }
  const map = new Map<number, string>();
  try {
    const res = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data: Record<string, { key: string; id: string }>;
      };
      for (const champ of Object.values(json.data ?? {})) {
        const idNum = Number(champ.key);
        if (Number.isFinite(idNum) && champ.id) {
          map.set(idNum, champ.id);
        }
      }
      cachedChampIdMap = { version: ddVersion, map };
    }
  } catch {
    // ignore fallback
  }
  return map;
}

export async function getLatestDdragonVersion(): Promise<string> {
  const now = Date.now();
  if (cachedDdVersion && now - cachedDdVersion.fetchedAt < 3600_000) {
    return cachedDdVersion.version;
  }
  try {
    const res = await fetch(
      "https://ddragon.leagueoflegends.com/api/versions.json",
      { next: { revalidate: 86400 } }
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

export function getChampionCenteredSplashUrl(championName: string): string {
  const normalized =
    championName === "FiddleSticks" ? "Fiddlesticks" : championName;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/champion-splashes/${encodeURIComponent(
      normalized
    )}.webp`;
  }
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${encodeURIComponent(
    normalized
  )}_0.jpg`;
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
  teamPosition?: string;
  champLevel?: number;
  champExperience?: number;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  doubleKills?: number;
  tripleKills?: number;
  quadraKills?: number;
  pentaKills?: number;
  largestKillingSpree?: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken?: number;
  damageSelfMitigated?: number;
  totalHealsOnTeammates?: number;
  totalDamageShieldedOnTeammates?: number;
  damageDealtToObjectives?: number;
  damageDealtToTurrets?: number;
  timeCCingOthers?: number;
  goldEarned: number;
  visionScore: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  visionWardsBoughtInGame?: number;
  turretKills?: number;
  dragonKills?: number;
  baronKills?: number;
  firstBloodKill?: boolean;
  firstBloodAssist?: boolean;
  firstTowerKill?: boolean;
  firstTowerAssist?: boolean;
  summoner1Id?: number;
  summoner2Id?: number;
  challenges?: {
    soloKills?: number;
  };
}

interface RiotMatchTeam {
  teamId: number;
  bans?: { championId: number; pickTurn: number }[];
  objectives?: {
    dragon?: { kills?: number };
    baron?: { kills?: number };
    riftHerald?: { kills?: number };
    horde?: { kills?: number };
    tower?: { kills?: number };
  };
}

interface RiotMatchResponse {
  metadata: { matchId: string };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameVersion?: string;
    queueId: number;
    participants: RiotMatchParticipant[];
    teams?: RiotMatchTeam[];
  };
}

export async function fetchChampionMasteryTop4(
  puuid: string,
  apiKey: string,
  champIdMap: Map<number, string>
): Promise<ChampionMasteryEntry[]> {
  try {
    const raw = await riotFetch<
      {
        championId: number;
        championLevel: number;
        championPoints: number;
      }[]
    >(
      `https://na1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
        puuid
      )}/top?count=4`,
      apiKey
    );
    return (Array.isArray(raw) ? raw : [])
      .map((m) => ({
        championName: champIdMap.get(m.championId) ?? String(m.championId),
        championLevel: m.championLevel,
        championPoints: m.championPoints,
      }))
      .slice(0, 4);
  } catch (err) {
    if (err instanceof RiotRateLimitError) throw err;
    return [];
  }
}

export async function syncPlayerFromRiot(
  input: SyncedPlayerInput,
  apiKey: string,
  matchCount = 5,
  options?: {
    existingMatches?: CompactRiotMatch[];
    maxAgeDays?: number;
    fetchMastery?: boolean;
  }
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

    const startTimeParam =
      options?.maxAgeDays && options.maxAgeDays > 0
        ? `&startTime=${Math.floor(
            (Date.now() - options.maxAgeDays * 86_400_000) / 1000
          )}`
        : "";

    // Fetch recent ranked match IDs; fall back to any SR matches if none
    let matchIds = await riotFetch<string[]>(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?type=ranked&start=0&count=${matchCount}${startTimeParam}`,
      apiKey
    );
    if (matchIds.length === 0) {
      matchIds = await riotFetch<string[]>(
        `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
          puuid
        )}/ids?start=0&count=${matchCount}${startTimeParam}`,
        apiKey
      );
    }

    const ddVersion = await getLatestDdragonVersion();
    const champIdMap = await getChampionIdToNameMap(ddVersion);

    const masteryTop4 = options?.fetchMastery
      ? await fetchChampionMasteryTop4(puuid, apiKey, champIdMap)
      : undefined;

    const existingById = new Map<string, CompactRiotMatch>();
    for (const em of options?.existingMatches ?? []) {
      existingById.set(em.matchId, em);
    }

    const matches: CompactRiotMatch[] = [];
    for (const matchId of matchIds) {
      const cached = existingById.get(matchId);
      if (cached) {
        matches.push(cached);
        continue;
      }
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

        const meCs = me.totalMinionsKilled + me.neutralMinionsKilled;
        const laneOpponent = me.teamPosition
          ? matchData.info.participants.find(
              (p) =>
                p.teamId !== me.teamId && p.teamPosition === me.teamPosition
            )
          : undefined;
        const oppCs = laneOpponent
          ? laneOpponent.totalMinionsKilled + laneOpponent.neutralMinionsKilled
          : undefined;
        const goldDiff = laneOpponent
          ? me.goldEarned - laneOpponent.goldEarned
          : undefined;
        const csDiff =
          oppCs !== undefined ? meCs - oppCs : undefined;
        const dmgDiff = laneOpponent
          ? me.totalDamageDealtToChampions -
            laneOpponent.totalDamageDealtToChampions
          : undefined;
        const xpDiff =
          laneOpponent &&
          typeof me.champExperience === "number" &&
          typeof laneOpponent.champExperience === "number"
            ? me.champExperience - laneOpponent.champExperience
            : undefined;

        const myTeam = matchData.info.teams?.find(
          (t) => t.teamId === me.teamId
        );

        const bans: string[] = [];
        for (const t of matchData.info.teams ?? []) {
          for (const b of t.bans ?? []) {
            if (b.championId > 0) {
              const name = champIdMap.get(b.championId);
              if (name) bans.push(name);
            }
          }
        }

        matches.push({
          matchId: matchData.metadata.matchId,
          gameCreation: matchData.info.gameCreation,
          gameDuration: matchData.info.gameDuration,
          gameVersion: matchData.info.gameVersion,
          queueId: matchData.info.queueId,
          win: me.win,
          championName: me.championName,
          teamId: me.teamId,
          teamPosition: me.teamPosition,
          champLevel: me.champLevel,
          kills: me.kills,
          deaths: me.deaths,
          assists: me.assists,
          cs: meCs,
          totalDamageDealtToChampions: me.totalDamageDealtToChampions,
          totalDamageTaken: me.totalDamageTaken,
          damageSelfMitigated: me.damageSelfMitigated,
          totalHealsOnTeammates: me.totalHealsOnTeammates,
          totalDamageShieldedOnTeammates: me.totalDamageShieldedOnTeammates,
          damageDealtToObjectives: me.damageDealtToObjectives,
          damageDealtToTurrets: me.damageDealtToTurrets,
          timeCCingOthers: me.timeCCingOthers,
          goldEarned: me.goldEarned,
          visionScore: me.visionScore,
          wardsPlaced: me.wardsPlaced,
          wardsKilled: me.wardsKilled,
          controlWardsBought: me.visionWardsBoughtInGame,
          teamKills,
          teamDamage,
          teamGold,
          opponentChampion: laneOpponent?.championName,
          goldDiff,
          csDiff,
          dmgDiff,
          xpDiff,
          soloKills: me.challenges?.soloKills,
          firstBlood: Boolean(me.firstBloodKill || me.firstBloodAssist),
          firstTower: Boolean(me.firstTowerKill || me.firstTowerAssist),
          doubleKills: me.doubleKills,
          tripleKills: me.tripleKills,
          quadraKills: me.quadraKills,
          pentaKills: me.pentaKills,
          largestKillingSpree: me.largestKillingSpree,
          turretKills: me.turretKills,
          dragonKills: me.dragonKills,
          baronKills: me.baronKills,
          teamDragons: myTeam?.objectives?.dragon?.kills,
          teamBarons: myTeam?.objectives?.baron?.kills,
          teamHeralds: myTeam?.objectives?.riftHerald?.kills,
          teamVoidgrubs: myTeam?.objectives?.horde?.kills,
          teamTowers: myTeam?.objectives?.tower?.kills,
          bans,
          flashKey:
            me.summoner1Id === 4
              ? "D"
              : me.summoner2Id === 4
              ? "F"
              : undefined,
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
      ...(masteryTop4 ? { mastery_top4: masteryTop4 } : {}),
      ...(options?.fetchMastery ? { deep_synced_at: nowIso } : {}),
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

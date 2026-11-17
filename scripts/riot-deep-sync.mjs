import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RIOT_API_KEY = process.env.RIOT_API_KEY?.trim();

const MATCH_COUNT = Math.min(
  100,
  Math.max(5, Number(process.env.DEEP_SYNC_MATCH_COUNT ?? "100"))
);
const MAX_AGE_DAYS = 180;

if (!SUPABASE_URL || !SUPABASE_KEY || !RIOT_API_KEY) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RIOT_API_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sliding window rate limiter: max 90 requests per 122s (safe under 100 / 120s dev key)
const WINDOW_MS = 122_000;
const MAX_REQS_PER_WINDOW = 90;
const reqTimestamps = [];

async function paceRequest() {
  while (true) {
    const now = Date.now();
    while (reqTimestamps.length > 0 && now - reqTimestamps[0] >= WINDOW_MS) {
      reqTimestamps.shift();
    }
    if (reqTimestamps.length < MAX_REQS_PER_WINDOW) {
      reqTimestamps.push(now);
      return;
    }
    const waitMs = Math.max(1000, WINDOW_MS - (now - reqTimestamps[0]) + 250);
    console.log(`[rate-limit] pausing ${Math.ceil(waitMs / 1000)}s...`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

class RiotAuthError extends Error {}

async function riotFetch(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await paceRequest();
    const res = await fetch(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });
    if (res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => "");
      throw new RiotAuthError(
        `Riot ${res.status}: RIOT_API_KEY expired or unauthorized (${text.slice(0, 120)})`
      );
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "30");
      const waitSec = Math.max(2, Math.ceil(retryAfter) + 2);
      console.warn(`[429] Retry-After ${waitSec}s on ${url}`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Riot ${res.status}: ${text.slice(0, 120)}`);
    }
    return res.json();
  }
  throw new Error("Exceeded 429 retries");
}

function parseRiotId(raw) {
  const trimmed = raw.trim();
  const idx = trimmed.indexOf("#");
  if (idx === -1) return { gameName: trimmed, tagLine: "NA1" };
  return {
    gameName: trimmed.slice(0, idx).trim(),
    tagLine: trimmed.slice(idx + 1).trim() || "NA1",
  };
}

const versions = await (
  await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
).json();
const ddVersion = versions[0];
const champData = await (
  await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`
  )
).json();

const champIdMap = new Map();
for (const c of Object.values(champData.data ?? {})) {
  champIdMap.set(Number(c.key), c.id);
}

const { data: seasons } = await supabase
  .from("seasons")
  .select("id, name, is_active, created_at")
  .order("created_at", { ascending: false });
const activeSeason =
  (seasons ?? []).find((s) => s.is_active) ?? (seasons ?? [])[0] ?? null;

const { data: divisions } = await supabase
  .from("divisions")
  .select("id, season_id")
  .eq("season_id", activeSeason?.id);
const divIds = new Set((divisions ?? []).map((d) => d.id));

const { data: teams } = await supabase
  .from("teams")
  .select("id, division_id, roster, captain");
const seasonTeams = (teams ?? []).filter((t) => divIds.has(t.division_id));

const { data: existingRows } = await supabase
  .from("riot_player_stats")
  .select("player_key, matches");
const existingByKey = new Map(
  (existingRows ?? []).map((r) => [r.player_key, r.matches ?? []])
);

const players = [];
for (const team of seasonTeams) {
  const roster = Array.isArray(team.roster) ? team.roster : [];
  for (const slot of roster) {
    const name = typeof slot === "string" ? slot : slot?.name;
    const role = typeof slot === "object" && slot?.role ? slot.role : null;
    if (!name || !name.trim()) continue;
    const clean = name.trim();
    players.push({
      playerKey: clean.toLowerCase(),
      riotId: clean,
      seasonId: activeSeason?.id ?? null,
      divisionId: team.division_id,
      teamId: team.id,
      role,
    });
  }
}

console.log(
  `Starting deep sync for ${players.length} players (${MATCH_COUNT} games, ${MAX_AGE_DAYS}d window)...`
);

const startTimeSec = Math.floor(
  (Date.now() - MAX_AGE_DAYS * 86_400_000) / 1000
);

for (let idx = 0; idx < players.length; idx++) {
  const p = players[idx];
  const nowIso = new Date().toISOString();
  const { gameName, tagLine } = parseRiotId(p.riotId);

  try {
    const account = await riotFetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`
    );
    const puuid = account.puuid;

    let soloEntry;
    try {
      const entries = await riotFetch(
        `https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(
          puuid
        )}`
      );
      soloEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
    } catch {
      soloEntry = undefined;
    }

    const masteryRaw = await riotFetch(
      `https://na1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(
        puuid
      )}/top?count=4`
    ).catch(() => []);
    const mastery_top4 = (Array.isArray(masteryRaw) ? masteryRaw : [])
      .map((m) => ({
        championName: champIdMap.get(m.championId) ?? String(m.championId),
        championLevel: m.championLevel,
        championPoints: m.championPoints,
      }))
      .slice(0, 4);

    let matchIds = await riotFetch(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?type=ranked&start=0&count=${MATCH_COUNT}&startTime=${startTimeSec}`
    );
    if (matchIds.length === 0) {
      matchIds = await riotFetch(
        `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
          puuid
        )}/ids?start=0&count=${MATCH_COUNT}&startTime=${startTimeSec}`
      );
    }

    const prevMap = new Map(
      (existingByKey.get(p.playerKey) ?? []).map((m) => [m.matchId, m])
    );

    const matches = [];
    let fetchedNew = 0;
    for (const matchId of matchIds) {
      if (prevMap.has(matchId)) {
        matches.push(prevMap.get(matchId));
        continue;
      }
      try {
        const matchData = await riotFetch(
          `https://americas.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(
            matchId
          )}`
        );
        fetchedNew += 1;
        const me = matchData.info.participants.find((x) => x.puuid === puuid);
        if (!me || matchData.info.gameDuration < 180) continue;

        const allies = matchData.info.participants.filter(
          (x) => x.teamId === me.teamId
        );
        const teamKills = allies.reduce((s, x) => s + x.kills, 0);
        const teamDamage = allies.reduce(
          (s, x) => s + x.totalDamageDealtToChampions,
          0
        );
        const teamGold = allies.reduce((s, x) => s + x.goldEarned, 0);
        const opp = me.teamPosition
          ? matchData.info.participants.find(
              (x) => x.teamId !== me.teamId && x.teamPosition === me.teamPosition
            )
          : undefined;
        const meCs = me.totalMinionsKilled + me.neutralMinionsKilled;
        const oppCs = opp
          ? opp.totalMinionsKilled + opp.neutralMinionsKilled
          : undefined;

        const bans = [];
        for (const t of matchData.info.teams ?? []) {
          for (const b of t.bans ?? []) {
            if (b.championId > 0) {
              const cn = champIdMap.get(b.championId);
              if (cn) bans.push(cn);
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
          opponentChampion: opp?.championName,
          goldDiff: opp ? me.goldEarned - opp.goldEarned : undefined,
          csDiff: oppCs !== undefined ? meCs - oppCs : undefined,
          soloKills: me.challenges?.soloKills,
          firstBlood: Boolean(me.firstBloodKill || me.firstBloodAssist),
          bans,
          flashKey:
            me.summoner1Id === 4
              ? "D"
              : me.summoner2Id === 4
              ? "F"
              : undefined,
        });
      } catch (e) {
        console.warn(`  [skip match ${matchId}] ${e.message}`);
      }
    }

    const { error } = await supabase.from("riot_player_stats").upsert(
      {
        player_key: p.playerKey,
        riot_id: `${account.gameName}#${account.tagLine}`,
        puuid,
        season_id: p.seasonId,
        division_id: p.divisionId,
        team_id: p.teamId,
        role: p.role,
        solo_tier: soloEntry?.tier ?? null,
        solo_rank: soloEntry?.rank ?? null,
        solo_lp: soloEntry?.leaguePoints ?? null,
        solo_wins: soloEntry?.wins ?? null,
        solo_losses: soloEntry?.losses ?? null,
        matches,
        mastery_top4,
        deep_synced_at: nowIso,
        sync_error: null,
        synced_at: nowIso,
      },
      { onConflict: "player_key" }
    );
    if (error) throw new Error(error.message);

    console.log(
      `[${idx + 1}/${players.length}] ${p.riotId} OK — ${matches.length}G (${fetchedNew} new), mastery ${mastery_top4
        .map((m) => m.championName)
        .join("/")}`
    );
  } catch (err) {
    if (err instanceof RiotAuthError) {
      console.error(
        "::error::RIOT_API_KEY expired or unauthorized (HTTP 401/403). Regenerate your key at https://developer.riotgames.com/ and update the RIOT_API_KEY repository secret."
      );
      process.exit(1);
    }
    console.error(`[${idx + 1}/${players.length}] ${p.riotId} ERR: ${err.message}`);
  }
}

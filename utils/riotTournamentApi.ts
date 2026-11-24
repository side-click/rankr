export interface GenerateTournamentCodeInput {
  matchId: string;
  gameNumber: number;
  seasonId: string;
  roundLabel: string;
  teamAName: string;
  teamBName: string;
  pickType?: "TOURNAMENT_DRAFT" | "BLIND_PICK" | "ALL_RANDOM" | "DRAFT_MODE";
  mapType?: "SUMMONERS_RIFT" | "HOWLING_ABYSS";
  spectatorType?: "ALL" | "LOBBYONLY" | "NONE";
}

export interface GeneratedTournamentCodeResult {
  code: string;
  provider: "placeholder" | "riot_tournament_v5";
  riotTournamentId: string | null;
}

export function isRiotTournamentLiveConfigured(): boolean {
  return Boolean(
    process.env.RIOT_TOURNAMENT_API_KEY?.trim() &&
      process.env.RIOT_TOURNAMENT_PROVIDER_ID?.trim()
  );
}

export function isTournamentStubEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TOURNAMENT_STUB_MODE !== "false";
}

function buildDeterministicStubCode(matchId: string, gameNumber: number): string {
  const short = matchId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `RANKR-STUB-${short}-G${gameNumber}`;
}

export async function generateTournamentCodeForMatch(
  input: GenerateTournamentCodeInput
): Promise<GeneratedTournamentCodeResult> {
  if (isRiotTournamentLiveConfigured()) {
    const apiKey = process.env.RIOT_TOURNAMENT_API_KEY!.trim();
    const providerId = Number(process.env.RIOT_TOURNAMENT_PROVIDER_ID!.trim());
    const regionBase =
      process.env.RIOT_TOURNAMENT_REGION_HOST?.trim() ||
      "https://americas.api.riotgames.com";

    // Create/use a dedicated tournament for this match series
    const tRes = await fetch(`${regionBase}/lol/tournament/v5/tournaments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Riot-Token": apiKey,
      },
      body: JSON.stringify({
        name: `${input.roundLabel}: ${input.teamAName} vs ${input.teamBName}`.slice(
          0,
          120
        ),
        providerId,
      }),
    });

    if (!tRes.ok) {
      const txt = await tRes.text().catch(() => "");
      throw new Error(`Riot Tournament creation failed (${tRes.status}): ${txt}`);
    }

    const tournamentId = String(await tRes.json());
    const cRes = await fetch(
      `${regionBase}/lol/tournament/v5/codes?count=1&tournamentId=${encodeURIComponent(
        tournamentId
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Riot-Token": apiKey,
        },
        body: JSON.stringify({
          mapType: input.mapType ?? "SUMMONERS_RIFT",
          pickType: input.pickType ?? "TOURNAMENT_DRAFT",
          spectatorType: input.spectatorType ?? "ALL",
          teamSize: 5,
          metadata: JSON.stringify({
            matchId: input.matchId,
            gameNumber: input.gameNumber,
            seasonId: input.seasonId,
          }),
          enoughPlayers: true,
        }),
      }
    );

    if (!cRes.ok) {
      const txt = await cRes.text().catch(() => "");
      throw new Error(`Riot Tournament code failed (${cRes.status}): ${txt}`);
    }

    const codes = (await cRes.json()) as string[];
    const liveCode = codes?.[0];
    if (!liveCode) {
      throw new Error("Riot Tournament API returned an empty code list.");
    }

    return {
      code: liveCode,
      provider: "riot_tournament_v5",
      riotTournamentId: tournamentId,
    };
  }

  if (!isTournamentStubEnabled()) {
    throw new Error(
      "Riot Tournament API key is not configured and stub mode is disabled."
    );
  }

  return {
    code: buildDeterministicStubCode(input.matchId, input.gameNumber),
    provider: "placeholder",
    riotTournamentId: null,
  };
}

export interface ConsensusEntryInput {
  rank: number;
  team_id: string | null;
  team_name_snapshot: string | null;
  teams:
    | { id: string; name: string; logo_url: string | null }
    | { id: string; name: string; logo_url: string | null }[]
    | null;
}

export interface ConsensusBallotInput {
  id: string;
  profiles:
    | { username: string; avatar_url: string | null }
    | { username: string; avatar_url: string | null }[]
    | null;
  ballot_entries: ConsensusEntryInput[] | null;
}

export interface VoterRankPoint {
  ballotId: string;
  username: string;
  avatarUrl: string | null;
  rank: number;
}

export interface AverageTeamRow {
  teamKey: string;
  teamName: string;
  logoUrl: string | null;
  consensusRank: number;
  averageRank: number;
  bestRank: number;
  worstRank: number;
  firstPlaceVotes: number;
  ballotCount: number;
  stdDev: number;
  voterRanks: VoterRankPoint[];
  previousRank?: number | null;
  rankChange?: number | null;
}

export function computeAverageTeamRankings(
  ballots: ConsensusBallotInput[]
): AverageTeamRow[] {
  const buckets = new Map<
    string,
    {
      teamKey: string;
      teamName: string;
      logoUrl: string | null;
      ranks: number[];
      voterRanks: VoterRankPoint[];
    }
  >();

  for (const ballot of ballots) {
    const profile = Array.isArray(ballot.profiles)
      ? ballot.profiles[0]
      : ballot.profiles;
    const username = profile?.username ?? "Voter";
    const avatarUrl = profile?.avatar_url ?? null;
    const entries = Array.isArray(ballot.ballot_entries)
      ? ballot.ballot_entries
      : [];

    for (const entry of entries) {
      if (typeof entry.rank !== "number" || !Number.isFinite(entry.rank)) {
        continue;
      }
      const team = Array.isArray(entry.teams) ? entry.teams[0] : entry.teams;
      const teamName = (
        team?.name ??
        entry.team_name_snapshot ??
        "Unknown Team"
      ).trim();
      const teamKey =
        team?.id ?? entry.team_id ?? `name:${teamName.toLowerCase()}`;

      let bucket = buckets.get(teamKey);
      if (!bucket) {
        bucket = {
          teamKey,
          teamName,
          logoUrl: team?.logo_url ?? null,
          ranks: [],
          voterRanks: [],
        };
        buckets.set(teamKey, bucket);
      } else if (!bucket.logoUrl && team?.logo_url) {
        bucket.logoUrl = team.logo_url;
      }

      bucket.ranks.push(entry.rank);
      bucket.voterRanks.push({
        ballotId: ballot.id,
        username,
        avatarUrl,
        rank: entry.rank,
      });
    }
  }

  const rows: Omit<AverageTeamRow, "consensusRank">[] = [];

  for (const bucket of buckets.values()) {
    const count = bucket.ranks.length;
    if (count === 0) continue;

    const sum = bucket.ranks.reduce((acc, r) => acc + r, 0);
    const averageRank = sum / count;
    const bestRank = Math.min(...bucket.ranks);
    const worstRank = Math.max(...bucket.ranks);
    const firstPlaceVotes = bucket.ranks.filter((r) => r === 1).length;
    const variance =
      bucket.ranks.reduce((acc, r) => acc + (r - averageRank) ** 2, 0) / count;
    const stdDev = Math.sqrt(variance);

    bucket.voterRanks.sort(
      (a, b) => a.rank - b.rank || a.username.localeCompare(b.username)
    );

    rows.push({
      teamKey: bucket.teamKey,
      teamName: bucket.teamName,
      logoUrl: bucket.logoUrl,
      averageRank,
      bestRank,
      worstRank,
      firstPlaceVotes,
      ballotCount: count,
      stdDev,
      voterRanks: bucket.voterRanks,
    });
  }

  rows.sort((a, b) => {
    if (Math.abs(a.averageRank - b.averageRank) > 1e-9) {
      return a.averageRank - b.averageRank;
    }
    if (b.firstPlaceVotes !== a.firstPlaceVotes) {
      return b.firstPlaceVotes - a.firstPlaceVotes;
    }
    if (a.bestRank !== b.bestRank) {
      return a.bestRank - b.bestRank;
    }
    if (Math.abs(a.stdDev - b.stdDev) > 1e-9) {
      return a.stdDev - b.stdDev;
    }
    return a.teamName.localeCompare(b.teamName);
  });

  return rows.map((row, index) => ({
    ...row,
    consensusRank: index + 1,
  }));
}

export function attachConsensusChanges(
  currentRows: AverageTeamRow[],
  previousRows: AverageTeamRow[]
): AverageTeamRow[] {
  if (previousRows.length === 0) {
    return currentRows.map((r) => ({
      ...r,
      previousRank: null,
      rankChange: null,
    }));
  }

  const prevByKey = new Map<string, number>();
  const prevByName = new Map<string, number>();
  for (const prev of previousRows) {
    prevByKey.set(prev.teamKey, prev.consensusRank);
    prevByName.set(prev.teamName.trim().toLowerCase(), prev.consensusRank);
  }

  return currentRows.map((row) => {
    const prevRank =
      prevByKey.get(row.teamKey) ??
      prevByName.get(row.teamName.trim().toLowerCase()) ??
      null;
    return {
      ...row,
      previousRank: prevRank,
      rankChange: prevRank !== null ? prevRank - row.consensusRank : null,
    };
  });
}

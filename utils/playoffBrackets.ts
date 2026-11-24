import type {
  DivisionPlayoffBracket,
  PlayoffBracketFormat,
  PlayoffBracketMatchSlot,
  PlayoffBracketSeedSlot,
} from "@/types/database";

export function getSeedCountForFormat(format: PlayoffBracketFormat): number {
  if (format === "6-team") return 6;
  if (format === "8-team") return 8;
  return 4;
}

/**
 * Generates standard single-elimination playoff bracket slots from confirmed seeds.
 */
export function buildStandardPlayoffBracket(
  format: PlayoffBracketFormat,
  seeds: PlayoffBracketSeedSlot[]
): DivisionPlayoffBracket {
  const orderedSeeds = [...seeds]
    .sort((a, b) => a.seed - b.seed)
    .slice(0, getSeedCountForFormat(format));

  const teamIdFor = (seed: number): string | null =>
    orderedSeeds.find((s) => s.seed === seed)?.teamId ?? null;

  let matches: PlayoffBracketMatchSlot[];

  if (format === "6-team") {
    matches = [
      {
        id: "qf-1",
        label: "Quarterfinal 1",
        roundLabel: "Quarterfinals",
        roundOrder: 1,
        teamASeed: 4,
        teamAId: teamIdFor(4),
        teamBSeed: 5,
        teamBId: teamIdFor(5),
      },
      {
        id: "qf-2",
        label: "Quarterfinal 2",
        roundLabel: "Quarterfinals",
        roundOrder: 1,
        teamASeed: 3,
        teamAId: teamIdFor(3),
        teamBSeed: 6,
        teamBId: teamIdFor(6),
      },
      {
        id: "sf-1",
        label: "Semifinal 1",
        roundLabel: "Semifinals",
        roundOrder: 2,
        teamASeed: 1,
        teamAId: teamIdFor(1),
        sourceMatchB: "qf-1",
      },
      {
        id: "sf-2",
        label: "Semifinal 2",
        roundLabel: "Semifinals",
        roundOrder: 2,
        teamASeed: 2,
        teamAId: teamIdFor(2),
        sourceMatchB: "qf-2",
      },
      {
        id: "finals",
        label: "Finals",
        roundLabel: "Finals",
        roundOrder: 3,
        sourceMatchA: "sf-1",
        sourceMatchB: "sf-2",
      },
    ];
  } else if (format === "8-team") {
    matches = [
      {
        id: "qf-1",
        label: "Quarterfinal 1",
        roundLabel: "Quarterfinals",
        roundOrder: 1,
        teamASeed: 1,
        teamAId: teamIdFor(1),
        teamBSeed: 8,
        teamBId: teamIdFor(8),
      },
      {
        id: "qf-2",
        label: "Quarterfinal 2",
        roundLabel: "Quarterfinals",
        roundOrder: 1,
        teamASeed: 4,
        teamAId: teamIdFor(4),
        teamBSeed: 5,
        teamBId: teamIdFor(5),
      },
      {
        id: "qf-3",
        label: "Quarterfinal 3",
        roundLabel: "Quarterfinals",
        roundOrder: 1,
        teamASeed: 2,
        teamAId: teamIdFor(2),
        teamBSeed: 7,
        teamBId: teamIdFor(7),
      },
      {
        id: "qf-4",
        label: "Quarterfinal 4",
        roundLabel: "Quarterfinals",
        roundOrder: 1,
        teamASeed: 3,
        teamAId: teamIdFor(3),
        teamBSeed: 6,
        teamBId: teamIdFor(6),
      },
      {
        id: "sf-1",
        label: "Semifinal 1",
        roundLabel: "Semifinals",
        roundOrder: 2,
        sourceMatchA: "qf-1",
        sourceMatchB: "qf-2",
      },
      {
        id: "sf-2",
        label: "Semifinal 2",
        roundLabel: "Semifinals",
        roundOrder: 2,
        sourceMatchA: "qf-3",
        sourceMatchB: "qf-4",
      },
      {
        id: "finals",
        label: "Finals",
        roundLabel: "Finals",
        roundOrder: 3,
        sourceMatchA: "sf-1",
        sourceMatchB: "sf-2",
      },
    ];
  } else {
    matches = [
      {
        id: "sf-1",
        label: "Semifinal 1",
        roundLabel: "Semifinals",
        roundOrder: 1,
        teamASeed: 1,
        teamAId: teamIdFor(1),
        teamBSeed: 4,
        teamBId: teamIdFor(4),
      },
      {
        id: "sf-2",
        label: "Semifinal 2",
        roundLabel: "Semifinals",
        roundOrder: 1,
        teamASeed: 2,
        teamAId: teamIdFor(2),
        teamBSeed: 3,
        teamBId: teamIdFor(3),
      },
      {
        id: "finals",
        label: "Finals",
        roundLabel: "Finals",
        roundOrder: 2,
        sourceMatchA: "sf-1",
        sourceMatchB: "sf-2",
      },
    ];
  }

  return {
    format,
    seeds: orderedSeeds,
    matches,
    updatedAt: new Date().toISOString(),
  };
}

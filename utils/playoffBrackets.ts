import type {
  DivisionPlayoffBracket,
  PlayoffBracketFormat,
  PlayoffBracketMatchSlot,
  PlayoffBracketSeedSlot,
} from "@/types/database";

export function getSeedCountForFormat(format: PlayoffBracketFormat): number {
  if (format === "6-team") return 6;
  if (format === "8-team" || format === "8-team-double") return 8;
  return 4;
}

/**
 * Generates standard single- or double-elimination playoff bracket slots from confirmed seeds.
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

  if (format === "4-team-double") {
    matches = [
      {
        id: "ub-sf-1",
        label: "Upper Semifinal 1",
        roundLabel: "Upper Semifinals",
        roundOrder: 1,
        bracketSide: "upper",
        teamASeed: 1,
        teamAId: teamIdFor(1),
        teamBSeed: 4,
        teamBId: teamIdFor(4),
      },
      {
        id: "ub-sf-2",
        label: "Upper Semifinal 2",
        roundLabel: "Upper Semifinals",
        roundOrder: 1,
        bracketSide: "upper",
        teamASeed: 2,
        teamAId: teamIdFor(2),
        teamBSeed: 3,
        teamBId: teamIdFor(3),
      },
      {
        id: "ub-f",
        label: "Upper Finals",
        roundLabel: "Upper Finals",
        roundOrder: 2,
        bracketSide: "upper",
        sourceMatchA: "ub-sf-1",
        sourceMatchB: "ub-sf-2",
      },
      {
        id: "lb-r1",
        label: "Lower Round 1",
        roundLabel: "Lower Round 1",
        roundOrder: 1,
        bracketSide: "lower",
        loserSourceMatchA: "ub-sf-1",
        loserSourceMatchB: "ub-sf-2",
      },
      {
        id: "lb-f",
        label: "Lower Finals",
        roundLabel: "Lower Finals",
        roundOrder: 2,
        bracketSide: "lower",
        loserSourceMatchA: "ub-f",
        sourceMatchB: "lb-r1",
      },
      {
        id: "gf",
        label: "Grand Finals",
        roundLabel: "Grand Finals",
        roundOrder: 3,
        bracketSide: "grand_finals",
        sourceMatchA: "ub-f",
        sourceMatchB: "lb-f",
      },
    ];
  } else if (format === "8-team-double") {
    matches = [
      {
        id: "ub-qf-1",
        label: "Upper QF 1",
        roundLabel: "Upper Quarterfinals",
        roundOrder: 1,
        bracketSide: "upper",
        teamASeed: 1,
        teamAId: teamIdFor(1),
        teamBSeed: 8,
        teamBId: teamIdFor(8),
      },
      {
        id: "ub-qf-2",
        label: "Upper QF 2",
        roundLabel: "Upper Quarterfinals",
        roundOrder: 1,
        bracketSide: "upper",
        teamASeed: 4,
        teamAId: teamIdFor(4),
        teamBSeed: 5,
        teamBId: teamIdFor(5),
      },
      {
        id: "ub-qf-3",
        label: "Upper QF 3",
        roundLabel: "Upper Quarterfinals",
        roundOrder: 1,
        bracketSide: "upper",
        teamASeed: 2,
        teamAId: teamIdFor(2),
        teamBSeed: 7,
        teamBId: teamIdFor(7),
      },
      {
        id: "ub-qf-4",
        label: "Upper QF 4",
        roundLabel: "Upper Quarterfinals",
        roundOrder: 1,
        bracketSide: "upper",
        teamASeed: 3,
        teamAId: teamIdFor(3),
        teamBSeed: 6,
        teamBId: teamIdFor(6),
      },
      {
        id: "ub-sf-1",
        label: "Upper Semifinal 1",
        roundLabel: "Upper Semifinals",
        roundOrder: 2,
        bracketSide: "upper",
        sourceMatchA: "ub-qf-1",
        sourceMatchB: "ub-qf-2",
      },
      {
        id: "ub-sf-2",
        label: "Upper Semifinal 2",
        roundLabel: "Upper Semifinals",
        roundOrder: 2,
        bracketSide: "upper",
        sourceMatchA: "ub-qf-3",
        sourceMatchB: "ub-qf-4",
      },
      {
        id: "ub-f",
        label: "Upper Finals",
        roundLabel: "Upper Finals",
        roundOrder: 3,
        bracketSide: "upper",
        sourceMatchA: "ub-sf-1",
        sourceMatchB: "ub-sf-2",
      },
      {
        id: "lb-r1-1",
        label: "Lower R1 Match 1",
        roundLabel: "Lower Round 1",
        roundOrder: 1,
        bracketSide: "lower",
        loserSourceMatchA: "ub-qf-1",
        loserSourceMatchB: "ub-qf-2",
      },
      {
        id: "lb-r1-2",
        label: "Lower R1 Match 2",
        roundLabel: "Lower Round 1",
        roundOrder: 1,
        bracketSide: "lower",
        loserSourceMatchA: "ub-qf-3",
        loserSourceMatchB: "ub-qf-4",
      },
      {
        id: "lb-r2-1",
        label: "Lower R2 Match 1",
        roundLabel: "Lower Round 2",
        roundOrder: 2,
        bracketSide: "lower",
        loserSourceMatchA: "ub-sf-2",
        sourceMatchB: "lb-r1-1",
      },
      {
        id: "lb-r2-2",
        label: "Lower R2 Match 2",
        roundLabel: "Lower Round 2",
        roundOrder: 2,
        bracketSide: "lower",
        loserSourceMatchA: "ub-sf-1",
        sourceMatchB: "lb-r1-2",
      },
      {
        id: "lb-sf",
        label: "Lower Semifinal",
        roundLabel: "Lower Semifinal",
        roundOrder: 3,
        bracketSide: "lower",
        sourceMatchA: "lb-r2-1",
        sourceMatchB: "lb-r2-2",
      },
      {
        id: "lb-f",
        label: "Lower Finals",
        roundLabel: "Lower Finals",
        roundOrder: 4,
        bracketSide: "lower",
        loserSourceMatchA: "ub-f",
        sourceMatchB: "lb-sf",
      },
      {
        id: "gf",
        label: "Grand Finals",
        roundLabel: "Grand Finals",
        roundOrder: 4,
        bracketSide: "grand_finals",
        sourceMatchA: "ub-f",
        sourceMatchB: "lb-f",
      },
    ];
  } else if (format === "6-team") {
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

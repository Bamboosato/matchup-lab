import { describe, expect, it } from "vitest";
import type { MatchConditions } from "../model/types";
import { generateMatchup } from "./generateMatchup";

function conditions(participantCount: number, courtCount: number, roundCount: number): MatchConditions {
  return {
    eventName: "test",
    matchFormat: "doubles",
    matchupMode: "standard",
    participants: Array.from({ length: participantCount }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      index,
    })),
    courtCount,
    roundCount,
    playersPerCourt: 4,
  };
}

function singlesConditions(
  participantCount: number,
  courtCount: number,
  roundCount: number,
): MatchConditions {
  return {
    eventName: "singles-test",
    matchFormat: "singles",
    matchupMode: "standard",
    participants: Array.from({ length: participantCount }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      index,
    })),
    courtCount,
    roundCount,
    playersPerCourt: 2,
  };
}

function genderConditions(
  matchupMode: MatchConditions["matchupMode"],
  genders: Array<"female" | "male">,
  courtCount: number,
  roundCount: number,
): MatchConditions {
  return {
    eventName: "gender-test",
    matchFormat: "doubles",
    matchupMode,
    participants: genders.map((gender, index) => ({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      gender,
      index,
    })),
    courtCount,
    roundCount,
    playersPerCourt: 4,
  };
}

function courtGenders(
  result: ReturnType<typeof generateMatchup>,
  roundIndex: number,
  courtIndex: number,
) {
  const genderById = new Map(
    result.conditions.participants.map((participant) => [participant.id, participant.gender]),
  );
  const court = result.rounds[roundIndex]!.courts[courtIndex]!;

  if (court.isUnused || !court.pairA || !court.pairB) {
    return [];
  }

  return [
    court.pairA.player1Id,
    court.pairA.player2Id,
    court.pairB.player1Id,
    court.pairB.player2Id,
  ].map((playerId) => genderById.get(playerId));
}

describe("generateMatchup", () => {
  it("keeps rest counts fair and avoids consecutive rest for 5 players over 5 rounds", () => {
    const result = generateMatchup(conditions(5, 1, 5), 20260420);

    expect(result.rounds).toHaveLength(5);

    for (const round of result.rounds) {
      expect(round.activePlayerIds).toHaveLength(4);
      expect(round.restPlayerIds).toHaveLength(1);
    }

    const restCounts = result.stats.map((stat) => stat.rests);
    expect(Math.max(...restCounts) - Math.min(...restCounts)).toBeLessThanOrEqual(1);

    for (const stat of result.stats) {
      expect(stat.consecutiveRestCount).toBe(0);
    }
  });

  it("fills unused courts when participant count cannot use every requested court", () => {
    const result = generateMatchup(conditions(7, 2, 2), 777);

    for (const round of result.rounds) {
      expect(round.activePlayerIds).toHaveLength(4);
      expect(round.restPlayerIds).toHaveLength(3);
      expect(round.courts).toHaveLength(2);
      expect(round.courts.filter((court) => court.isUnused)).toHaveLength(1);
    }
  });

  it("keeps 4-player rounds fully active with no rests", () => {
    const result = generateMatchup(conditions(4, 1, 3), 99);

    for (const round of result.rounds) {
      expect(round.restPlayerIds).toHaveLength(0);
      expect(round.activePlayerIds).toHaveLength(4);
      expect(round.courts[0]?.isUnused).toBe(false);
    }

    for (const stat of result.stats) {
      expect(stat.rests).toBe(0);
      expect(stat.appearances).toBe(3);
    }
  });

  it("builds singles matches with two players per court", () => {
    const result = generateMatchup(singlesConditions(5, 2, 4), 20260528);

    for (const round of result.rounds) {
      expect(round.activePlayerIds).toHaveLength(4);
      expect(round.restPlayerIds).toHaveLength(1);
      expect(round.courts.filter((court) => !court.isUnused)).toHaveLength(2);

      for (const court of round.courts.filter((entry) => !entry.isUnused)) {
        expect(court.singlesMatch).toBeDefined();
        expect(court.pairA).toBeNull();
        expect(court.pairB).toBeNull();
      }
    }

    const restCounts = result.stats.map((stat) => stat.rests);
    expect(Math.max(...restCounts) - Math.min(...restCounts)).toBeLessThanOrEqual(1);
  });

  it("spreads a single active match across the requested courts over time", () => {
    const result = generateMatchup(conditions(7, 2, 6), 20260424);
    const usageByCourt = result.rounds.reduce<Record<number, number>>((counts, round) => {
      const activeCourt = round.courts.find((court) => !court.isUnused);

      if (!activeCourt) {
        return counts;
      }

      counts[activeCourt.courtNumber] = (counts[activeCourt.courtNumber] ?? 0) + 1;
      return counts;
    }, {});
    const usageCounts = [usageByCourt[1] ?? 0, usageByCourt[2] ?? 0];

    expect(Math.max(...usageCounts) - Math.min(...usageCounts)).toBeLessThanOrEqual(1);
  });

  it("uses young court numbers when compact assignment mode is requested", () => {
    const result = generateMatchup(conditions(7, 2, 3), 20260518, {
      courtAssignmentMode: "compact",
    });

    for (const round of result.rounds) {
      expect(round.courts).toHaveLength(2);
      expect(round.courts[0]?.courtNumber).toBe(1);
      expect(round.courts[0]?.isUnused).toBe(false);
      expect(round.courts[1]?.courtNumber).toBe(2);
      expect(round.courts[1]?.isUnused).toBe(true);
    }
  });

  it("prioritizes all-same-gender courts in same-gender mode", () => {
    const result = generateMatchup(
      genderConditions(
        "sameGenderPriority",
        ["female", "female", "female", "female", "male", "male", "male", "male"],
        2,
        1,
      ),
      20260501,
    );

    const firstCourtGenders = new Set(courtGenders(result, 0, 0));
    const secondCourtGenders = new Set(courtGenders(result, 0, 1));

    expect(firstCourtGenders.size).toBe(1);
    expect(secondCourtGenders.size).toBe(1);
    expect(result.score.genderPreferencePenalty).toBe(0);
  });

  it("uses mixed pairs as a fallback for 2F2M courts in same-gender mode", () => {
    const result = generateMatchup(
      genderConditions("sameGenderPriority", ["female", "female", "male", "male"], 1, 1),
      20260501,
    );
    const court = result.rounds[0]!.courts[0]!;
    const genderById = new Map(
      result.conditions.participants.map((participant) => [participant.id, participant.gender]),
    );

    expect(court.pairA).not.toBeNull();
    expect(court.pairB).not.toBeNull();
    expect(genderById.get(court.pairA!.player1Id)).not.toBe(
      genderById.get(court.pairA!.player2Id),
    );
    expect(genderById.get(court.pairB!.player1Id)).not.toBe(
      genderById.get(court.pairB!.player2Id),
    );
  });

  it("prioritizes mixed doubles pairs in mixed mode", () => {
    const result = generateMatchup(
      genderConditions("mixedDoublesPriority", ["female", "female", "male", "male"], 1, 1),
      20260501,
    );
    const court = result.rounds[0]!.courts[0]!;
    const genderById = new Map(
      result.conditions.participants.map((participant) => [participant.id, participant.gender]),
    );

    expect(court.pairA).not.toBeNull();
    expect(court.pairB).not.toBeNull();
    expect(genderById.get(court.pairA!.player1Id)).not.toBe(
      genderById.get(court.pairA!.player2Id),
    );
    expect(genderById.get(court.pairB!.player1Id)).not.toBe(
      genderById.get(court.pairB!.player2Id),
    );
    expect(result.score.genderPreferencePenalty).toBe(0);
  });
});

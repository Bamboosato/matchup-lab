import { describe, expect, it } from "vitest";
import { generateMatchup } from "../domain/generateMatchup";
import { buildMatchConditions } from "./buildMatchConditions";
import {
  buildCandidateSeeds,
  generateMatchupUseCase,
} from "./generateMatchupUseCase";

const input = {
  eventName: "seed-search",
  participantCount: 8,
  courtCount: 2,
  roundCount: 4,
  participants: Array.from({ length: 8 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  })),
};

describe("generateMatchupUseCase", () => {
  it("tries multiple candidate seeds and returns the lowest-score result", () => {
    const result = generateMatchupUseCase(input, 1000);
    const conditions = buildMatchConditions(input);
    const candidateResults = buildCandidateSeeds(1000).map((seed) =>
      generateMatchup(conditions, seed),
    );
    const minimumScore = Math.min(
      ...candidateResults.map((candidate) => candidate.score.totalScore),
    );

    expect(candidateResults).toHaveLength(24);
    expect(result.score.totalScore).toBe(minimumScore);
    expect(buildCandidateSeeds(1000)).toContain(result.seed);
  });

  it("is reproducible for the same base seed", () => {
    const left = generateMatchupUseCase(input, 4321);
    const right = generateMatchupUseCase(input, 4321);

    expect(right.seed).toBe(left.seed);
    expect(right.score).toEqual(left.score);
    expect(right.rounds).toEqual(left.rounds);
  });

  it("does not use gender for standard mode scoring or pairing", () => {
    const withoutGender = generateMatchupUseCase(input, 2468);
    const withGender = generateMatchupUseCase(
      {
        ...input,
        matchupMode: "standard",
        participants: input.participants.map((participant, index) => ({
          ...participant,
          gender: index % 2 === 0 ? "female" : "male",
        })),
      },
      2468,
    );

    expect(withGender.conditions.participants.map((participant) => participant.gender)).toEqual([
      "female",
      "male",
      "female",
      "male",
      "female",
      "male",
      "female",
      "male",
    ]);
    expect(withGender.seed).toBe(withoutGender.seed);
    expect(withGender.score).toEqual(withoutGender.score);
    expect(withGender.rounds).toEqual(withoutGender.rounds);
    expect(withGender.stats).toEqual(withoutGender.stats);
  });
});

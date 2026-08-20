import { buildMatchConditions } from "./buildMatchConditions";
import { generateMatchup } from "../domain/generateMatchup";
import type { MatchConditionInput, MatchupResult } from "../model/types";
import {
  MATCHUP_CANDIDATE_ATTEMPTS,
  MATCHUP_SEED_STEP,
} from "@/lib/constants/generation";

export function buildCandidateSeeds(
  baseSeed: number,
  attempts = MATCHUP_CANDIDATE_ATTEMPTS,
): number[] {
  return Array.from({ length: attempts }, (_, index) => baseSeed + index * MATCHUP_SEED_STEP);
}

export function compareMatchupResults(left: MatchupResult, right: MatchupResult): number {
  if (left.score.totalScore !== right.score.totalScore) {
    return left.score.totalScore - right.score.totalScore;
  }

  if (left.score.genderPreferencePenalty !== right.score.genderPreferencePenalty) {
    return left.score.genderPreferencePenalty - right.score.genderPreferencePenalty;
  }

  if (left.score.encounterPenalty !== right.score.encounterPenalty) {
    return left.score.encounterPenalty - right.score.encounterPenalty;
  }

  if (left.score.sameTeammatePenalty !== right.score.sameTeammatePenalty) {
    return left.score.sameTeammatePenalty - right.score.sameTeammatePenalty;
  }

  if (left.score.sameOpponentPenalty !== right.score.sameOpponentPenalty) {
    return left.score.sameOpponentPenalty - right.score.sameOpponentPenalty;
  }

  return left.seed - right.seed;
}

export function generateMatchupUseCase(
  input: MatchConditionInput,
  seed: number,
): MatchupResult {
  const conditions = buildMatchConditions(input);
  const candidateSeeds = buildCandidateSeeds(seed);
  const results = candidateSeeds.map((candidateSeed) =>
    generateMatchup(conditions, candidateSeed),
  );

  results.sort(compareMatchupResults);

  return results[0];
}

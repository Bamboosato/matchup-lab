import { SCORE_WEIGHTS } from "@/lib/constants/scoring";
import { ensureMatrixValue } from "../utils/matrix";
import type {
  CourtAssignment,
  GenerationContext,
  ParticipantGender,
  PlayerStats,
  ResultScore,
  RoundResult,
} from "../model/types";

function duplicatedPairPenalty(
  matrix: GenerationContext["encounterMatrix"],
  playerIds: string[],
): number {
  let penalty = 0;

  for (let i = 0; i < playerIds.length; i += 1) {
    for (let j = i + 1; j < playerIds.length; j += 1) {
      penalty += Math.max(0, ensureMatrixValue(matrix, playerIds[i], playerIds[j]) - 1);
    }
  }

  return penalty;
}

function buildGenderMap(ctx: GenerationContext): Map<string, ParticipantGender | undefined> {
  return new Map(
    ctx.conditions.participants.map((participant) => [participant.id, participant.gender]),
  );
}

function courtPlayerIds(court: CourtAssignment): string[] {
  if (!court.isUnused && court.singlesMatch) {
    return [court.singlesMatch.player1Id, court.singlesMatch.player2Id];
  }

  if (court.isUnused || !court.pairA || !court.pairB) {
    return [];
  }

  return [
    court.pairA.player1Id,
    court.pairA.player2Id,
    court.pairB.player1Id,
    court.pairB.player2Id,
  ];
}

function countGenders(
  playerIds: string[],
  genderByPlayerId: Map<string, ParticipantGender | undefined>,
) {
  return playerIds.reduce(
    (counts, playerId) => {
      const gender = genderByPlayerId.get(playerId);

      if (gender === "female") {
        counts.female += 1;
      } else if (gender === "male") {
        counts.male += 1;
      } else {
        counts.unknown += 1;
      }

      return counts;
    },
    { female: 0, male: 0, unknown: 0 },
  );
}

function pairMixedPenalty(
  player1Id: string,
  player2Id: string,
  genderByPlayerId: Map<string, ParticipantGender | undefined>,
): number {
  const left = genderByPlayerId.get(player1Id);
  const right = genderByPlayerId.get(player2Id);

  if (!left || !right) {
    return 1;
  }

  return left === right ? 1 : 0;
}

function courtGenderPreferenceMismatch(
  court: CourtAssignment,
  genderByPlayerId: Map<string, ParticipantGender | undefined>,
  ctx: GenerationContext,
): number {
  if (ctx.conditions.matchFormat === "singles") {
    return 0;
  }

  if (court.isUnused || !court.pairA || !court.pairB) {
    return 0;
  }

  const playerIds = courtPlayerIds(court);
  const counts = countGenders(playerIds, genderByPlayerId);

  if (counts.unknown > 0) {
    return counts.unknown;
  }

  if (ctx.conditions.matchupMode === "sameGenderPriority") {
    return counts.female === 4 || counts.male === 4 ? 0 : 1;
  }

  if (ctx.conditions.matchupMode === "mixedDoublesPriority") {
    const groupPenalty = Math.abs(counts.female - 2) + Math.abs(counts.male - 2);
    const pairPenalty =
      pairMixedPenalty(court.pairA.player1Id, court.pairA.player2Id, genderByPlayerId) +
      pairMixedPenalty(court.pairB.player1Id, court.pairB.player2Id, genderByPlayerId);

    return groupPenalty + pairPenalty * 2;
  }

  return 0;
}

function genderPreferencePenalty(ctx: GenerationContext, rounds: RoundResult[]): number {
  if (ctx.conditions.matchupMode === "standard") {
    return 0;
  }

  const genderByPlayerId = buildGenderMap(ctx);

  return rounds.reduce((penalty, round, roundIndex) => {
    const roundWeight = ctx.conditions.roundCount - roundIndex;
    const roundPenalty = round.courts.reduce((sum, court) => {
      return sum + courtGenderPreferenceMismatch(court, genderByPlayerId, ctx);
    }, 0);

    return penalty + roundPenalty * roundWeight;
  }, 0);
}

export function buildPlayerStats(ctx: GenerationContext): PlayerStats[] {
  return ctx.conditions.participants.map((participant) => {
    const rests = ctx.restCounts[participant.id] ?? 0;
    const appearances = ctx.appearanceCounts[participant.id] ?? 0;
    const uniqueEncounterCount = Object.values(ctx.encounterMatrix[participant.id] ?? {}).filter(
      (count) => count > 0,
    ).length;

    let consecutiveRestCount = 0;
    let previousRest = false;

    for (const restPlayerIds of ctx.restHistoryByRound) {
      const currentRest = restPlayerIds.includes(participant.id);

      if (previousRest && currentRest) {
        consecutiveRestCount += 1;
      }

      previousRest = currentRest;
    }

    return {
      playerId: participant.id,
      appearances,
      rests,
      uniqueEncounterCount,
      consecutiveRestCount,
    };
  });
}

export function calculateScore(
  ctx: GenerationContext,
  stats: PlayerStats[],
  rounds: RoundResult[],
): ResultScore {
  const eligibleParticipantIdSet = new Set(ctx.eligibleParticipantIds);
  const scoredStats = stats.filter((stat) => eligibleParticipantIdSet.has(stat.playerId));
  const restCounts = scoredStats.map((stat) => stat.rests);
  const fairnessPenalty = restCounts.length > 0
    ? Math.max(...restCounts) - Math.min(...restCounts)
    : 0;
  const consecutiveRestPenalty = scoredStats.reduce(
    (sum, stat) => sum + stat.consecutiveRestCount,
    0,
  );
  const genderPenalty = genderPreferencePenalty(ctx, rounds);
  const playerIds = ctx.eligibleParticipantIds;
  const encounterPenalty = duplicatedPairPenalty(ctx.encounterMatrix, playerIds);
  const sameTeammatePenalty = duplicatedPairPenalty(ctx.teammateMatrix, playerIds);
  const sameOpponentPenalty = duplicatedPairPenalty(ctx.opponentMatrix, playerIds);
  const totalScore =
    fairnessPenalty * SCORE_WEIGHTS.fairness +
    consecutiveRestPenalty * SCORE_WEIGHTS.consecutiveRest +
    genderPenalty * SCORE_WEIGHTS.genderPreference +
    encounterPenalty * SCORE_WEIGHTS.encounter +
    sameTeammatePenalty * SCORE_WEIGHTS.teammate +
    sameOpponentPenalty * SCORE_WEIGHTS.opponent;

  return {
    fairnessPenalty,
    consecutiveRestPenalty,
    genderPreferencePenalty: genderPenalty,
    encounterPenalty,
    sameTeammatePenalty,
    sameOpponentPenalty,
    totalScore,
  };
}

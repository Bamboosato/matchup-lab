import { ensureMatrixValue } from "../utils/matrix";
import type { GenerationContext, Pair, ParticipantGender } from "../model/types";

type PairingCandidate = {
  pairA: Pair;
  pairB: Pair;
  score: number;
};

function teammatePenalty(ctx: GenerationContext, pair: Pair): number {
  return ensureMatrixValue(ctx.teammateMatrix, pair.player1Id, pair.player2Id);
}

function opponentPenalty(ctx: GenerationContext, pairA: Pair, pairB: Pair): number {
  return (
    ensureMatrixValue(ctx.opponentMatrix, pairA.player1Id, pairB.player1Id) +
    ensureMatrixValue(ctx.opponentMatrix, pairA.player1Id, pairB.player2Id) +
    ensureMatrixValue(ctx.opponentMatrix, pairA.player2Id, pairB.player1Id) +
    ensureMatrixValue(ctx.opponentMatrix, pairA.player2Id, pairB.player2Id)
  );
}

function genderOf(playerId: string, ctx: GenerationContext): ParticipantGender | undefined {
  return ctx.conditions.participants.find((participant) => participant.id === playerId)?.gender;
}

function countGenders(playerIds: string[], ctx: GenerationContext) {
  return playerIds.reduce(
    (counts, playerId) => {
      const gender = genderOf(playerId, ctx);

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

function shouldPrioritizeMixedPairs(playerIds: string[], ctx: GenerationContext): boolean {
  if (ctx.conditions.matchupMode === "mixedDoublesPriority") {
    return true;
  }

  if (ctx.conditions.matchupMode !== "sameGenderPriority") {
    return false;
  }

  const counts = countGenders(playerIds, ctx);

  return counts.female === 2 && counts.male === 2 && counts.unknown === 0;
}

function nonMixedPairPenalty(ctx: GenerationContext, pair: Pair): number {
  const left = genderOf(pair.player1Id, ctx);
  const right = genderOf(pair.player2Id, ctx);

  if (!left || !right) {
    return 1;
  }

  return left === right ? 1 : 0;
}

function currentRoundWeight(ctx: GenerationContext): number {
  return Math.max(1, ctx.conditions.roundCount - ctx.activeHistoryByRound.length);
}

export function pickBestPairing(
  playerIds: string[],
  ctx: GenerationContext,
): [Pair, Pair] {
  const [a, b, c, d] = playerIds;
  const candidates: PairingCandidate[] = [
    {
      pairA: { player1Id: a, player2Id: b },
      pairB: { player1Id: c, player2Id: d },
      score: 0,
    },
    {
      pairA: { player1Id: a, player2Id: c },
      pairB: { player1Id: b, player2Id: d },
      score: 0,
    },
    {
      pairA: { player1Id: a, player2Id: d },
      pairB: { player1Id: b, player2Id: c },
      score: 0,
    },
  ];

  for (const candidate of candidates) {
    const mixedPairPenalty = shouldPrioritizeMixedPairs(playerIds, ctx)
      ? nonMixedPairPenalty(ctx, candidate.pairA) + nonMixedPairPenalty(ctx, candidate.pairB)
      : 0;

    candidate.score =
      teammatePenalty(ctx, candidate.pairA) * 10 +
      teammatePenalty(ctx, candidate.pairB) * 10 +
      opponentPenalty(ctx, candidate.pairA, candidate.pairB) * 5 +
      mixedPairPenalty * currentRoundWeight(ctx) * 8;
  }

  candidates.sort((left, right) => left.score - right.score);

  return [candidates[0].pairA, candidates[0].pairB];
}

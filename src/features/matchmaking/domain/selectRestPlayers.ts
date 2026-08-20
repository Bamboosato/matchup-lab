import type { GenerationContext } from "../model/types";
import { seededValue } from "../utils/seededRandom";

type RestCandidate = {
  playerId: string;
  wasRestLastRound: boolean;
  restCount: number;
  appearanceCount: number;
  tieBreaker: number;
};

export function getRestPlayerCountPerRound(ctx: GenerationContext): number {
  const playerCount = ctx.eligibleParticipantIds.length;
  const usableCourtCount = Math.min(
    ctx.conditions.courtCount,
    Math.floor(playerCount / ctx.conditions.playersPerCourt),
  );

  return playerCount - usableCourtCount * ctx.conditions.playersPerCourt;
}

function compareRestPriority(left: RestCandidate, right: RestCandidate): number {
  if (left.wasRestLastRound !== right.wasRestLastRound) {
    return Number(left.wasRestLastRound) - Number(right.wasRestLastRound);
  }

  if (left.restCount !== right.restCount) {
    return left.restCount - right.restCount;
  }

  if (left.appearanceCount !== right.appearanceCount) {
    return right.appearanceCount - left.appearanceCount;
  }

  return left.tieBreaker - right.tieBreaker;
}

export function selectRestPlayers(
  ctx: GenerationContext,
  roundIndex: number,
): string[] {
  const restPlayerCount = getRestPlayerCountPerRound(ctx);

  if (restPlayerCount <= 0) {
    return [];
  }

  const lastRestSet = new Set(ctx.restHistoryByRound[roundIndex - 1] ?? []);

  return ctx.eligibleParticipantIds
    .map<RestCandidate>((player) => ({
      playerId: player,
      wasRestLastRound: lastRestSet.has(player),
      restCount: ctx.restCounts[player] ?? 0,
      appearanceCount: ctx.appearanceCounts[player] ?? 0,
      tieBreaker: seededValue(ctx.seed, roundIndex, player),
    }))
    .sort(compareRestPriority)
    .slice(0, restPlayerCount)
    .map((candidate) => candidate.playerId);
}

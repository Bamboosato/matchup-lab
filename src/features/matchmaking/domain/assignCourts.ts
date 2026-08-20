import type {
  CourtAssignment,
  GenerationContext,
  ParticipantGender,
  SinglesMatch,
} from "../model/types";
import { pickBestPairing } from "./pickBestPairing";
import { ensureMatrixValue } from "../utils/matrix";
import { seededValue } from "../utils/seededRandom";

type ActiveCourtAssignment = Omit<CourtAssignment, "courtNumber" | "isUnused">;
type BestCourtAssignment = {
  courtNumbers: number[];
  exposurePenalty: number;
  usagePenalty: number;
};

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
      }

      return counts;
    },
    { female: 0, male: 0 },
  );
}

function groupGenderPenalty(playerIds: string[], ctx: GenerationContext): number {
  if (ctx.conditions.matchFormat === "singles") {
    return 0;
  }

  if (ctx.conditions.matchupMode === "standard") {
    return 0;
  }

  const counts = countGenders(playerIds, ctx);

  if (ctx.conditions.matchupMode === "sameGenderPriority") {
    return Math.min(counts.female, counts.male);
  }

  return Math.abs(counts.female - counts.male);
}

function currentRoundWeight(ctx: GenerationContext): number {
  return Math.max(1, ctx.conditions.roundCount - ctx.activeHistoryByRound.length);
}

function encounterLoad(playerId: string, activePlayerIds: string[], ctx: GenerationContext): number {
  return activePlayerIds.reduce((sum, current) => {
    if (current === playerId) {
      return sum;
    }

    return sum + ensureMatrixValue(ctx.encounterMatrix, playerId, current);
  }, 0);
}

function pickBasePlayer(remaining: string[], ctx: GenerationContext): string {
  return [...remaining].sort((left, right) => {
    const loadDiff = encounterLoad(right, remaining, ctx) - encounterLoad(left, remaining, ctx);

    if (loadDiff !== 0) {
      return loadDiff;
    }

    return seededValue(ctx.seed, "base", left) - seededValue(ctx.seed, "base", right);
  })[0];
}

function scoreCandidateForGroup(
  candidateId: string,
  currentGroup: string[],
  ctx: GenerationContext,
): number {
  const nextGroup = [...currentGroup, candidateId];
  const genderPenalty = groupGenderPenalty(nextGroup, ctx) * currentRoundWeight(ctx) * 4;

  return currentGroup.reduce((score, currentPlayerId) => {
    const encounterPenalty =
      ensureMatrixValue(ctx.encounterMatrix, candidateId, currentPlayerId) * 12;
    const teammatePenalty =
      ensureMatrixValue(ctx.teammateMatrix, candidateId, currentPlayerId) * 5;
    const opponentPenalty =
      ensureMatrixValue(ctx.opponentMatrix, candidateId, currentPlayerId) * 3;

    return score + encounterPenalty + teammatePenalty + opponentPenalty;
  }, genderPenalty);
}

function pickBestCourtGroup(
  basePlayerId: string,
  remaining: string[],
  ctx: GenerationContext,
): string[] {
  const group = [basePlayerId];
  const candidates = remaining.filter((playerId) => playerId !== basePlayerId);

  while (group.length < 4) {
    candidates.sort((left, right) => {
      const scoreDiff =
        scoreCandidateForGroup(left, group, ctx) -
        scoreCandidateForGroup(right, group, ctx);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (
        seededValue(ctx.seed, "court", left, group.join(",")) -
        seededValue(ctx.seed, "court", right, group.join(","))
      );
    });

    group.push(candidates.shift()!);
  }

  return group;
}

function singlesOpponentScore(
  basePlayerId: string,
  candidateId: string,
  ctx: GenerationContext,
): number {
  const encounterPenalty =
    ensureMatrixValue(ctx.encounterMatrix, basePlayerId, candidateId) * 12;
  const opponentPenalty =
    ensureMatrixValue(ctx.opponentMatrix, basePlayerId, candidateId) * 5;

  return encounterPenalty + opponentPenalty;
}

function pickBestSinglesMatch(
  basePlayerId: string,
  remaining: string[],
  ctx: GenerationContext,
): SinglesMatch {
  const opponentId = remaining
    .filter((playerId) => playerId !== basePlayerId)
    .sort((left, right) => {
      const scoreDiff =
        singlesOpponentScore(basePlayerId, left, ctx) -
        singlesOpponentScore(basePlayerId, right, ctx);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (
        seededValue(ctx.seed, "singles", basePlayerId, left) -
        seededValue(ctx.seed, "singles", basePlayerId, right)
      );
    })[0]!;

  return {
    player1Id: basePlayerId,
    player2Id: opponentId,
  };
}

function courtPlayerIds(court: ActiveCourtAssignment): string[] {
  if (court.singlesMatch) {
    return [court.singlesMatch.player1Id, court.singlesMatch.player2Id];
  }

  if (!court.pairA || !court.pairB) {
    return [];
  }

  return [
    court.pairA.player1Id,
    court.pairA.player2Id,
    court.pairB.player1Id,
    court.pairB.player2Id,
  ];
}

function courtExposurePenalty(
  playerIds: string[],
  courtNumber: number,
  ctx: GenerationContext,
): number {
  return playerIds.reduce((sum, playerId) => {
    return sum + (ctx.courtAppearanceCounts[playerId]?.[courtNumber] ?? 0);
  }, 0);
}

function buildCourtNumbers(courtCount: number): number[] {
  return Array.from({ length: courtCount }, (_, index) => index + 1);
}

function rebalanceCourtNumbers(
  activeCourts: ActiveCourtAssignment[],
  ctx: GenerationContext,
): CourtAssignment[] {
  const allCourtNumbers = buildCourtNumbers(ctx.conditions.courtCount);

  if (activeCourts.length === 0) {
    return allCourtNumbers.map((courtNumber) => ({
      courtNumber,
      pairA: null,
      pairB: null,
      singlesMatch: null,
      isUnused: true,
    }));
  }

  const roundIndex = ctx.activeHistoryByRound.length + 1;
  const serializedCourts = activeCourts.map((court) => courtPlayerIds(court).join(","));
  let bestAssignment: BestCourtAssignment | undefined;

  function visit(
    courtIndex: number,
    remainingCourtNumbers: number[],
    assignedCourtNumbers: number[],
    exposurePenalty: number,
    usagePenalty: number,
  ): void {
    if (courtIndex >= activeCourts.length) {
      if (
        !bestAssignment ||
        exposurePenalty < bestAssignment.exposurePenalty ||
        (exposurePenalty === bestAssignment.exposurePenalty &&
          usagePenalty < bestAssignment.usagePenalty)
      ) {
        bestAssignment = {
          courtNumbers: [...assignedCourtNumbers],
          exposurePenalty,
          usagePenalty,
        };
      }

      return;
    }

    const playerIds = courtPlayerIds(activeCourts[courtIndex]);
    const orderedCourtNumbers = [...remainingCourtNumbers].sort((left, right) => {
      return (
        seededValue(ctx.seed, "court-balance", roundIndex, courtIndex, left, serializedCourts[courtIndex]) -
        seededValue(ctx.seed, "court-balance", roundIndex, courtIndex, right, serializedCourts[courtIndex])
      );
    });

    for (const courtNumber of orderedCourtNumbers) {
      const nextRemainingCourtNumbers = remainingCourtNumbers.filter(
        (candidate) => candidate !== courtNumber,
      );

      visit(
        courtIndex + 1,
        nextRemainingCourtNumbers,
        [...assignedCourtNumbers, courtNumber],
        exposurePenalty + courtExposurePenalty(playerIds, courtNumber, ctx),
        usagePenalty + (ctx.courtUsageCounts[courtNumber] ?? 0),
      );
    }
  }

  visit(0, allCourtNumbers, [], 0, 0);

  const assignedCourtNumbers = bestAssignment
    ? bestAssignment.courtNumbers
    : allCourtNumbers.slice(0, activeCourts.length);
  const activeAssignments = activeCourts.map((court, index) => ({
    courtNumber: assignedCourtNumbers[index],
    pairA: court.pairA,
    pairB: court.pairB,
    singlesMatch: court.singlesMatch ?? null,
    isUnused: false,
  }));
  const usedCourtNumberSet = new Set(assignedCourtNumbers);
  const unusedAssignments = allCourtNumbers
    .filter((courtNumber) => !usedCourtNumberSet.has(courtNumber))
    .map((courtNumber) => ({
      courtNumber,
      pairA: null,
      pairB: null,
      singlesMatch: null,
      isUnused: true,
    }));

  return [...activeAssignments, ...unusedAssignments].sort(
    (left, right) => left.courtNumber - right.courtNumber,
  );
}

function compactCourtNumbers(
  activeCourts: ActiveCourtAssignment[],
  ctx: GenerationContext,
): CourtAssignment[] {
  const allCourtNumbers = buildCourtNumbers(ctx.conditions.courtCount);
  const activeAssignments = activeCourts.map((court, index) => ({
    courtNumber: index + 1,
    pairA: court.pairA,
    pairB: court.pairB,
    singlesMatch: court.singlesMatch ?? null,
    isUnused: false,
  }));
  const unusedAssignments = allCourtNumbers
    .slice(activeCourts.length)
    .map((courtNumber) => ({
      courtNumber,
      pairA: null,
      pairB: null,
      singlesMatch: null,
      isUnused: true,
    }));

  return [...activeAssignments, ...unusedAssignments];
}

export function assignCourts(
  activePlayerIds: string[],
  ctx: GenerationContext,
): CourtAssignment[] {
  const usableCourtCount = Math.min(
    ctx.conditions.courtCount,
    Math.floor(activePlayerIds.length / ctx.conditions.playersPerCourt),
  );
  const remaining = [...activePlayerIds];
  const activeCourts: ActiveCourtAssignment[] = [];

  while (
    remaining.length >= ctx.conditions.playersPerCourt &&
    activeCourts.length < usableCourtCount
  ) {
    const basePlayerId = pickBasePlayer(remaining, ctx);

    if (ctx.conditions.matchFormat === "singles") {
      const singlesMatch = pickBestSinglesMatch(basePlayerId, remaining, ctx);

      activeCourts.push({
        pairA: null,
        pairB: null,
        singlesMatch,
      });

      for (const playerId of [singlesMatch.player1Id, singlesMatch.player2Id]) {
        const index = remaining.indexOf(playerId);

        if (index >= 0) {
          remaining.splice(index, 1);
        }
      }

      continue;
    }

    const group = pickBestCourtGroup(basePlayerId, remaining, ctx);
    const [pairA, pairB] = pickBestPairing(group, ctx);

    activeCourts.push({
      pairA,
      pairB,
      singlesMatch: null,
    });

    for (const playerId of group) {
      const index = remaining.indexOf(playerId);

      if (index >= 0) {
        remaining.splice(index, 1);
      }
    }
  }

  if (ctx.courtAssignmentMode === "compact") {
    return compactCourtNumbers(activeCourts, ctx);
  }

  return rebalanceCourtNumbers(activeCourts, ctx);
}

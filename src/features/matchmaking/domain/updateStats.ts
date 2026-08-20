import { incrementMatrix } from "../utils/matrix";
import type { GenerationContext, RoundResult } from "../model/types";

function courtPlayerIds(court: RoundResult["courts"][number]): string[] {
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

export function updateStats(ctx: GenerationContext, round: RoundResult): void {
  for (const playerId of round.activePlayerIds) {
    ctx.appearanceCounts[playerId] = (ctx.appearanceCounts[playerId] ?? 0) + 1;
  }

  for (const playerId of round.restPlayerIds) {
    ctx.restCounts[playerId] = (ctx.restCounts[playerId] ?? 0) + 1;
  }

  round.courts.forEach((court) => {
    const players = courtPlayerIds(court);

    if (players.length === 0) {
      return;
    }

    ctx.courtUsageCounts[court.courtNumber] = (ctx.courtUsageCounts[court.courtNumber] ?? 0) + 1;

    players.forEach((playerId) => {
      const counts = ctx.courtAppearanceCounts[playerId] ?? {};
      counts[court.courtNumber] = (counts[court.courtNumber] ?? 0) + 1;
      ctx.courtAppearanceCounts[playerId] = counts;
    });

    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        incrementMatrix(ctx.encounterMatrix, players[i], players[j]);
      }
    }

    if (court.singlesMatch && players.length === 2) {
      incrementMatrix(
        ctx.opponentMatrix,
        court.singlesMatch.player1Id,
        court.singlesMatch.player2Id,
      );
      return;
    }

    if (players.length !== 4 || !court.pairA || !court.pairB) {
      return;
    }

    incrementMatrix(
      ctx.teammateMatrix,
      court.pairA.player1Id,
      court.pairA.player2Id,
    );
    incrementMatrix(
      ctx.teammateMatrix,
      court.pairB.player1Id,
      court.pairB.player2Id,
    );

    const opponents = [
      [court.pairA.player1Id, court.pairB.player1Id],
      [court.pairA.player1Id, court.pairB.player2Id],
      [court.pairA.player2Id, court.pairB.player1Id],
      [court.pairA.player2Id, court.pairB.player2Id],
    ] as const;

    opponents.forEach(([left, right]) => incrementMatrix(ctx.opponentMatrix, left, right));
  });

  ctx.restHistoryByRound.push(round.restPlayerIds);
  ctx.activeHistoryByRound.push(round.activePlayerIds);
}

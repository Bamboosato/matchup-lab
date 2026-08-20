import type {
  CourtAssignmentMode,
  GenerationContext,
  MatchConditions,
  MatchupResult,
  RoundResult,
} from "../model/types";
import { selectRestPlayers } from "./selectRestPlayers";
import { assignCourts } from "./assignCourts";
import { buildPlayerStats, calculateScore } from "./calculateScore";
import { updateStats } from "./updateStats";

type GenerateMatchupOptions = {
  initialRounds?: RoundResult[];
  eligibleParticipantIds?: string[];
  courtAssignmentMode?: CourtAssignmentMode;
};

function createContext(
  conditions: MatchConditions,
  seed: number,
  eligibleParticipantIds?: string[],
  courtAssignmentMode: CourtAssignmentMode = "balanced",
): GenerationContext {
  const participantIds = conditions.participants.map((participant) => participant.id);
  const participantIdSet = new Set(participantIds);
  const eligibleIds = (eligibleParticipantIds ?? participantIds).filter((participantId) =>
    participantIdSet.has(participantId),
  );

  return {
    conditions,
    seed,
    courtAssignmentMode,
    eligibleParticipantIds: [...new Set(eligibleIds)],
    restCounts: Object.fromEntries(participantIds.map((participantId) => [participantId, 0])),
    appearanceCounts: Object.fromEntries(
      participantIds.map((participantId) => [participantId, 0]),
    ),
    courtAppearanceCounts: Object.fromEntries(
      participantIds.map((participantId) => [participantId, {}]),
    ),
    courtUsageCounts: Object.fromEntries(
      Array.from({ length: conditions.courtCount }, (_, index) => [index + 1, 0]),
    ),
    encounterMatrix: {},
    teammateMatrix: {},
    opponentMatrix: {},
    restHistoryByRound: [],
    activeHistoryByRound: [],
  };
}

export function generateMatchup(
  conditions: MatchConditions,
  seed: number,
  options: GenerateMatchupOptions = {},
): MatchupResult {
  const ctx = createContext(
    conditions,
    seed,
    options.eligibleParticipantIds,
    options.courtAssignmentMode,
  );
  const rounds: RoundResult[] = [...(options.initialRounds ?? [])];

  for (const round of rounds) {
    updateStats(ctx, round);
  }

  for (let roundIndex = rounds.length; roundIndex < conditions.roundCount; roundIndex += 1) {
    const restPlayerIds = selectRestPlayers(ctx, roundIndex);
    const restPlayerIdSet = new Set(restPlayerIds);
    const activePlayerIds = ctx.eligibleParticipantIds
      .filter((participantId) => !restPlayerIdSet.has(participantId));
    const courts = assignCourts(activePlayerIds, ctx);
    const round: RoundResult = {
      roundNumber: roundIndex + 1,
      courts,
      restPlayerIds,
      activePlayerIds,
    };

    updateStats(ctx, round);
    rounds.push(round);
  }

  const stats = buildPlayerStats(ctx);
  const score = calculateScore(ctx, stats, rounds);

  return {
    conditions,
    rounds,
    stats,
    seed,
    score,
    generatedAt: new Date().toISOString(),
  };
}

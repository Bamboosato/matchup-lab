import type { MatchConditionInput, MatchConditions } from "../model/types";
import { matchConditionInputSchema } from "../model/schemas";

function playersPerCourt(matchFormat: MatchConditions["matchFormat"]): MatchConditions["playersPerCourt"] {
  return matchFormat === "singles" ? 2 : 4;
}

export function buildMatchConditions(input: MatchConditionInput): MatchConditions {
  const parsed = matchConditionInputSchema.parse({
    ...input,
    participants: input.participants.map((participant) => ({
      ...participant,
      name: participant.name.trim(),
    })),
    eventName: input.eventName?.trim() || undefined,
  });

  return {
    eventName: parsed.eventName,
    matchFormat: parsed.matchFormat,
    matchupMode: parsed.matchupMode,
    participants: parsed.participants.map((participant, index) => {
      const baseParticipant = {
        id: participant.id,
        name: participant.name,
        index,
      };

      return participant.gender
        ? {
            ...baseParticipant,
            gender: participant.gender,
          }
        : baseParticipant;
    }),
    courtCount: parsed.courtCount,
    roundCount: parsed.roundCount,
    playersPerCourt: playersPerCourt(parsed.matchFormat),
  };
}

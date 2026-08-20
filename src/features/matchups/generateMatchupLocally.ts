import { generateMatchupUseCase } from "@/features/matchmaking/application/generateMatchupUseCase";
import type {
  MatchConditionInput,
  MatchupResult,
  ParticipantInput,
} from "@/features/matchmaking/model/types";

export type LocalMatchupInput = MatchConditionInput;

function createSeed() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] ?? 1;
  }

  return Math.floor(Math.random() * 2 ** 32);
}

export function generateMatchupLocally(input: LocalMatchupInput): MatchupResult {
  const participants: ParticipantInput[] = input.participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    gender: participant.gender,
  }));

  return generateMatchupUseCase(
    {
      ...input,
      participants,
    },
    createSeed(),
  );
}

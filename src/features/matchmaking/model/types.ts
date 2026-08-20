export type MatchFormat = "doubles" | "singles";

export type MatchupMode = "standard" | "sameGenderPriority" | "mixedDoublesPriority";

export type ParticipantGender = "female" | "male";

export type CourtAssignmentMode = "balanced" | "compact";

export type ParticipantInput = {
  id: string;
  name: string;
  gender?: ParticipantGender;
};

export type MatchConditionInput = {
  eventName?: string;
  matchFormat?: MatchFormat;
  matchupMode?: MatchupMode;
  participantCount: number;
  participants: ParticipantInput[];
  courtCount: number;
  roundCount: number;
};

export type Participant = {
  id: string;
  name: string;
  gender?: ParticipantGender;
  index: number;
};

export type MatchConditions = {
  eventName?: string;
  matchFormat: MatchFormat;
  matchupMode: MatchupMode;
  participants: Participant[];
  courtCount: number;
  roundCount: number;
  playersPerCourt: 2 | 4;
};

export type Pair = {
  player1Id: string;
  player2Id: string;
};

export type SinglesMatch = {
  player1Id: string;
  player2Id: string;
};

export type CourtAssignment = {
  courtNumber: number;
  pairA: Pair | null;
  pairB: Pair | null;
  singlesMatch?: SinglesMatch | null;
  isUnused: boolean;
};

export type RoundResult = {
  roundNumber: number;
  courts: CourtAssignment[];
  restPlayerIds: string[];
  activePlayerIds: string[];
};

export type ResultScore = {
  fairnessPenalty: number;
  consecutiveRestPenalty: number;
  genderPreferencePenalty: number;
  encounterPenalty: number;
  sameTeammatePenalty: number;
  sameOpponentPenalty: number;
  totalScore: number;
};

export type PlayerStats = {
  playerId: string;
  appearances: number;
  rests: number;
  uniqueEncounterCount: number;
  consecutiveRestCount: number;
};

export type MatchupResult = {
  conditions: MatchConditions;
  rounds: RoundResult[];
  stats: PlayerStats[];
  seed: number;
  score: ResultScore;
  generatedAt: string;
};

export type PairCountMatrix = Record<string, Record<string, number>>;

export type GenerationContext = {
  conditions: MatchConditions;
  seed: number;
  courtAssignmentMode: CourtAssignmentMode;
  eligibleParticipantIds: string[];
  restCounts: Record<string, number>;
  appearanceCounts: Record<string, number>;
  courtAppearanceCounts: Record<string, Record<number, number>>;
  courtUsageCounts: Record<number, number>;
  encounterMatrix: PairCountMatrix;
  teammateMatrix: PairCountMatrix;
  opponentMatrix: PairCountMatrix;
  restHistoryByRound: string[][];
  activeHistoryByRound: string[][];
};

export type PrintModel = MatchupResult & {
  shouldShowShareQr?: boolean;
};

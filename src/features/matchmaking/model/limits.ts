export const MATCH_CONDITION_LIMITS = {
  participantCount: {
    min: 4,
    doublesMin: 4,
    singlesMin: 2,
    max: 30,
  },
  courtCount: {
    min: 1,
    max: 8,
  },
  roundCount: {
    min: 1,
    max: 20,
  },
  genderCount: {
    min: 0,
  },
} as const;

export function formatParticipantSummaryLabel(params: {
  guestCount: number;
  isGuest: boolean;
  participantCount: number;
}) {
  if (params.isGuest) {
    return `${params.participantCount}人`;
  }

  return `${params.participantCount}人（ゲスト${params.guestCount}人）`;
}

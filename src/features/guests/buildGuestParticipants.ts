export type GuestParticipant = {
  id: string;
  name: string;
  gender: "female" | "male";
};

type BuildGuestParticipantsOptions = {
  idPrefix?: string;
};

export function buildGuestParticipants(
  femaleCount: number,
  maleCount: number,
  options: BuildGuestParticipantsOptions = {},
): GuestParticipant[] {
  const participants: GuestParticipant[] = [];
  const totalCount = femaleCount + maleCount;
  const idPrefix = options.idPrefix ?? "guest";

  for (let index = 0; index < totalCount; index += 1) {
    const gender = index < femaleCount ? "female" : "male";
    const displayNumber = String(index + 1).padStart(2, "0");

    participants.push({
      id: `${idPrefix}-${displayNumber}`,
      name: formatGuestParticipantName(displayNumber),
      gender,
    });
  }

  return participants;
}

function formatGuestParticipantName(displayNumber: string) {
  return `ゲスト${displayNumber}`;
}

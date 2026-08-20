export type ParticipantGender = "female" | "male";

const GENDER_MARKS: Record<ParticipantGender, string> = {
  female: "F",
  male: "M",
};

export function getParticipantGenderMark(gender?: ParticipantGender) {
  return gender ? GENDER_MARKS[gender] : "";
}

export function formatParticipantDisplayName(participant: { name: string; gender?: ParticipantGender }) {
  const mark = getParticipantGenderMark(participant.gender);

  return mark ? `${participant.name}\u00a0${mark}` : participant.name;
}

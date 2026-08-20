import type { Participant } from "../model/types";

const GENDER_MARKERS = {
  female: "F",
  male: "M",
} as const;

type FormatParticipantOptions = {
  showGender?: boolean;
};

const PAIR_PARTICIPANT_SEPARATOR = " & ";

export function formatParticipantName(
  participant: Participant,
  options: FormatParticipantOptions = {},
): string {
  if (!participant.gender || options.showGender === false) {
    return participant.name;
  }

  return `${participant.name}${GENDER_MARKERS[participant.gender]}`;
}

export function findParticipantName(
  participants: Participant[],
  playerId: string,
  options: FormatParticipantOptions = {},
): string {
  const participant = participants.find((entry) => entry.id === playerId);

  return participant ? formatParticipantName(participant, options) : playerId;
}

export function formatPairParticipantNames(
  participants: Participant[],
  player1Id: string,
  player2Id: string,
  options: FormatParticipantOptions = {},
): string {
  const formattedPlayers = [player1Id, player2Id]
    .map((playerId, order) => {
      const participant = participants.find((entry) => entry.id === playerId);

      return {
        label: participant ? formatParticipantName(participant, options) : playerId,
        order,
        sortIndex: participant?.index ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .toSorted((left, right) => {
      if (left.sortIndex !== right.sortIndex) {
        return left.sortIndex - right.sortIndex;
      }

      return left.order - right.order;
    });

  return formattedPlayers.map((player) => player.label).join(PAIR_PARTICIPANT_SEPARATOR);
}

export function formatSinglesMatchParticipantNames(
  participants: Participant[],
  player1Id: string,
  player2Id: string,
  options: FormatParticipantOptions = {},
): string {
  const formattedPlayers = [player1Id, player2Id]
    .map((playerId, order) => {
      const participant = participants.find((entry) => entry.id === playerId);

      return {
        label: participant ? formatParticipantName(participant, options) : playerId,
        order,
        sortIndex: participant?.index ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .toSorted((left, right) => {
      if (left.sortIndex !== right.sortIndex) {
        return left.sortIndex - right.sortIndex;
      }

      return left.order - right.order;
    });

  return formattedPlayers.map((player) => player.label).join(" vs ");
}

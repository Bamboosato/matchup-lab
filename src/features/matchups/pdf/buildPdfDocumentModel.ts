import { formatParticipantDisplayName } from "../formatParticipantDisplayName";

export type PdfMatchupMode = "standard" | "sameGenderPriority" | "mixedDoublesPriority";
export type PdfMatchFormat = "doubles" | "singles";

export type PdfMatchupParticipant = {
  id: string;
  name: string;
  gender?: "female" | "male";
  index?: number;
};

export type PdfMatchupPair = {
  player1Id: string;
  player2Id: string;
};

export type PdfSinglesMatch = {
  player1Id: string;
  player2Id: string;
};

export type PdfMatchupCourt = {
  courtNumber: number;
  pairA?: PdfMatchupPair | null;
  pairB?: PdfMatchupPair | null;
  singlesMatch?: PdfSinglesMatch | null;
  isUnused?: boolean;
};

export type PdfMatchupRound = {
  roundNumber: number;
  courts: PdfMatchupCourt[];
  restPlayerIds: string[];
};

export type PdfMatchupResult = {
  conditions: {
    eventName?: string;
    matchFormat?: PdfMatchFormat;
    matchupMode?: PdfMatchupMode;
    participants: PdfMatchupParticipant[];
    courtCount: number;
    roundCount: number;
    playersPerCourt?: 2 | 4;
  };
  rounds: PdfMatchupRound[];
  seed: number;
};

export const PDF_ROUNDS_PER_PAGE = 12;
export const PDF_COURTS_PER_ROW = 2;
// Four courts use six table rows per round, so 30 rows keeps five rounds on one page.
const PDF_TABLE_ROWS_PER_PAGE = 30;
const PDF_TYPOGRAPHY_DENSITY_ROUNDS_CAP = 10;

export type PdfTypography = {
  titleFontSize: number;
  metaLabelFontSize: number;
  metaValueFontSize: number;
  tableHeaderFontSize: number;
  tableBodyFontSize: number;
  roundFontSize: number;
  footerFontSize: number;
};

export type PdfCourtBlock = {
  courtNumber: number;
  pairAPlayers: string[];
  pairBPlayers: string[];
  isUnused: boolean;
  singlesMatchLabel?: string;
};

export type PdfRoundBlock = {
  roundNumber: number;
  courtRows: Array<[PdfCourtBlock | null, PdfCourtBlock | null]>;
  restCell: string;
};

export type PdfPageModel = {
  pageNumber: number;
  rounds: PdfRoundBlock[];
};

export type PdfDocumentModel = {
  eventName: string;
  matchFormat: PdfMatchFormat;
  roundCount: number;
  courtCount: number;
  participantCount: number;
  seed: number;
  pages: PdfPageModel[];
  typography: PdfTypography;
};

function createParticipantNameMap(participants: PdfMatchupParticipant[]) {
  return new Map(participants.map((participant) => [participant.id, formatParticipantDisplayName(participant)]));
}

function createParticipantOrderMap(participants: PdfMatchupParticipant[]) {
  return new Map(participants.map((participant, index) => [participant.id, participant.index ?? index + 1]));
}

function pairPlayers(pair: PdfMatchupPair, participantNameById: Map<string, string>) {
  return [participantNameById.get(pair.player1Id) ?? pair.player1Id, participantNameById.get(pair.player2Id) ?? pair.player2Id];
}

function singlesMatchLabel(match: PdfSinglesMatch, participantNameById: Map<string, string>) {
  const player1 = participantNameById.get(match.player1Id) ?? match.player1Id;
  const player2 = participantNameById.get(match.player2Id) ?? match.player2Id;

  return `${player1} vs ${player2}`;
}

function buildCourtBlock(court: PdfMatchupCourt, participantNameById: Map<string, string>): PdfCourtBlock {
  if (court.isUnused) {
    return {
      courtNumber: court.courtNumber,
      isUnused: true,
      pairAPlayers: ["未使用"],
      pairBPlayers: [""],
    };
  }

  if (court.singlesMatch) {
    return {
      courtNumber: court.courtNumber,
      isUnused: false,
      pairAPlayers: [],
      pairBPlayers: [],
      singlesMatchLabel: singlesMatchLabel(court.singlesMatch, participantNameById),
    };
  }

  if (!court.pairA || !court.pairB) {
    return {
      courtNumber: court.courtNumber,
      isUnused: true,
      pairAPlayers: ["未使用"],
      pairBPlayers: [""],
    };
  }

  return {
    courtNumber: court.courtNumber,
    isUnused: false,
    pairAPlayers: pairPlayers(court.pairA, participantNameById),
    pairBPlayers: pairPlayers(court.pairB, participantNameById),
  };
}

function formatRestCell(
  restPlayerIds: string[],
  participantNameById: Map<string, string>,
  participantOrderById: Map<string, number>,
) {
  if (restPlayerIds.length === 0) {
    return "-";
  }

  return restPlayerIds
    .slice()
    .sort((left, right) => {
      return (
        (participantOrderById.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (participantOrderById.get(right) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map((playerId) => participantNameById.get(playerId) ?? playerId)
    .join(", ");
}

function buildPdfRoundBlock(
  round: PdfMatchupRound,
  participantNameById: Map<string, string>,
  participantOrderById: Map<string, number>,
): PdfRoundBlock {
  const courtRows: Array<[PdfCourtBlock | null, PdfCourtBlock | null]> = [];

  for (let offset = 0; offset < round.courts.length; offset += PDF_COURTS_PER_ROW) {
    const courtBlocks = round.courts
      .slice(offset, offset + PDF_COURTS_PER_ROW)
      .map((court) => buildCourtBlock(court, participantNameById));

    courtRows.push([courtBlocks[0] ?? null, courtBlocks[1] ?? null]);
  }

  return {
    roundNumber: round.roundNumber,
    courtRows,
    restCell: formatRestCell(round.restPlayerIds, participantNameById, participantOrderById),
  };
}

export function pickPdfTypography(params: {
  courtCount: number;
  participantCount: number;
  roundsOnPage: number;
}): PdfTypography {
  const densityRounds = Math.min(params.roundsOnPage, PDF_TYPOGRAPHY_DENSITY_ROUNDS_CAP);
  const densityScore =
    Math.max(0, params.courtCount - 2) * 1.1 +
    Math.max(0, densityRounds - 6) * 0.35 +
    Math.max(0, params.participantCount - 8) * 0.1;

  const tableBodyFontSize = Math.max(7.2, 10.6 - densityScore);
  const tableHeaderFontSize = Math.max(7.8, tableBodyFontSize + 0.4);
  const roundFontSize = Math.max(8, tableBodyFontSize + 0.8);
  const titleFontSize = params.courtCount >= 4 ? 18 : 20;
  const metaValueFontSize = params.courtCount >= 4 ? 14 : 16;

  return {
    titleFontSize,
    metaLabelFontSize: 8,
    metaValueFontSize,
    tableHeaderFontSize,
    tableBodyFontSize,
    roundFontSize,
    footerFontSize: 9,
  };
}

export function buildPdfDocumentModel(result: PdfMatchupResult): PdfDocumentModel {
  const participantNameById = createParticipantNameMap(result.conditions.participants);
  const participantOrderById = createParticipantOrderMap(result.conditions.participants);
  const pages: PdfPageModel[] = [];
  const pdfRounds = result.rounds.map((round) => buildPdfRoundBlock(round, participantNameById, participantOrderById));
  let currentRounds: PdfRoundBlock[] = [];
  let currentRowCount = 0;

  for (const roundBlock of pdfRounds) {
    const roundRowCount = roundBlock.courtRows.length * 2 + 2;

    if (currentRounds.length > 0 && currentRowCount + roundRowCount > PDF_TABLE_ROWS_PER_PAGE) {
      pages.push({
        pageNumber: pages.length + 1,
        rounds: currentRounds,
      });
      currentRounds = [];
      currentRowCount = 0;
    }

    currentRounds.push(roundBlock);
    currentRowCount += roundRowCount;
  }

  if (currentRounds.length > 0 || pages.length === 0) {
    pages.push({
      pageNumber: pages.length + 1,
      rounds: currentRounds,
    });
  }

  return {
    eventName: result.conditions.eventName || "MatchupLab",
    matchFormat: result.conditions.matchFormat ?? "doubles",
    roundCount: result.conditions.roundCount,
    courtCount: result.conditions.courtCount,
    participantCount: result.conditions.participants.length,
    seed: result.seed,
    pages,
    typography: pickPdfTypography({
      courtCount: result.conditions.courtCount,
      participantCount: result.conditions.participants.length,
      roundsOnPage: Math.min(
        PDF_TABLE_ROWS_PER_PAGE,
        Math.max(
          ...pages.map((page) =>
            page.rounds.reduce((total, round) => total + round.courtRows.length * 2 + 2, 0),
          ),
        ),
      ),
    }),
  };
}

export function truncateTextToWidth(value: string, maxWidth: number, measureTextWidth: (candidate: string) => number) {
  if (measureTextWidth(value) <= maxWidth) {
    return value;
  }

  const ellipsis = "...";
  const chars = Array.from(value);

  if (chars.length === 0 || measureTextWidth(ellipsis) >= maxWidth) {
    return ellipsis;
  }

  let low = 0;
  let high = chars.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join("")}${ellipsis}`;

    if (measureTextWidth(candidate) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return `${chars.slice(0, low).join("")}${ellipsis}`;
}

function matchupModeFileNameLabel(matchupMode?: PdfMatchupMode): string {
  if (matchupMode === "sameGenderPriority") {
    return "同性";
  }

  if (matchupMode === "mixedDoublesPriority") {
    return "混合";
  }

  return "通常";
}

export function buildPdfFileName(result: PdfMatchupResult) {
  const eventName = result.conditions.eventName || "MatchupLab";
  const sanitized = eventName.replace(/[\\/:*?"<>|]/g, "").trim();
  const prefix = sanitized || "matchuplab";
  const participantCount = result.conditions.participants.length;
  const courtCount = result.conditions.courtCount;
  const modeLabel = result.conditions.matchFormat === "singles" ? "シングルス" : matchupModeFileNameLabel(result.conditions.matchupMode);

  return `${prefix}_${participantCount}人_${courtCount}面_${modeLabel}-matchup.pdf`;
}

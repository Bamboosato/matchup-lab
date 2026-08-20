"use client";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { CellInput } from "jspdf-autotable";
import {
  buildPdfDocumentModel,
  buildPdfFileName,
  PDF_COURTS_PER_ROW,
  truncateTextToWidth,
  type PdfCourtBlock,
  type PdfMatchupResult,
  type PdfRoundBlock,
} from "./buildPdfDocumentModel";

const PDF_FONT_URL = "/fonts/NotoSansJP-VF.ttf?v=20260512";
const PDF_FONT_FILE = "NotoSansJP-VF.ttf";
const PDF_FONT_FAMILY = "NotoSansJP";

const PAGE_MARGIN = 24;
const HEADER_TOP = 24;
const HEADER_BOTTOM = 66;
const FOOTER_HEIGHT = 40;
const META_CHIP_GAP = 6;
const META_CHIP_HEIGHT = 32;
const META_CHIP_WIDTH = 72;
const EMPHASIS_TEXT_COLOR: [number, number, number] = [15, 23, 42];
const SUBTLE_TEXT_COLOR: [number, number, number] = [71, 85, 105];
const BLUE_TEXT_COLOR: [number, number, number] = [29, 78, 216];
const BLUE_LINE_COLOR: [number, number, number] = [0, 112, 192];
const BLUE_FILL_COLOR: [number, number, number] = [232, 244, 255];
const COURT_HEADER_HEIGHT = 12;
const PLAYER_ROW_HEIGHT = 32;
const REST_HEADER_HEIGHT = 12;
const REST_ROW_HEIGHT = 18;
const HEADER_ROUND_GAP_HEIGHT = 9;
const ROUND_GAP_HEIGHT = 7;
const TABLE_LINE_WIDTH = 0.5;

let fontBytesPromise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function loadPdfFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(PDF_FONT_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF font: ${response.status}`);
        }

        return response.arrayBuffer();
      })
      .then((buffer) => arrayBufferToBase64(buffer));
  }

  return fontBytesPromise;
}

async function registerPdfFont(doc: jsPDF) {
  const fontBase64 = await loadPdfFontBytes();

  doc.addFileToVFS(PDF_FONT_FILE, fontBase64);
  doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "normal", "Identity-H");
  doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "bold", "Identity-H");
}

function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

function drawMetaChip(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  labelFontSize: number,
  valueFontSize: number,
) {
  doc.setFillColor(...BLUE_FILL_COLOR);
  doc.setDrawColor(...BLUE_LINE_COLOR);
  doc.roundedRect(x, y, META_CHIP_WIDTH, META_CHIP_HEIGHT, 4, 4, "FD");

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(labelFontSize);
  doc.setTextColor(...SUBTLE_TEXT_COLOR);
  doc.text(label, x + 8, y + 10);

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(valueFontSize);
  doc.setTextColor(...EMPHASIS_TEXT_COLOR);
  doc.text(value, x + 8, y + 24);
}

function drawHeader(doc: jsPDF, model: ReturnType<typeof buildPdfDocumentModel>) {
  const width = pageWidth(doc);
  const chipTotalWidth = META_CHIP_WIDTH * 3 + META_CHIP_GAP * 2;
  const chipStartX = width - PAGE_MARGIN - chipTotalWidth;
  const titleMaxWidth = chipStartX - PAGE_MARGIN - 12;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLUE_TEXT_COLOR);
  doc.text("MATCHUP SHEET", PAGE_MARGIN, HEADER_TOP);

  doc.setFontSize(model.typography.titleFontSize);
  doc.setTextColor(...EMPHASIS_TEXT_COLOR);
  const eventName = truncateTextToWidth(model.eventName, titleMaxWidth, (candidate) => doc.getTextWidth(candidate));
  doc.text(eventName, PAGE_MARGIN, HEADER_TOP + 24);

  drawMetaChip(
    doc,
    chipStartX,
    HEADER_TOP - 8,
    "ROUNDS",
    String(model.roundCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMetaChip(
    doc,
    chipStartX + META_CHIP_WIDTH + META_CHIP_GAP,
    HEADER_TOP - 8,
    "COURTS",
    String(model.courtCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMetaChip(
    doc,
    chipStartX + (META_CHIP_WIDTH + META_CHIP_GAP) * 2,
    HEADER_TOP - 8,
    "PLAYERS",
    String(model.participantCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  doc.setDrawColor(...BLUE_LINE_COLOR);
  doc.setLineWidth(1.2);
  doc.line(PAGE_MARGIN, HEADER_BOTTOM, width - PAGE_MARGIN, HEADER_BOTTOM);
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const width = pageWidth(doc);
  const height = pageHeight(doc);

  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE_TEXT_COLOR);
  doc.text("MatchupLab", PAGE_MARGIN, height - PAGE_MARGIN + 2);

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...EMPHASIS_TEXT_COLOR);
  doc.text(`${pageNumber} / ${totalPages}`, width / 2, height - PAGE_MARGIN + 2, {
    align: "center",
  });
}

function buildColumnStyles(doc: jsPDF, teamColumnCount: number) {
  const usableWidth = pageWidth(doc) - PAGE_MARGIN * 2;
  const roundColumnWidth = 26;
  const teamColumnWidth = (usableWidth - roundColumnWidth) / teamColumnCount;
  const styles: Record<number, { cellWidth: number; halign?: "center" | "left" | "right" }> = {
    0: { cellWidth: roundColumnWidth, halign: "center" },
  };

  for (let index = 1; index <= teamColumnCount; index += 1) {
    styles[index] = { cellWidth: teamColumnWidth, halign: "center" };
  }

  return styles;
}

function tableCell(
  content: string | string[] | number,
  options?: { colSpan?: number; rowSpan?: number; minCellHeight?: number },
): CellInput {
  return {
    content,
    colSpan: options?.colSpan,
    rowSpan: options?.rowSpan,
    styles: {
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      font: PDF_FONT_FAMILY,
      fontStyle: "normal",
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: options?.minCellHeight,
      overflow: "ellipsize",
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function roundCell(roundNumber: number, rowSpan: number): CellInput {
  return {
    content: String(roundNumber),
    rowSpan,
    styles: {
      cellPadding: 0,
      fillColor: BLUE_FILL_COLOR,
      font: PDF_FONT_FAMILY,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function courtHeaderCell(court: PdfCourtBlock | null): CellInput {
  return {
    content: court ? `コート${court.courtNumber}` : "",
    colSpan: 2,
    styles: {
      cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
      font: PDF_FONT_FAMILY,
      fontStyle: "bold",
      fontSize: 8.2,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: COURT_HEADER_HEIGHT,
      overflow: "ellipsize",
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function playerCell(players: string[]) {
  return tableCell(players.filter(Boolean).join("\n"), { minCellHeight: PLAYER_ROW_HEIGHT });
}

function emptyPlayerCells() {
  return [tableCell("", { colSpan: 2, minCellHeight: PLAYER_ROW_HEIGHT })];
}

function restHeaderCell(teamColumnCount: number): CellInput {
  return {
    content: "休憩",
    colSpan: teamColumnCount,
    styles: {
      cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
      font: PDF_FONT_FAMILY,
      fontStyle: "bold",
      fontSize: 8.4,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: REST_HEADER_HEIGHT,
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function restPlayersCell(restCell: string, teamColumnCount: number): CellInput {
  return {
    content: restCell,
    colSpan: teamColumnCount,
    styles: {
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      font: PDF_FONT_FAMILY,
      fontStyle: "normal",
      fontSize: 8.5,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: REST_ROW_HEIGHT,
      overflow: "ellipsize",
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function spacerRowCell(totalColumnCount: number, height = ROUND_GAP_HEIGHT): CellInput {
  return {
    content: "",
    colSpan: totalColumnCount,
    styles: {
      cellPadding: 0,
      fillColor: false,
      lineColor: false,
      lineWidth: 0,
      minCellHeight: height,
      textColor: [255, 255, 255],
    },
  };
}

function courtPlayerCells(court: PdfCourtBlock | null) {
  if (!court) {
    return emptyPlayerCells();
  }

  if (court.singlesMatchLabel) {
    return [tableCell(court.singlesMatchLabel, { colSpan: 2, minCellHeight: PLAYER_ROW_HEIGHT })];
  }

  return [playerCell(court.pairAPlayers), playerCell(court.pairBPlayers)];
}

function buildRoundRows(round: PdfRoundBlock, teamColumnCount: number, includeSpacer: boolean) {
  const rows: CellInput[][] = [];
  const rowSpan = round.courtRows.length * 2 + 2;

  round.courtRows.forEach(([leftCourt, rightCourt], rowIndex) => {
    const headerRow: CellInput[] = [];

    if (rowIndex === 0) {
      headerRow.push(roundCell(round.roundNumber, rowSpan));
    }

    headerRow.push(courtHeaderCell(leftCourt));
    if (teamColumnCount > 2) {
      headerRow.push(courtHeaderCell(rightCourt));
    }
    rows.push(headerRow);

    const playerRow: CellInput[] = [];
    playerRow.push(...courtPlayerCells(leftCourt));
    if (teamColumnCount > 2) {
      playerRow.push(...courtPlayerCells(rightCourt));
    }
    rows.push(playerRow);
  });

  rows.push([restHeaderCell(teamColumnCount)]);
  rows.push([restPlayersCell(round.restCell, teamColumnCount)]);

  if (includeSpacer) {
    rows.push([spacerRowCell(teamColumnCount + 1)]);
  }

  return rows;
}

function buildTableHead(courtSlotCount: number, matchFormat: PdfMatchupResult["conditions"]["matchFormat"]): CellInput[] {
  const headCells: CellInput[] = ["R"];

  for (let index = 0; index < courtSlotCount; index += 1) {
    if (matchFormat === "singles") {
      headCells.push({ content: "Match", colSpan: 2 });
    } else {
      headCells.push("A", "B");
    }
  }

  return headCells;
}

export async function exportMatchupPdf(result: PdfMatchupResult) {
  const model = buildPdfDocumentModel(result);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  await registerPdfFont(doc);

  model.pages.forEach((page, pageIndex) => {
    const courtSlotCount = Math.min(Math.max(model.courtCount, 1), PDF_COURTS_PER_ROW);
    const teamColumnCount = courtSlotCount * 2;
    const bodyRows = [
      [spacerRowCell(teamColumnCount + 1, HEADER_ROUND_GAP_HEIGHT)],
      ...page.rounds.flatMap((round, roundIndex) =>
        buildRoundRows(round, teamColumnCount, roundIndex < page.rounds.length - 1),
      ),
    ];

    if (pageIndex > 0) {
      doc.addPage("a4", "portrait");
    }

    drawHeader(doc, model);

    autoTable(doc, {
      startY: HEADER_BOTTOM + 14,
      margin: {
        top: HEADER_BOTTOM + 14,
        right: PAGE_MARGIN,
        bottom: FOOTER_HEIGHT,
        left: PAGE_MARGIN,
      },
      theme: "grid",
      tableWidth: pageWidth(doc) - PAGE_MARGIN * 2,
      head: [buildTableHead(courtSlotCount, model.matchFormat)],
      body: bodyRows,
      styles: {
        font: PDF_FONT_FAMILY,
        fontStyle: "normal",
        fontSize: model.typography.tableBodyFontSize,
        cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
        lineColor: BLUE_LINE_COLOR,
        lineWidth: TABLE_LINE_WIDTH,
        textColor: EMPHASIS_TEXT_COLOR,
        valign: "middle",
        overflow: "ellipsize",
      },
      headStyles: {
        fillColor: BLUE_FILL_COLOR,
        textColor: BLUE_TEXT_COLOR,
        font: PDF_FONT_FAMILY,
        fontStyle: "bold",
        fontSize: 8.6,
        halign: "center",
        lineColor: BLUE_LINE_COLOR,
        lineWidth: TABLE_LINE_WIDTH,
        minCellHeight: 17,
        valign: "middle",
      },
      bodyStyles: {
        minCellHeight: 16,
      },
      columnStyles: buildColumnStyles(doc, teamColumnCount),
      tableLineColor: BLUE_LINE_COLOR,
      tableLineWidth: 0,
    });

    drawFooter(doc, page.pageNumber, model.pages.length);
  });

  doc.save(buildPdfFileName(result));
}

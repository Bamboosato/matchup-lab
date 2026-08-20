import type { PairCountMatrix } from "../model/types";

export function ensureMatrixValue(
  matrix: PairCountMatrix,
  playerA: string,
  playerB: string,
): number {
  return matrix[playerA]?.[playerB] ?? 0;
}

export function incrementMatrix(
  matrix: PairCountMatrix,
  playerA: string,
  playerB: string,
): void {
  if (!matrix[playerA]) {
    matrix[playerA] = {};
  }

  if (!matrix[playerB]) {
    matrix[playerB] = {};
  }

  matrix[playerA][playerB] = (matrix[playerA][playerB] ?? 0) + 1;
  matrix[playerB][playerA] = (matrix[playerB][playerA] ?? 0) + 1;
}

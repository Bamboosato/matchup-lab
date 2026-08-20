import type { MatchupResult, PrintModel } from "../model/types";

type FormatPrintModelOptions = {
  shouldShowShareQr?: boolean;
};

export function formatPrintModel(
  result: MatchupResult,
  options: FormatPrintModelOptions = {},
): PrintModel {
  return {
    ...result,
    shouldShowShareQr: options.shouldShowShareQr,
  };
}

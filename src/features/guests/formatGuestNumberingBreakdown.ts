export function formatGuestNumberingBreakdown(femaleCount: number, maleCount: number) {
  const ranges: string[] = [];

  if (femaleCount > 0) {
    ranges.push(`${formatNumberRange(1, femaleCount)}：女性`);
  }

  if (maleCount > 0) {
    ranges.push(`${formatNumberRange(femaleCount + 1, femaleCount + maleCount)}：男性`);
  }

  return ranges.join("、");
}

export function formatNumberRange(start: number, end: number) {
  return start === end ? `${start}` : `${start}-${end}`;
}

export function formatGuestSummaryNumberingBreakdown(femaleCount: number, maleCount: number) {
  const ranges: string[] = [];

  if (femaleCount > 0) {
    ranges.push(`${formatPaddedNumberRange(1, femaleCount)}:女性`);
  }

  if (maleCount > 0) {
    ranges.push(`${formatPaddedNumberRange(femaleCount + 1, femaleCount + maleCount)}:男性`);
  }

  return ranges.join("、");
}

function formatPaddedNumberRange(start: number, end: number) {
  const paddedStart = String(start).padStart(2, "0");
  const paddedEnd = String(end).padStart(2, "0");

  return start === end ? paddedStart : `${paddedStart}-${paddedEnd}`;
}

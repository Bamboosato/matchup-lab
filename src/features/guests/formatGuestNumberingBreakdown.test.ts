import { describe, expect, it } from "vitest";
import {
  formatGuestNumberingBreakdown,
  formatGuestSummaryNumberingBreakdown,
  formatNumberRange,
} from "./formatGuestNumberingBreakdown";

describe("formatGuestNumberingBreakdown", () => {
  it("formats female-first guest numbering ranges", () => {
    expect(formatGuestNumberingBreakdown(10, 13)).toBe("1-10：女性、11-23：男性");
  });

  it("omits empty gender groups", () => {
    expect(formatGuestNumberingBreakdown(0, 4)).toBe("1-4：男性");
    expect(formatGuestNumberingBreakdown(3, 0)).toBe("1-3：女性");
    expect(formatGuestNumberingBreakdown(0, 0)).toBe("");
  });
});

describe("formatGuestSummaryNumberingBreakdown", () => {
  it("formats zero-padded guest numbering for the Summary guest line", () => {
    expect(formatGuestSummaryNumberingBreakdown(5, 4)).toBe("01-05:女性、06-09:男性");
  });

  it("omits empty gender groups in the Summary guest line", () => {
    expect(formatGuestSummaryNumberingBreakdown(0, 1)).toBe("01:男性");
    expect(formatGuestSummaryNumberingBreakdown(1, 0)).toBe("01:女性");
    expect(formatGuestSummaryNumberingBreakdown(0, 0)).toBe("");
  });
});

describe("formatNumberRange", () => {
  it("uses a single number for one-person ranges", () => {
    expect(formatNumberRange(1, 1)).toBe("1");
  });

  it("uses start-end for multi-person ranges", () => {
    expect(formatNumberRange(2, 5)).toBe("2-5");
  });
});

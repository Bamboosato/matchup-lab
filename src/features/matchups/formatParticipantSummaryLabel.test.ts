import { describe, expect, it } from "vitest";
import { formatParticipantSummaryLabel } from "./formatParticipantSummaryLabel";

describe("formatParticipantSummaryLabel", () => {
  it("shows registered-user guest count even when no guests are selected", () => {
    expect(formatParticipantSummaryLabel({ guestCount: 0, isGuest: false, participantCount: 18 })).toBe(
      "18人（ゲスト0人）",
    );
  });

  it("shows registered-user guest count as a participant breakdown", () => {
    expect(formatParticipantSummaryLabel({ guestCount: 4, isGuest: false, participantCount: 18 })).toBe(
      "18人（ゲスト4人）",
    );
  });

  it("shows only participant count for Guest login", () => {
    expect(
      formatParticipantSummaryLabel({
        guestCount: 8,
        isGuest: true,
        participantCount: 8,
      }),
    ).toBe("8人");
  });
});

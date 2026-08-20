import { describe, expect, it } from "vitest";
import { formatParticipantDisplayName, getParticipantGenderMark } from "./formatParticipantDisplayName";

describe("formatParticipantDisplayName", () => {
  it("adds the female marker", () => {
    expect(formatParticipantDisplayName({ name: "佐藤", gender: "female" })).toBe("佐藤\u00a0F");
  });

  it("adds the male marker", () => {
    expect(formatParticipantDisplayName({ name: "鈴木", gender: "male" })).toBe("鈴木\u00a0M");
  });

  it("adds the marker to guest-number display names", () => {
    expect(formatParticipantDisplayName({ name: "ゲスト06", gender: "male" })).toBe("ゲスト06\u00a0M");
    expect(formatParticipantDisplayName({ name: "ゲスト03", gender: "female" })).toBe("ゲスト03\u00a0F");
  });

  it("does not add a marker when gender is absent", () => {
    expect(formatParticipantDisplayName({ name: "Guest" })).toBe("Guest");
  });

  it("returns the ASCII marker independently", () => {
    expect(getParticipantGenderMark("female")).toBe("F");
    expect(getParticipantGenderMark("male")).toBe("M");
    expect(getParticipantGenderMark()).toBe("");
  });
});

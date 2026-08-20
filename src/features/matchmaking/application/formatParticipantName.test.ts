import { describe, expect, it } from "vitest";
import type { Participant } from "../model/types";
import {
  formatPairParticipantNames,
  formatSinglesMatchParticipantNames,
} from "./formatParticipantName";

const participants: Participant[] = [
  { id: "player-01", name: "01", index: 0 },
  { id: "player-04", name: "04", index: 3 },
];

describe("formatPairParticipantNames", () => {
  it("formats doubles pair labels with an ampersand while preserving participant order", () => {
    expect(formatPairParticipantNames(participants, "player-04", "player-01")).toBe("01 & 04");
  });
});

describe("formatSinglesMatchParticipantNames", () => {
  it("keeps singles matchup labels separated with vs", () => {
    expect(formatSinglesMatchParticipantNames(participants, "player-04", "player-01")).toBe(
      "01 vs 04",
    );
  });
});

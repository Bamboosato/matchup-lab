import { describe, expect, it } from "vitest";
import { buildGuestParticipants } from "./buildGuestParticipants";

describe("buildGuestParticipants", () => {
  it("builds Guest login participants with guest-number display by default", () => {
    expect(buildGuestParticipants(2, 2)).toEqual([
      { id: "guest-01", name: "ゲスト01", gender: "female" },
      { id: "guest-02", name: "ゲスト02", gender: "female" },
      { id: "guest-03", name: "ゲスト03", gender: "male" },
      { id: "guest-04", name: "ゲスト04", gender: "male" },
    ]);
  });

  it("builds registered-user additional guests with female-first guest nicknames", () => {
    expect(buildGuestParticipants(2, 1, { idPrefix: "member-guest" })).toEqual([
      { id: "member-guest-01", name: "ゲスト01", gender: "female" },
      { id: "member-guest-02", name: "ゲスト02", gender: "female" },
      { id: "member-guest-03", name: "ゲスト03", gender: "male" },
    ]);
  });

  it("omits empty gender groups while keeping numbering sequential", () => {
    expect(buildGuestParticipants(0, 2, { idPrefix: "member-guest" })).toEqual([
      { id: "member-guest-01", name: "ゲスト01", gender: "male" },
      { id: "member-guest-02", name: "ゲスト02", gender: "male" },
    ]);
  });
});

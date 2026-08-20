import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { buildMatchConditions } from "./buildMatchConditions";

describe("buildMatchConditions", () => {
  it("trims event and participant names while preserving participant order", () => {
    const result = buildMatchConditions({
      eventName: "  週末テニス会  ",
      participantCount: 4,
      courtCount: 1,
      roundCount: 2,
      participants: [
        { id: "p1", name: "  佐藤  " },
        { id: "p2", name: "鈴木" },
        { id: "p3", name: "高橋" },
        { id: "p4", name: "田中" },
      ],
    });

    expect(result.eventName).toBe("週末テニス会");
    expect(result.matchFormat).toBe("doubles");
    expect(result.matchupMode).toBe("standard");
    expect(result.playersPerCourt).toBe(4);
    expect(result.participants).toEqual([
      { id: "p1", name: "佐藤", index: 0 },
      { id: "p2", name: "鈴木", index: 1 },
      { id: "p3", name: "高橋", index: 2 },
      { id: "p4", name: "田中", index: 3 },
    ]);
  });

  it("rejects participant count mismatches", () => {
    expect(() =>
      buildMatchConditions({
        eventName: "test",
        participantCount: 5,
        courtCount: 1,
        roundCount: 1,
        participants: [
          { id: "p1", name: "A" },
          { id: "p2", name: "B" },
          { id: "p3", name: "C" },
          { id: "p4", name: "D" },
        ],
      }),
    ).toThrow(ZodError);
  });

  it("keeps provided gender in standard mode conditions", () => {
    const result = buildMatchConditions({
      eventName: "standard gender",
      matchupMode: "standard",
      participantCount: 4,
      courtCount: 1,
      roundCount: 1,
      participants: [
        { id: "p1", name: "01", gender: "female" },
        { id: "p2", name: "02" },
        { id: "p3", name: "03", gender: "male" },
        { id: "p4", name: "04" },
      ],
    });

    expect(result.matchupMode).toBe("standard");
    expect(result.participants).toEqual([
      { id: "p1", name: "01", index: 0, gender: "female" },
      { id: "p2", name: "02", index: 1 },
      { id: "p3", name: "03", index: 2, gender: "male" },
      { id: "p4", name: "04", index: 3 },
    ]);
  });

  it("uses two players per court for singles conditions", () => {
    const result = buildMatchConditions({
      eventName: "singles",
      matchFormat: "singles",
      matchupMode: "mixedDoublesPriority",
      participantCount: 2,
      courtCount: 1,
      roundCount: 1,
      participants: [
        { id: "p1", name: "01", gender: "female" },
        { id: "p2", name: "02", gender: "male" },
      ],
    });

    expect(result.matchFormat).toBe("singles");
    expect(result.matchupMode).toBe("mixedDoublesPriority");
    expect(result.playersPerCourt).toBe(2);
    expect(result.participants.map((participant) => participant.gender)).toEqual([
      "female",
      "male",
    ]);
  });

  it("rejects doubles with fewer than four participants", () => {
    expect(() =>
      buildMatchConditions({
        eventName: "small doubles",
        matchFormat: "doubles",
        participantCount: 3,
        courtCount: 1,
        roundCount: 1,
        participants: [
          { id: "p1", name: "01" },
          { id: "p2", name: "02" },
          { id: "p3", name: "03" },
        ],
      }),
    ).toThrow(ZodError);
  });

  it("keeps gender for gender-aware modes", () => {
    const result = buildMatchConditions({
      eventName: "gender",
      matchupMode: "mixedDoublesPriority",
      participantCount: 4,
      courtCount: 1,
      roundCount: 1,
      participants: [
        { id: "p1", name: "01", gender: "female" },
        { id: "p2", name: "02", gender: "female" },
        { id: "p3", name: "03", gender: "male" },
        { id: "p4", name: "04", gender: "male" },
      ],
    });

    expect(result.matchupMode).toBe("mixedDoublesPriority");
    expect(result.participants.map((participant) => participant.gender)).toEqual([
      "female",
      "female",
      "male",
      "male",
    ]);
  });

  it("rejects gender-aware modes without participant gender", () => {
    expect(() =>
      buildMatchConditions({
        eventName: "gender",
        matchupMode: "sameGenderPriority",
        participantCount: 4,
        courtCount: 1,
        roundCount: 1,
        participants: [
          { id: "p1", name: "01" },
          { id: "p2", name: "02" },
          { id: "p3", name: "03" },
          { id: "p4", name: "04" },
        ],
      }),
    ).toThrow(ZodError);
  });
});

import { describe, expect, it } from "vitest";
import { buildPdfDocumentModel, buildPdfFileName, type PdfMatchupResult } from "./buildPdfDocumentModel";

describe("buildPdfDocumentModel", () => {
  it("uses gender-marked participant names for registered-user PDF cells", () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "PDF gender markers",
        matchupMode: "standard",
        participants: [
          { id: "p1", name: "佐藤", gender: "female", index: 1 },
          { id: "p2", name: "鈴木", gender: "male", index: 2 },
          { id: "p3", name: "高橋", gender: "female", index: 3 },
          { id: "p4", name: "田中", gender: "male", index: 4 },
          { id: "p5", name: "中村", gender: "female", index: 5 },
        ],
        courtCount: 1,
        roundCount: 1,
      },
      rounds: [
        {
          roundNumber: 1,
          courts: [
            {
              courtNumber: 1,
              pairA: { player1Id: "p1", player2Id: "p2" },
              pairB: { player1Id: "p3", player2Id: "p4" },
            },
          ],
          restPlayerIds: ["p5"],
        },
      ],
      seed: 1234,
    };

    const model = buildPdfDocumentModel(result);
    const court = model.pages[0].rounds[0].courtRows[0][0];

    expect(court?.pairAPlayers).toEqual(["佐藤\u00a0F", "鈴木\u00a0M"]);
    expect(court?.pairBPlayers).toEqual(["高橋\u00a0F", "田中\u00a0M"]);
    expect(model.pages[0].rounds[0].restCell).toBe("中村\u00a0F");
  });

  it("uses gender-marked additional guest names for registered-user PDF cells", () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "PDF guest markers",
        matchupMode: "standard",
        participants: [
          { id: "member-guest-01", name: "ゲスト01", gender: "female", index: 1 },
          { id: "member-guest-02", name: "ゲスト02", gender: "female", index: 2 },
          { id: "member-guest-03", name: "ゲスト03", gender: "male", index: 3 },
          { id: "member-guest-04", name: "ゲスト04", gender: "male", index: 4 },
        ],
        courtCount: 1,
        roundCount: 1,
      },
      rounds: [
        {
          roundNumber: 1,
          courts: [
            {
              courtNumber: 1,
              pairA: { player1Id: "member-guest-01", player2Id: "member-guest-03" },
              pairB: { player1Id: "member-guest-02", player2Id: "member-guest-04" },
            },
          ],
          restPlayerIds: [],
        },
      ],
      seed: 5678,
    };

    const model = buildPdfDocumentModel(result);
    const court = model.pages[0].rounds[0].courtRows[0][0];

    expect(court?.pairAPlayers).toEqual(["ゲスト01\u00a0F", "ゲスト03\u00a0M"]);
    expect(court?.pairBPlayers).toEqual(["ゲスト02\u00a0F", "ゲスト04\u00a0M"]);
  });

  it("uses the regular PDF layout model for Guest login participants", () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "",
        matchupMode: "standard",
        participants: [
          { id: "guest-01", name: "ゲスト01", gender: "female", index: 1 },
          { id: "guest-02", name: "ゲスト02", gender: "female", index: 2 },
          { id: "guest-03", name: "ゲスト03", gender: "female", index: 3 },
          { id: "guest-04", name: "ゲスト04", gender: "female", index: 4 },
          { id: "guest-05", name: "ゲスト05", gender: "male", index: 5 },
          { id: "guest-06", name: "ゲスト06", gender: "male", index: 6 },
          { id: "guest-07", name: "ゲスト07", gender: "male", index: 7 },
          { id: "guest-08", name: "ゲスト08", gender: "male", index: 8 },
        ],
        courtCount: 3,
        roundCount: 1,
      },
      rounds: [
        {
          roundNumber: 1,
          courts: [
            {
              courtNumber: 1,
              pairA: { player1Id: "guest-01", player2Id: "guest-05" },
              pairB: { player1Id: "guest-02", player2Id: "guest-06" },
            },
            {
              courtNumber: 2,
              pairA: { player1Id: "guest-03", player2Id: "guest-04" },
              pairB: { player1Id: "guest-07", player2Id: "guest-08" },
            },
            {
              courtNumber: 3,
              pairA: { player1Id: "guest-01", player2Id: "guest-02" },
              pairB: { player1Id: "guest-05", player2Id: "guest-06" },
            },
          ],
          restPlayerIds: ["guest-08", "guest-07"],
        },
      ],
      seed: 9012,
    };

    const model = buildPdfDocumentModel(result);
    const round = model.pages[0].rounds[0];

    expect(model.eventName).toBe("MatchupLab");
    expect(round.courtRows).toHaveLength(2);
    expect(round.courtRows[0][0]?.courtNumber).toBe(1);
    expect(round.courtRows[0][1]?.courtNumber).toBe(2);
    expect(round.courtRows[1][0]?.courtNumber).toBe(3);
    expect(round.courtRows[1][1]).toBeNull();
    expect(round.courtRows[1][0]?.pairAPlayers).toEqual(["ゲスト01\u00a0F", "ゲスト02\u00a0F"]);
    expect(round.courtRows[1][0]?.pairBPlayers).toEqual(["ゲスト05\u00a0M", "ゲスト06\u00a0M"]);
    expect(round.restCell).toBe("ゲスト07\u00a0M, ゲスト08\u00a0M");
  });

  it("formats singles matches with gender-marked participant names", () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "シングルス会",
        matchFormat: "singles",
        matchupMode: "standard",
        playersPerCourt: 2,
        participants: [
          { id: "guest-01", name: "ゲスト01", gender: "female", index: 1 },
          { id: "guest-02", name: "ゲスト02", gender: "male", index: 2 },
          { id: "guest-03", name: "ゲスト03", gender: "female", index: 3 },
        ],
        courtCount: 1,
        roundCount: 1,
      },
      rounds: [
        {
          roundNumber: 1,
          courts: [
            {
              courtNumber: 1,
              pairA: null,
              pairB: null,
              singlesMatch: { player1Id: "guest-01", player2Id: "guest-02" },
            },
          ],
          restPlayerIds: ["guest-03"],
        },
      ],
      seed: 2468,
    };

    const model = buildPdfDocumentModel(result);
    const court = model.pages[0].rounds[0].courtRows[0][0];

    expect(model.matchFormat).toBe("singles");
    expect(court?.singlesMatchLabel).toBe("ゲスト01\u00a0F vs ゲスト02\u00a0M");
    expect(court?.pairAPlayers).toEqual([]);
    expect(court?.pairBPlayers).toEqual([]);
    expect(model.pages[0].rounds[0].restCell).toBe("ゲスト03\u00a0F");
    expect(buildPdfFileName(result)).toBe("シングルス会_3人_1面_シングルス-matchup.pdf");
  });
});

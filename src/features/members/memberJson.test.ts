import { describe, expect, it } from "vitest";
import type { Member } from "./model";
import { parseMemberBackup, serializeMemberBackup } from "./memberJson";

const member: Member = {
  id: "member-1",
      nickname: "佐藤",
  fullName: "佐藤 太郎",
  gender: "male",
  note: "",
  sortKeyKana: "さとう",
  status: "active",
  displayOrder: 1,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

describe("member JSON backup", () => {
  it("serializes and parses a backup with metadata", () => {
    const raw = serializeMemberBackup([member], "0.1.0", "2026-08-20T01:00:00.000Z");
    const result = parseMemberBackup(raw);

    expect(result).toMatchObject({ state: "success", count: 1 });
    if (result.state !== "success") return;
    expect(result.backup).toMatchObject({
      schemaVersion: 1,
      appVersion: "0.1.0",
      exportedAt: "2026-08-20T01:00:00.000Z",
      members: [member],
    });
  });

  it("accepts an empty backup as a zero-record replacement", () => {
    expect(parseMemberBackup(serializeMemberBackup([], "0.1.0"))).toMatchObject({
      state: "success",
      count: 0,
    });
  });

  it.each([
    ["{ broken", "JSON_PARSE_ERROR"],
    [JSON.stringify({ schemaVersion: 2, members: [] }), "BACKUP_SCHEMA_UNSUPPORTED"],
    [JSON.stringify({ schemaVersion: 1, appVersion: "0.1.0", exportedAt: "now", members: [member, member] }), "BACKUP_DUPLICATE_ID"],
    [JSON.stringify({ schemaVersion: 1, appVersion: "0.1.0", exportedAt: "now", members: [{ ...member, gender: "unknown" }] }), "BACKUP_MEMBER_INVALID"],
  ])("rejects invalid input without producing a backup", (raw, code) => {
    expect(parseMemberBackup(raw)).toMatchObject({ state: "error", code });
  });
});

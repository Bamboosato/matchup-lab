import { beforeEach, describe, expect, it } from "vitest";
import { indexedDB } from "fake-indexeddb";
import type { Member } from "./model";
import { createMemberRepository } from "./memberRepository";

let databaseNumber = 0;

function createRepository() {
  databaseNumber += 1;
  return createMemberRepository(indexedDB, { databaseName: `matchup-lab-test-${databaseNumber}` });
}

const input = {
  nickname: "  佐藤  ",
  fullName: "佐藤 太郎",
  gender: "male" as const,
  note: "  メモ  ",
};

describe("IndexedDB member repository", () => {
  beforeEach(() => {
    databaseNumber += 1;
  });

  it("creates, lists, updates, and deletes members", async () => {
    const repository = createRepository();
    const created = await repository.addMember(input, 0);

    expect(created.nickname).toBe("佐藤");
    expect(created.note).toBe("メモ");
    expect(created.status).toBe("active");
    expect((await repository.listMembers()).map((member) => member.id)).toEqual([created.id]);

    const updated = await repository.updateMember(created.id, { ...input, nickname: "鈴木" });
    expect(updated.nickname).toBe("鈴木");
    await repository.deleteMember(created.id);

    expect(await repository.listMembers()).toEqual([]);
  });

  it("notifies subscribers after local writes and supports unsubscribe", async () => {
    const repository = createRepository();
    const snapshots: Member[][] = [];
    const unsubscribe = repository.subscribeMembers((members) => snapshots.push(members));
    await repository.addMember(input, 0);

    expect(snapshots.at(-1)).toHaveLength(1);
    unsubscribe();
    await repository.addMember({ ...input, nickname: "鈴木" }, 1);
    expect(snapshots.at(-1)).toHaveLength(1);
  });

  it("replaces all members and allows an explicit empty replacement", async () => {
    const repository = createRepository();
    const first = await repository.addMember(input, 0);
    const replacement: Member = {
      ...first,
      id: "restored-member",
      nickname: "復元メンバー",
    };

    await repository.replaceAllMembers([replacement]);
    expect(await repository.listMembers()).toEqual([replacement]);
    await repository.replaceAllMembers([]);
    expect(await repository.listMembers()).toEqual([]);
  });

  it("keeps the old data when replacement validation or transaction fails", async () => {
    const repository = createRepository();
    const existing = await repository.addMember(input, 0);
    const invalid = { ...existing, id: undefined } as unknown as Member;

    await expect(repository.replaceAllMembers([invalid])).rejects.toBeTruthy();
    expect(await repository.listMembers()).toEqual([existing]);
  });

  it("rejects a new member when the active-member limit is reached", async () => {
    const repository = createRepository();
    await expect(repository.addMember(input, 99)).rejects.toThrow("最大99人");
  });
});

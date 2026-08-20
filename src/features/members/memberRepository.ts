import type { Member, MemberFormInput } from "./model";
import { buildSortKeyKana } from "./sortKeyKana";

export const MEMBER_DATABASE_NAME = "matchup-lab";
export const MEMBER_DATABASE_VERSION = 1;
export const MEMBER_STORE_NAME = "members";
export const MAX_ACTIVE_MEMBERS = 99;

type MemberRepositoryOptions = {
  databaseName?: string;
  databaseVersion?: number;
};

export type MemberRepository = {
  listMembers: () => Promise<Member[]>;
  addMember: (input: MemberFormInput, activeMemberCount: number) => Promise<Member>;
  updateMember: (memberId: string, input: MemberFormInput) => Promise<Member>;
  deleteMember: (memberId: string) => Promise<void>;
  replaceAllMembers: (members: Member[]) => Promise<void>;
  subscribeMembers: (
    onChange: (members: Member[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
};

export function createMemberRepository(
  indexedDb: IDBFactory = getIndexedDbFactory(),
  options: MemberRepositoryOptions = {},
): MemberRepository {
  const databaseName = options.databaseName ?? MEMBER_DATABASE_NAME;
  const databaseVersion = options.databaseVersion ?? MEMBER_DATABASE_VERSION;
  let databasePromise: Promise<IDBDatabase> | null = null;
  const listeners = new Set<(members: Member[]) => void>();

  const getDatabase = (): Promise<IDBDatabase> => {
    databasePromise ??= openDatabase(indexedDb, databaseName, databaseVersion);
    return databasePromise;
  };

  async function listMembers(): Promise<Member[]> {
    const database = await getDatabase();
    const transaction = database.transaction(MEMBER_STORE_NAME, "readonly");
    const completion = transactionToPromise(transaction);
    const members = await requestToPromise<Member[]>(transaction.objectStore(MEMBER_STORE_NAME).getAll());
    await completion;
    return members.sort((left, right) => left.displayOrder - right.displayOrder);
  }

  async function addMember(input: MemberFormInput, activeMemberCount: number): Promise<Member> {
    if (activeMemberCount >= MAX_ACTIVE_MEMBERS) {
      throw new Error("登録できるメンバーは最大99人です。");
    }

    const now = new Date().toISOString();
    const currentMembers = await listMembers();
    const member: Member = {
      id: createEntityId(),
      ...normalizeMemberInput(input),
      status: "active",
      displayOrder: nextDisplayOrder(currentMembers),
      createdAt: now,
      updatedAt: now,
    };

    const database = await getDatabase();
    const transaction = database.transaction(MEMBER_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(MEMBER_STORE_NAME).put(member);
    await completion;
    await notifyListeners();
    return member;
  }

  async function updateMember(memberId: string, input: MemberFormInput): Promise<Member> {
    const database = await getDatabase();
    const transaction = database.transaction(MEMBER_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    const store = transaction.objectStore(MEMBER_STORE_NAME);
    const current = await requestToPromise<Member | undefined>(store.get(memberId));

    if (!current) {
      transaction.abort();
      throw new Error("対象のメンバーが見つかりません。");
    }

    const updated: Member = {
      ...current,
      ...normalizeMemberInput(input),
      updatedAt: new Date().toISOString(),
    };
    store.put(updated);
    await completion;
    await notifyListeners();
    return updated;
  }

  async function deleteMember(memberId: string): Promise<void> {
    const database = await getDatabase();
    const transaction = database.transaction(MEMBER_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    const store = transaction.objectStore(MEMBER_STORE_NAME);
    const current = await requestToPromise<Member | undefined>(store.get(memberId));

    if (!current) {
      transaction.abort();
      throw new Error("対象のメンバーが見つかりません。");
    }

    store.delete(memberId);
    await completion;
    await notifyListeners();
  }

  async function replaceAllMembers(members: Member[]): Promise<void> {
    assertUniqueMemberIds(members);
    const database = await getDatabase();
    const transaction = database.transaction(MEMBER_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    const store = transaction.objectStore(MEMBER_STORE_NAME);
    store.clear();
    for (const member of members) {
      store.put(member);
    }
    await completion;

    const verificationTransaction = database.transaction(MEMBER_STORE_NAME, "readonly");
    const storedKeys = await requestToPromise<IDBValidKey[]>(
      verificationTransaction.objectStore(MEMBER_STORE_NAME).getAllKeys(),
    );
    if (storedKeys.length !== members.length) {
      throw new Error("IndexedDBへの全件保存を確認できませんでした。");
    }
    await notifyListeners();
  }

  function subscribeMembers(
    onChange: (members: Member[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    let active = true;
    const listener = (members: Member[]) => {
      if (active) onChange(members);
    };
    listeners.add(listener);
    void listMembers().then(listener).catch((error: unknown) => {
      if (active) onError?.(toError(error));
    });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }

  async function notifyListeners(): Promise<void> {
    if (listeners.size === 0) return;
    const members = await listMembers();
    for (const listener of listeners) listener(members);
  }

  return { listMembers, addMember, updateMember, deleteMember, replaceAllMembers, subscribeMembers };
}

let defaultRepository: MemberRepository | null = null;

function getDefaultRepository(): MemberRepository {
  defaultRepository ??= createMemberRepository();
  return defaultRepository;
}

export function listMembers(): Promise<Member[]> {
  return getDefaultRepository().listMembers();
}

export function addMember(input: MemberFormInput, activeMemberCount: number): Promise<Member> {
  return getDefaultRepository().addMember(input, activeMemberCount);
}

export function updateMember(memberId: string, input: MemberFormInput): Promise<Member> {
  return getDefaultRepository().updateMember(memberId, input);
}

export function deleteMember(memberId: string): Promise<void> {
  return getDefaultRepository().deleteMember(memberId);
}

export function replaceAllMembers(members: Member[]): Promise<void> {
  return getDefaultRepository().replaceAllMembers(members);
}

export function subscribeMembers(
  onChange: (members: Member[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return getDefaultRepository().subscribeMembers(onChange, onError);
}

function getIndexedDbFactory(): IDBFactory {
  if (typeof globalThis.indexedDB === "undefined") {
    throw new Error("このブラウザではIndexedDBを利用できません。");
  }
  return globalThis.indexedDB;
}

function openDatabase(indexedDb: IDBFactory, databaseName: string, databaseVersion: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEMBER_STORE_NAME)) {
        database.createObjectStore(MEMBER_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
    request.onblocked = () => reject(new Error("IndexedDBの更新がほかのタブによりブロックされています。"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB操作に失敗しました。"));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDBトランザクションが中断されました。"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDBトランザクションに失敗しました。"));
  });
}

function normalizeMemberInput(input: MemberFormInput) {
  const nickname = input.nickname.trim();
  if (!nickname) throw new Error("ニックネームを入力してください。");
  return {
    nickname,
    fullName: input.fullName.trim(),
    gender: input.gender,
    note: input.note.trim(),
    sortKeyKana: buildSortKeyKana(nickname),
  };
}

function nextDisplayOrder(members: Member[]): number {
  return Math.max(0, ...members.map((member) => member.displayOrder)) + 1;
}

function assertUniqueMemberIds(members: Member[]): void {
  const ids = new Set<string>();
  for (const member of members) {
    if (typeof member.id !== "string" || !member.id.trim()) {
      throw new Error("メンバーIDは必須です。");
    }
    if (ids.has(member.id)) throw new Error("メンバーIDが重複しています。");
    ids.add(member.id);
  }
}

function createEntityId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `member-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("IndexedDB操作に失敗しました。");
}

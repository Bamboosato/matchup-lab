import { z } from "zod";
import type { Member } from "./model";

export const MEMBER_BACKUP_SCHEMA_VERSION = 1 as const;

const memberSchema = z.object({
  id: z.string().trim().min(1),
  nickname: z.string().trim().min(1),
  fullName: z.string(),
  gender: z.enum(["female", "male"]),
  note: z.string(),
  sortKeyKana: z.string(),
  status: z.enum(["active", "inactive"]),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deactivatedAt: z.string().min(1).optional(),
});

const memberBackupSchema = z.object({
  schemaVersion: z.literal(MEMBER_BACKUP_SCHEMA_VERSION),
  appVersion: z.string().trim().min(1),
  exportedAt: z.string().min(1),
  members: z.array(memberSchema),
});

export type MemberBackup = {
  schemaVersion: typeof MEMBER_BACKUP_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: string;
  members: Member[];
};

export type MemberImportErrorCode =
  | "JSON_PARSE_ERROR"
  | "BACKUP_SCHEMA_UNSUPPORTED"
  | "BACKUP_REQUIRED_FIELD_INVALID"
  | "BACKUP_DUPLICATE_ID"
  | "BACKUP_MEMBER_INVALID";

export type MemberImportResult =
  | { state: "success"; backup: MemberBackup; count: number }
  | { state: "error"; code: MemberImportErrorCode; message: string };

export function serializeMemberBackup(
  members: Member[],
  appVersion: string,
  exportedAt = new Date().toISOString(),
): string {
  const backup: MemberBackup = {
    schemaVersion: MEMBER_BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    members,
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parseMemberBackup(raw: string): MemberImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: "error", code: "JSON_PARSE_ERROR", message: "JSONの形式を確認してください。" };
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== MEMBER_BACKUP_SCHEMA_VERSION) {
    return {
      state: "error",
      code: "BACKUP_SCHEMA_UNSUPPORTED",
      message: "未対応のバックアップバージョンです。",
    };
  }

  const result = memberBackupSchema.safeParse(parsed);
  if (!result.success) {
    const code = result.error.issues.some((issue) => issue.path[0] === "members")
      ? "BACKUP_MEMBER_INVALID"
      : "BACKUP_REQUIRED_FIELD_INVALID";
    return { state: "error", code, message: "バックアップの必須項目またはデータ型を確認してください。" };
  }

  const members = result.data.members as Member[];
  if (new Set(members.map((member) => member.id)).size !== members.length) {
    return { state: "error", code: "BACKUP_DUPLICATE_ID", message: "メンバーIDが重複しています。" };
  }

  if (members.filter((member) => member.status === "active").length > 99) {
    return { state: "error", code: "BACKUP_MEMBER_INVALID", message: "有効メンバーは99人以下にしてください。" };
  }

  return { state: "success", backup: { ...result.data, members }, count: members.length };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

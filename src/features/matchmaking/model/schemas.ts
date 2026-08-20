import { z } from "zod";
import { MATCH_CONDITION_LIMITS } from "./limits";

export const matchFormatSchema = z.enum(["doubles", "singles"]);

export const matchupModeSchema = z.enum([
  "standard",
  "sameGenderPriority",
  "mixedDoublesPriority",
]);

export const participantGenderSchema = z.enum(["female", "male"]);

export const participantInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "参加者名を入力してください"),
  gender: participantGenderSchema.optional(),
});

export const matchConditionInputSchema = z
  .object({
    eventName: z.string().trim().optional(),
    matchFormat: matchFormatSchema.default("doubles"),
    matchupMode: matchupModeSchema.default("standard"),
    participantCount: z
      .number({ message: "参加人数を入力してください" })
      .int("参加人数は整数で入力してください")
      .min(MATCH_CONDITION_LIMITS.participantCount.singlesMin, "参加者は2人以上必要です")
      .max(MATCH_CONDITION_LIMITS.participantCount.max, "参加人数は30人以下にしてください"),
    participants: z.array(participantInputSchema),
    courtCount: z
      .number({ message: "コート数を入力してください" })
      .int("コート数は整数で入力してください")
      .min(MATCH_CONDITION_LIMITS.courtCount.min, "コート数は1以上にしてください")
      .max(MATCH_CONDITION_LIMITS.courtCount.max, "コート数は8以下にしてください"),
    roundCount: z
      .number({ message: "ラウンド数を入力してください" })
      .int("ラウンド数は整数で入力してください")
      .min(MATCH_CONDITION_LIMITS.roundCount.min, "ラウンド数は1以上にしてください")
      .max(MATCH_CONDITION_LIMITS.roundCount.max, "ラウンド数は20回以下にしてください"),
  })
  .superRefine((value, ctx) => {
    if (value.participants.length !== value.participantCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "参加者一覧の件数が参加人数と一致していません",
      });
    }

    if (
      value.matchFormat === "doubles" &&
      value.participantCount < MATCH_CONDITION_LIMITS.participantCount.doublesMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participantCount"],
        message: "ダブルスでは参加者は4人以上必要です",
      });
    }

    if (
      value.matchFormat === "doubles" &&
      value.matchupMode !== "standard" &&
      value.participants.some((participant) => !participant.gender)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "同性対決優先・混合対決優先では参加者の性別が必要です",
      });
    }
  });

export type MatchConditionInputSchema = z.infer<typeof matchConditionInputSchema>;

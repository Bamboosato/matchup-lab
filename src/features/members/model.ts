export type Gender = "female" | "male";

export type MemberStatus = "active" | "inactive";

export type Member = {
  id: string;
  nickname: string;
  fullName: string;
  gender: Gender;
  note: string;
  sortKeyKana: string;
  status: MemberStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
};

export type MemberFormInput = {
  nickname: string;
  fullName: string;
  gender: Gender;
  note: string;
};

export const emptyMemberForm: MemberFormInput = {
  nickname: "",
  fullName: "",
  gender: "female",
  note: "",
};

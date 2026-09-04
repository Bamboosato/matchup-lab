"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import packageJson from "../../package.json";
import {
  ChevronDown,
  EllipsisVertical,
  FileDown,
  FileUp,
  Menu,
  Minus,
  Pencil,
  Plus,
  Save,
  Swords,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { buildGuestParticipants } from "@/features/guests/buildGuestParticipants";
import { formatGuestSummaryNumberingBreakdown } from "@/features/guests/formatGuestNumberingBreakdown";
import { generateMatchupLocally } from "@/features/matchups/generateMatchupLocally";
import { formatParticipantDisplayName } from "@/features/matchups/formatParticipantDisplayName";
import { formatParticipantSummaryLabel } from "@/features/matchups/formatParticipantSummaryLabel";
import {
  addMember,
  deleteMember,
  replaceAllMembers,
  subscribeMembers,
  updateMember,
} from "@/features/members/memberRepository";
import { parseMemberBackup, serializeMemberBackup, type MemberBackup } from "@/features/members/memberJson";
import { emptyMemberForm, type Member, type MemberFormInput } from "@/features/members/model";
import { useMatchupPdfExport } from "@/hooks/useMatchupPdfExport";
import { PwaStatus } from "@/components/pwa/PwaStatus";
import { APP_FAVICON_SRC } from "@/lib/constants/assets";

type MatchupMode = "standard" | "sameGenderPriority" | "mixedDoublesPriority";
type MatchFormat = "doubles" | "singles";
type AppRoute = "home" | "members" | "doubles" | "singles" | "unknown";
type SortMode = "registered" | "kana";

const SORT_MODE_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: "新しい順", value: "registered" },
  { label: "ニックネーム", value: "kana" },
];

const APP_VERSION = packageJson.version;
const PARTICIPANT_COUNT_MAX = 30;
const GENDER_COUNT_MIN = 0;
const COURT_COUNT_MIN = 1;
const COURT_COUNT_MAX = 8;
const ROUND_COUNT_MIN = 1;
const ROUND_COUNT_MAX = 20;
const MATCH_FORMAT_CONFIG: Record<
  MatchFormat,
  {
    conditionIntro: string;
    defaultCourtCount: string;
    defaultGuestFemaleCount: string;
    defaultGuestMaleCount: string;
    participantMin: number;
    playersPerCourt: 2 | 4;
  }
> = {
  doubles: {
    conditionIntro: "メンバー選択（選択or人数入力）、コート数、実施回数、対戦モードを指定します。",
    defaultCourtCount: "2",
    defaultGuestFemaleCount: "4",
    defaultGuestMaleCount: "4",
    participantMin: 4,
    playersPerCourt: 4,
  },
  singles: {
    conditionIntro: "メンバー選択（選択or人数入力）、コート数、実施回数を指定します。",
    defaultCourtCount: "2",
    defaultGuestFemaleCount: "4",
    defaultGuestMaleCount: "4",
    participantMin: 2,
    playersPerCourt: 2,
  },
};
type MatchupParticipant = {
  id: string;
  name: string;
  gender?: "female" | "male";
  index?: number;
};
type MatchupPair = {
  player1Id: string;
  player2Id: string;
};
type MatchupSinglesMatch = {
  player1Id: string;
  player2Id: string;
};
type MatchupCourt = {
  courtNumber: number;
  pairA?: MatchupPair | null;
  pairB?: MatchupPair | null;
  singlesMatch?: MatchupSinglesMatch | null;
  isUnused?: boolean;
};
type MatchupRound = {
  roundNumber: number;
  courts: MatchupCourt[];
  restPlayerIds: string[];
};
type MatchupResult = {
  conditions: {
    eventName?: string;
    matchFormat?: MatchFormat;
    matchupMode?: MatchupMode;
    participants: MatchupParticipant[];
    courtCount: number;
    roundCount: number;
    playersPerCourt?: 2 | 4;
  };
  rounds: MatchupRound[];
  seed: number;
};
type GenerateMatchupPayload = {
  eventName: string;
  matchFormat: MatchFormat;
  matchupMode: MatchupMode;
  participantCount: number;
  participants: MatchupParticipant[];
  courtCount: number;
  roundCount: number;
};
type CourtReductionConfirmation = {
  payload: GenerateMatchupPayload;
  requestedCourtCount: number;
  usableCourtCount: number;
};
type MatchupScreenState = {
  courtCount: string;
  courtReductionConfirmation: CourtReductionConfirmation | null;
  draftGuestFemaleCount: string;
  draftGuestMaleCount: string;
  draftMemberGuestFemaleCount: string;
  draftMemberGuestMaleCount: string;
  draftSelectedMemberIds: string[];
  eventName: string;
  guestFemaleCount: string;
  guestMaleCount: string;
  isMatchupGenerating: boolean;
  memberGuestFemaleCount: string;
  memberGuestMaleCount: string;
  memberSelectionError: string;
  matchupError: string;
  matchupMode: MatchupMode;
  matchupResult: MatchupResult | null;
  memberSelectionOpen: boolean;
  roundCount: string;
  selectedMemberIds: string[];
};

function createInitialMatchupScreenState(matchFormat: MatchFormat): MatchupScreenState {
  const config = MATCH_FORMAT_CONFIG[matchFormat];

  return {
    courtCount: config.defaultCourtCount,
    courtReductionConfirmation: null,
    draftGuestFemaleCount: config.defaultGuestFemaleCount,
    draftGuestMaleCount: config.defaultGuestMaleCount,
    draftMemberGuestFemaleCount: "0",
    draftMemberGuestMaleCount: "0",
    draftSelectedMemberIds: [],
    eventName: "",
    guestFemaleCount: config.defaultGuestFemaleCount,
    guestMaleCount: config.defaultGuestMaleCount,
    isMatchupGenerating: false,
    memberGuestFemaleCount: "0",
    memberGuestMaleCount: "0",
    memberSelectionError: "",
    matchupError: "",
    matchupMode: "standard",
    matchupResult: null,
    memberSelectionOpen: false,
    roundCount: "4",
    selectedMemberIds: [],
  };
}

function createInitialMatchupStates(): Record<MatchFormat, MatchupScreenState> {
  return {
    doubles: createInitialMatchupScreenState("doubles"),
    singles: createInitialMatchupScreenState("singles"),
  };
}

function pruneMatchupMemberSelections(
  states: Record<MatchFormat, MatchupScreenState>,
  activeMemberIds: ReadonlySet<string>,
): Record<MatchFormat, MatchupScreenState> {
  let changed = false;
  const nextStates = { ...states };

  for (const matchFormat of ["doubles", "singles"] as const) {
    const current = states[matchFormat];
    const selectedMemberIds = current.selectedMemberIds.filter((memberId) => activeMemberIds.has(memberId));
    const draftSelectedMemberIds = current.draftSelectedMemberIds.filter((memberId) => activeMemberIds.has(memberId));

    if (
      selectedMemberIds.length === current.selectedMemberIds.length &&
      draftSelectedMemberIds.length === current.draftSelectedMemberIds.length
    ) {
      continue;
    }

    nextStates[matchFormat] = {
      ...current,
      draftSelectedMemberIds,
      selectedMemberIds,
    };
    changed = true;
  }

  return changed ? nextStates : states;
}

function getAppRoute(pathname: string | null): AppRoute {
  switch (pathname) {
    case "/":
      return "home";
    case "/members":
      return "members";
    case "/matchups/doubles":
      return "doubles";
    case "/matchups/singles":
      return "singles";
    default:
      return "unknown";
  }
}

export function AppClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const appRoute = getAppRoute(pathname);
  const user = { isAnonymous: false };
  const [memberState, setMemberState] = useState<{ members: Member[]; uid: string }>({
    members: [],
    uid: "local",
  });
  const [memberForm, setMemberForm] = useState<MemberFormInput>(emptyMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [memberDeleteTarget, setMemberDeleteTarget] = useState<Member | null>(null);
  const [memberError, setMemberError] = useState("");
  const [memberBackupError, setMemberBackupError] = useState("");
  const [memberBackupNotice, setMemberBackupNotice] = useState("");
  const [memberBackupConfirmation, setMemberBackupConfirmation] = useState<
    { backup: MemberBackup; count: number } | null
  >(null);
  const [sortMode, setSortMode] = useState<SortMode>("registered");
  const [matchupStates, setMatchupStates] = useState<Record<MatchFormat, MatchupScreenState>>(
    createInitialMatchupStates,
  );
  const [isMatchupCompleteToastVisible, setIsMatchupCompleteToastVisible] = useState(false);
  const { clearPdfError, exportPdf, isExportingPdf, pdfErrorMessage } = useMatchupPdfExport();

  useEffect(() => {
    return subscribeMembers(
      (nextMembers) => {
        setMemberError("");
        setMemberState({
          members: nextMembers,
          uid: "local",
        });
        const activeMemberIds = new Set(
          nextMembers.filter((member) => member.status === "active").map((member) => member.id),
        );
        setMatchupStates((current) => pruneMatchupMemberSelections(current, activeMemberIds));
      },
      (error) => {
        setMemberError(toMessage(error, "メンバー一覧を取得できませんでした。"));
      },
    );
  }, []);

  useEffect(() => {
    if (!isMatchupCompleteToastVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsMatchupCompleteToastVisible(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isMatchupCompleteToastVisible]);

  useEffect(() => {
    if (!memberBackupNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMemberBackupNotice("");
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [memberBackupNotice]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const members = useMemo(
    () => (memberState.uid === "local" ? memberState.members : []),
    [memberState],
  );
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const sortedMembers = useMemo(() => {
    return [...activeMembers].sort((left, right) => {
      if (sortMode === "registered") {
        return right.displayOrder - left.displayOrder;
      }

      const leftKey = left.sortKeyKana || left.nickname;
      const rightKey = right.sortKeyKana || right.nickname;

      return leftKey.localeCompare(rightKey, "ja");
    });
  }, [activeMembers, sortMode]);

  function cancelMemberEdit() {
    setMemberForm(emptyMemberForm);
    setEditingMemberId(null);
    setMemberError("");
    setIsMemberFormOpen(false);
  }

  function startMemberRegistration() {
    setMemberForm(emptyMemberForm);
    setEditingMemberId(null);
    setMemberError("");
    setIsMemberFormOpen(true);
  }

  function handleExportMemberBackup() {
    setMemberBackupError("");
    setMemberBackupNotice("");

    const blob = new Blob([serializeMemberBackup(members, APP_VERSION)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matchuplab-members-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportMemberBackup(file: File) {
    setMemberBackupError("");
    setMemberBackupNotice("");
    setMemberBackupConfirmation(null);

    const result = parseMemberBackup(await file.text());
    if (result.state === "error") {
      setMemberBackupError(result.message);
      return;
    }

    setMemberBackupConfirmation({ backup: result.backup, count: result.count });
  }

  async function confirmMemberBackupRestore() {
    const confirmation = memberBackupConfirmation;
    if (!confirmation) {
      return;
    }

    setMemberBackupConfirmation(null);

    try {
      await replaceAllMembers(confirmation.backup.members);
      setMemberBackupNotice(`${confirmation.count}件のメンバーを復元しました。`);
    } catch (error) {
      setMemberBackupError(toMessage(error, "バックアップを復元できませんでした。"));
    }
  }

  function updateMatchupState(
    matchFormat: MatchFormat,
    updater: (current: MatchupScreenState) => MatchupScreenState,
  ) {
    setMatchupStates((current) => ({
      ...current,
      [matchFormat]: updater(current[matchFormat]),
    }));
  }

  function patchMatchupState(matchFormat: MatchFormat, patch: Partial<MatchupScreenState>) {
    updateMatchupState(matchFormat, (current) => ({
      ...current,
      ...patch,
    }));
  }

  function selectedMembersForState(state: MatchupScreenState) {
    return activeMembers.filter((member) => state.selectedMemberIds.includes(member.id));
  }

  function openMemberSelection(matchFormat: MatchFormat) {
    if (!user) {
      return;
    }

    const state = matchupStates[matchFormat];

    if (user.isAnonymous) {
      patchMatchupState(matchFormat, {
        draftGuestFemaleCount: state.guestFemaleCount,
        draftGuestMaleCount: state.guestMaleCount,
        memberSelectionError: "",
        memberSelectionOpen: true,
      });
      return;
    }

    const activeMemberIds = new Set(activeMembers.map((member) => member.id));

    patchMatchupState(matchFormat, {
      draftSelectedMemberIds: state.selectedMemberIds.filter((memberId) => activeMemberIds.has(memberId)),
      draftMemberGuestFemaleCount: state.memberGuestFemaleCount,
      draftMemberGuestMaleCount: state.memberGuestMaleCount,
      memberSelectionError: "",
      memberSelectionOpen: true,
    });
  }

  function cancelMemberSelection(matchFormat: MatchFormat) {
    const state = matchupStates[matchFormat];

    if (user?.isAnonymous) {
      patchMatchupState(matchFormat, {
        draftGuestFemaleCount: state.guestFemaleCount,
        draftGuestMaleCount: state.guestMaleCount,
        memberSelectionError: "",
        memberSelectionOpen: false,
      });
    } else {
      patchMatchupState(matchFormat, {
        draftSelectedMemberIds: state.selectedMemberIds,
        draftMemberGuestFemaleCount: state.memberGuestFemaleCount,
        draftMemberGuestMaleCount: state.memberGuestMaleCount,
        memberSelectionError: "",
        memberSelectionOpen: false,
      });
    }
  }

  function confirmMemberSelection(matchFormat: MatchFormat) {
    const state = matchupStates[matchFormat];

    if (user?.isAnonymous) {
      patchMatchupState(matchFormat, {
        guestFemaleCount: state.draftGuestFemaleCount,
        guestMaleCount: state.draftGuestMaleCount,
        memberSelectionError: "",
        memberSelectionOpen: false,
      });
    } else {
      const draftGuestCount =
        toDisplayCount(state.draftMemberGuestFemaleCount) + toDisplayCount(state.draftMemberGuestMaleCount);

      if (state.draftSelectedMemberIds.length + draftGuestCount > PARTICIPANT_COUNT_MAX) {
        patchMatchupState(matchFormat, { memberSelectionError: "ゲスト含めて30人を超えています。" });
        return;
      }

      patchMatchupState(matchFormat, {
        selectedMemberIds: state.draftSelectedMemberIds,
        memberGuestFemaleCount: state.draftMemberGuestFemaleCount,
        memberGuestMaleCount: state.draftMemberGuestMaleCount,
        memberSelectionError: "",
        memberSelectionOpen: false,
      });
    }
  }

  function toggleDraftMemberSelection(matchFormat: MatchFormat, memberId: string) {
    updateMatchupState(matchFormat, (current) => {
      const draftSelectedMemberIds = current.draftSelectedMemberIds.includes(memberId)
        ? current.draftSelectedMemberIds.filter((id) => id !== memberId)
        : [...current.draftSelectedMemberIds, memberId];

      return {
        ...current,
        draftSelectedMemberIds,
        memberSelectionError: "",
      };
    });
  }

  function clearDraftMemberSelection(matchFormat: MatchFormat) {
    patchMatchupState(matchFormat, {
      draftSelectedMemberIds: [],
      memberSelectionError: "",
    });
  }

  function selectAllDraftMembers(matchFormat: MatchFormat) {
    patchMatchupState(matchFormat, {
      draftSelectedMemberIds: sortedMembers.map((member) => member.id),
      memberSelectionError: "",
    });
  }

  function handleCreateMatchup(matchFormat: MatchFormat) {
    const state = matchupStates[matchFormat];
    const formatConfig = MATCH_FORMAT_CONFIG[matchFormat];

    if (!user || state.isMatchupGenerating) {
      return;
    }

    clearPdfError();
    const parsedCourtCount = parseCount(state.courtCount);
    const parsedRoundCount = parseCount(state.roundCount);
    const selectedMembers = selectedMembersForState(state);
    const participants = user.isAnonymous
      ? buildGuestParticipants(toDisplayCount(state.guestFemaleCount), toDisplayCount(state.guestMaleCount))
      : [
          ...selectedMembers.map((member) => ({
            id: member.id,
            name: member.nickname,
            gender: member.gender,
          })),
          ...buildGuestParticipants(toDisplayCount(state.memberGuestFemaleCount), toDisplayCount(state.memberGuestMaleCount), {
            idPrefix: "member-guest",
          }),
        ];

    patchMatchupState(matchFormat, {
      courtReductionConfirmation: null,
      matchupError: "",
      matchupResult: null,
    });
    setIsMatchupCompleteToastVisible(false);

    if (
      participants.length < formatConfig.participantMin ||
      participants.length > PARTICIPANT_COUNT_MAX ||
      parsedCourtCount === null ||
      parsedCourtCount < COURT_COUNT_MIN ||
      parsedCourtCount > COURT_COUNT_MAX ||
      parsedRoundCount === null ||
      parsedRoundCount < ROUND_COUNT_MIN ||
      parsedRoundCount > ROUND_COUNT_MAX
    ) {
      patchMatchupState(matchFormat, { matchupError: "参加者数、コート数、実施回数を確認してください。" });
      return;
    }

    const usableCourtCount = toUsableCourtCount(participants.length, parsedCourtCount, formatConfig.playersPerCourt);
    const payload: GenerateMatchupPayload = {
      eventName: state.eventName,
      matchFormat,
      matchupMode: matchFormat === "doubles" ? state.matchupMode : "standard",
      participantCount: participants.length,
      participants,
      courtCount: usableCourtCount,
      roundCount: parsedRoundCount,
    };

    if (parsedCourtCount > usableCourtCount) {
      patchMatchupState(matchFormat, {
        courtReductionConfirmation: {
          payload,
          requestedCourtCount: parsedCourtCount,
          usableCourtCount,
        },
      });
      return;
    }

    void createMatchup(matchFormat, payload);
  }

  async function createMatchup(matchFormat: MatchFormat, payload: GenerateMatchupPayload) {
    patchMatchupState(matchFormat, { courtReductionConfirmation: null, isMatchupGenerating: true });
    setIsMatchupCompleteToastVisible(false);

    try {
      const result = generateMatchupLocally(payload);
      patchMatchupState(matchFormat, {
        matchupError: "",
        matchupResult: result,
      });
      setIsMatchupCompleteToastVisible(true);
    } catch (error) {
      patchMatchupState(matchFormat, { matchupError: toMessage(error, "対戦表を作成できませんでした。") });
    } finally {
      patchMatchupState(matchFormat, { isMatchupGenerating: false });
    }
  }

  function cancelCourtReductionConfirmation(matchFormat: MatchFormat) {
    patchMatchupState(matchFormat, { courtReductionConfirmation: null });
  }

  function confirmCourtReduction(matchFormat: MatchFormat) {
    const state = matchupStates[matchFormat];

    if (!state.courtReductionConfirmation || state.isMatchupGenerating) {
      return;
    }

    void createMatchup(matchFormat, state.courtReductionConfirmation.payload);
  }

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || user.isAnonymous) {
      return;
    }

    setMemberError("");

    try {
      if (editingMemberId) {
        await updateMember(editingMemberId, memberForm);
      } else {
        await addMember(memberForm, activeMembers.length);
      }

      setMemberForm(emptyMemberForm);
      setEditingMemberId(null);
      setIsMemberFormOpen(false);
    } catch (error) {
      setMemberError(toMessage(error, "メンバーを保存できませんでした。"));
    }
  }

  function startEdit(member: Member) {
    setMemberForm({
      nickname: member.nickname,
      fullName: member.fullName,
      gender: member.gender,
      note: member.note,
    });
    setEditingMemberId(member.id);
    setMemberError("");
    setIsMemberFormOpen(true);
    router.push("/members");
  }

  function requestMemberDelete(member: Member) {
    if (!user || user.isAnonymous) {
      return;
    }

    setMemberDeleteTarget(member);
  }

  async function confirmMemberDelete() {
    const member = memberDeleteTarget;
    if (!member) {
      return;
    }

    setMemberDeleteTarget(null);

    setMemberError("");

    try {
      await deleteMember(member.id);
      if (editingMemberId === member.id) {
        setEditingMemberId(null);
        setMemberForm(emptyMemberForm);
        setIsMemberFormOpen(false);
      }
    } catch (error) {
      setMemberError(toMessage(error, "メンバーを削除できませんでした。"));
    }
  }

  if (appRoute === "unknown") {
    return <>{children}</>;
  }

  function renderMatchupScreen(matchFormat: MatchFormat) {
    const state = matchupStates[matchFormat];
    const selectedMembers = selectedMembersForState(state);
    const selectedFemaleCount = selectedMembers.filter((member) => member.gender === "female").length;
    const selectedMaleCount = selectedMembers.length - selectedFemaleCount;

    return (
      <MatchupScreen
        courtReductionConfirmation={state.courtReductionConfirmation}
        courtCount={state.courtCount}
        draftGuestFemaleCount={state.draftGuestFemaleCount}
        draftGuestMaleCount={state.draftGuestMaleCount}
        draftMemberGuestFemaleCount={state.draftMemberGuestFemaleCount}
        draftMemberGuestMaleCount={state.draftMemberGuestMaleCount}
        draftSelectedMemberIds={state.draftSelectedMemberIds}
        eventName={state.eventName}
        guestFemaleCount={state.guestFemaleCount}
        guestMaleCount={state.guestMaleCount}
        isGuest={user?.isAnonymous ?? false}
        isExportingPdf={isExportingPdf}
        isMatchupGenerating={state.isMatchupGenerating}
        matchFormat={matchFormat}
        memberSelectionError={state.memberSelectionError}
        matchupMode={state.matchupMode}
        matchupError={state.matchupError}
        matchupResult={state.matchupResult}
        memberSelectionOpen={state.memberSelectionOpen}
        memberGuestFemaleCount={state.memberGuestFemaleCount}
        memberGuestMaleCount={state.memberGuestMaleCount}
        members={sortedMembers}
        onCourtCountChange={(value) => patchMatchupState(matchFormat, { courtCount: value })}
        onCourtReductionCancel={() => cancelCourtReductionConfirmation(matchFormat)}
        onCourtReductionConfirm={() => confirmCourtReduction(matchFormat)}
        onDraftGuestFemaleCountChange={(value) => patchMatchupState(matchFormat, { draftGuestFemaleCount: value })}
        onDraftGuestMaleCountChange={(value) => patchMatchupState(matchFormat, { draftGuestMaleCount: value })}
        onDraftMemberGuestFemaleCountChange={(value) =>
          patchMatchupState(matchFormat, { draftMemberGuestFemaleCount: value })
        }
        onDraftMemberGuestMaleCountChange={(value) =>
          patchMatchupState(matchFormat, { draftMemberGuestMaleCount: value })
        }
        onEventNameChange={(value) => patchMatchupState(matchFormat, { eventName: value })}
        onMemberSelectionCancel={() => cancelMemberSelection(matchFormat)}
        onMemberSelectionConfirm={() => confirmMemberSelection(matchFormat)}
        onMemberSelectionOpen={() => openMemberSelection(matchFormat)}
        onMatchupModeChange={(value) => patchMatchupState(matchFormat, { matchupMode: value })}
        onMatchupCreate={() => handleCreateMatchup(matchFormat)}
        onPdfCreate={exportPdf}
        onRoundCountChange={(value) => patchMatchupState(matchFormat, { roundCount: value })}
        onSelectedMembersClear={() => clearDraftMemberSelection(matchFormat)}
        onSelectedMembersSelectAll={() => selectAllDraftMembers(matchFormat)}
        onSelectedMemberToggle={(memberId) => toggleDraftMemberSelection(matchFormat, memberId)}
        onSortModeChange={setSortMode}
        pdfErrorMessage={pdfErrorMessage}
        roundCount={state.roundCount}
        selectedFemaleCount={selectedFemaleCount}
        selectedMaleCount={selectedMaleCount}
        selectedMemberIds={state.selectedMemberIds}
        sortMode={sortMode}
      />
    );
  }

  const content = (() => {
    if (appRoute === "members") {
      return (
        <MemberManagementScreen
          activeMemberCount={activeMembers.length}
          editingMemberId={editingMemberId}
          error={memberError}
          form={memberForm}
          isFormOpen={isMemberFormOpen}
          members={sortedMembers}
          onExportBackup={handleExportMemberBackup}
          onImportBackup={handleImportMemberBackup}
          onCancelEdit={cancelMemberEdit}
          onChange={setMemberForm}
          onDelete={requestMemberDelete}
          onEdit={startEdit}
          onCreate={startMemberRegistration}
          onSortModeChange={setSortMode}
          onSubmit={handleMemberSubmit}
          sortMode={sortMode}
        />
      );
    }

    if (appRoute === "doubles") {
      return renderMatchupScreen("doubles");
    }

    if (appRoute === "singles") {
      return renderMatchupScreen("singles");
    }

    return <LandingHomeScreen activeMemberCount={activeMembers.length} />;
  })();

  return (
    <main className="app-shell">
      <div className="app-frame">
        <AppHeaderNav activeRoute={appRoute} />
        <PwaStatus />
        {content}
      </div>
      {appRoute === "members" && memberDeleteTarget ? (
        <MemberDeleteDialog
          member={memberDeleteTarget}
          onCancel={() => setMemberDeleteTarget(null)}
          onConfirm={confirmMemberDelete}
        />
      ) : null}
      {appRoute === "members" && memberBackupConfirmation ? (
        <MemberBackupRestoreDialog
          count={memberBackupConfirmation.count}
          onCancel={() => setMemberBackupConfirmation(null)}
          onConfirm={confirmMemberBackupRestore}
        />
      ) : null}
      {appRoute === "members" && memberBackupNotice ? (
        <div className="fixed-toast member-backup-toast" role="status" aria-live="polite">
          {memberBackupNotice}
        </div>
      ) : null}
      {appRoute === "members" && memberBackupError ? (
        <div className="fixed-toast member-backup-toast member-backup-toast-error" role="alert" aria-live="assertive">
          {memberBackupError}
        </div>
      ) : null}
      {isMatchupCompleteToastVisible ? (
        <div className="fixed-toast fixed-toast-success" role="status" aria-live="polite">
          対戦表作成が完了しました。
        </div>
      ) : null}
    </main>
  );
}

function AppHeaderNav(props: { activeRoute: AppRoute }) {
  const [desktopMatchupOpen, setDesktopMatchupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMatchupOpen, setMobileMatchupOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const matchupActive = props.activeRoute === "doubles" || props.activeRoute === "singles";
  const matchupTabLabel = formatMatchupTabLabel(props.activeRoute);

  const closeMenus = useCallback(() => {
    setDesktopMatchupOpen(false);
    setMobileMenuOpen(false);
    setMobileMatchupOpen(false);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setDesktopMatchupOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="app-header" data-testid="app-header" ref={headerRef}>
        <section className="app-header-panel">
          <div className="app-header-main">
            <div className="app-brand-area">
              <Link className="app-brand" href="/" onClick={closeMenus}>
                <Image
                  alt=""
                  aria-hidden="true"
                  className="app-brand-icon"
                  height={36}
                  src={APP_FAVICON_SRC}
                  unoptimized
                  width={36}
                />
                <span className="eyebrow">MatchupLab</span>
              </Link>
              <div className="app-brand-nav">
                <DesktopPrimaryNav
                  activeRoute={props.activeRoute}
                  desktopMatchupOpen={desktopMatchupOpen}
                  matchupActive={matchupActive}
                  matchupTabLabel={matchupTabLabel}
                  onClose={closeMenus}
                  onToggleMatchup={() => setDesktopMatchupOpen((current) => !current)}
                />
              </div>
            </div>

            <div className="app-header-actions">
              <button
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
                className="mobile-menu-button"
                title={mobileMenuOpen ? "メニューを閉じます。" : "メニューを開きます。"}
                type="button"
                onClick={() => {
                  setMobileMenuOpen((current) => !current);
                  setMobileMatchupOpen(false);
                }}
              >
                {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </section>
      </header>

      {mobileMenuOpen ? (
        <div className="mobile-menu-overlay" data-testid="mobile-nav-menu">
          <nav className="mobile-menu-panel" aria-label="モバイルメニュー">
            <HeaderNavLink href="/" active={props.activeRoute === "home"} onNavigate={closeMenus}>
              ホーム
            </HeaderNavLink>
            <HeaderNavLink
              href="/members"
              active={props.activeRoute === "members"}
              onNavigate={closeMenus}
            >
              メンバー
            </HeaderNavLink>
            <button
              aria-expanded={mobileMatchupOpen}
              className={`mobile-menu-item mobile-menu-item-button ${matchupActive ? "mobile-menu-item-active" : ""}`}
              type="button"
              onClick={() => setMobileMatchupOpen((current) => !current)}
            >
              <span>{matchupTabLabel}</span>
              <ChevronDown aria-hidden="true" className={mobileMatchupOpen ? "chevron-open" : ""} size={18} />
            </button>
            {mobileMatchupOpen ? (
              <div className="mobile-submenu">
                <HeaderNavLink href="/matchups/doubles" active={props.activeRoute === "doubles"} onNavigate={closeMenus}>
                  ダブルス
                </HeaderNavLink>
                <HeaderNavLink href="/matchups/singles" active={props.activeRoute === "singles"} onNavigate={closeMenus}>
                  シングルス
                </HeaderNavLink>
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}

    </>
  );
}

function DesktopPrimaryNav(props: {
  activeRoute: AppRoute;
  desktopMatchupOpen: boolean;
  matchupActive: boolean;
  matchupTabLabel: string;
  onClose: () => void;
  onToggleMatchup: () => void;
}) {
  return (
    <nav aria-label="メインメニュー" className="desktop-primary-nav">
      <HeaderNavLink href="/" active={props.activeRoute === "home"} onNavigate={props.onClose}>
        ホーム
      </HeaderNavLink>
      <HeaderNavLink
        href="/members"
        active={props.activeRoute === "members"}
        onNavigate={props.onClose}
      >
        メンバー
      </HeaderNavLink>
      <div className="desktop-menu-wrap">
        <button
          aria-expanded={props.desktopMatchupOpen}
          aria-haspopup="menu"
          className={`header-nav-item header-nav-button ${props.matchupActive ? "header-nav-item-active" : ""}`}
          type="button"
          onClick={props.onToggleMatchup}
        >
          {props.matchupTabLabel}
          <ChevronDown aria-hidden="true" className={props.desktopMatchupOpen ? "chevron-open" : ""} size={16} />
        </button>
        {props.desktopMatchupOpen ? (
          <div className="desktop-submenu" role="menu">
            <Link
              className={`desktop-submenu-item ${props.activeRoute === "doubles" ? "desktop-submenu-item-active" : ""}`}
              href="/matchups/doubles"
              role="menuitem"
              onClick={props.onClose}
            >
              ダブルス
            </Link>
            <Link
              className={`desktop-submenu-item ${props.activeRoute === "singles" ? "desktop-submenu-item-active" : ""}`}
              href="/matchups/singles"
              role="menuitem"
              onClick={props.onClose}
            >
              シングルス
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function HeaderNavLink(props: {
  active: boolean;
  children: ReactNode;
  href: string;
  onNavigate: () => void;
}) {
  const className = `header-nav-item ${props.active ? "header-nav-item-active" : ""}`;

  return (
    <Link aria-current={props.active ? "page" : undefined} className={className} href={props.href} onClick={props.onNavigate}>
      {props.children}
    </Link>
  );
}

function LandingHomeScreen(props: { activeMemberCount: number }) {
  return (
    <div className="landing-screen">
      <section className="landing-hero">
        <p className="section-kicker">MatchupLab</p>
        <p className="landing-hero-copy">
          メンバー管理、参加者選択、対戦表作成をこの端末で完結できます。ダブルスとシングルスの対戦表作成に対応しています。
        </p>
      </section>

      <section className="panel guest-notice-panel">
        <div className="panel-body">
          <p className="guest-notice-title">登録メンバー: {props.activeMemberCount}人</p>
          <p className="muted">登録したメンバーは、ダブルス・シングルス対戦表作成時の参加者選択で利用できます。</p>
        </div>
      </section>

      <section className="feature-link-grid" aria-label="機能一覧">
        <article className="feature-card">
          <div>
            <p className="section-kicker">Members</p>
            <h2>
              メンバー登録<span className="home-storage-label">（ローカル保存）</span>
            </h2>
            <p className="muted">ニックネーム、氏名、性別、備考を登録し、対戦表作成時に参加メンバーとして選択できます。</p>
          </div>
          <Link className="button button-primary" href="/members">
            <UserPlus size={18} />
            メンバーを管理
          </Link>
        </article>

        <article className="feature-card">
          <div>
            <p className="section-kicker">Doubles</p>
            <h2>ダブルス対戦表</h2>
            <p className="muted">登録メンバーまたは一時参加者を指定し、コート数と実施回数に合わせて対戦表を作成します。</p>
          </div>
          <Link className="button button-primary" href="/matchups/doubles">
            <Swords size={18} />
            ダブルスへ
          </Link>
        </article>

        <article className="feature-card">
          <div>
            <p className="section-kicker">Singles</p>
            <h2>シングルス対戦表</h2>
            <p className="muted">登録メンバーまたは一時参加者を指定し、1コート2人のシングルス対戦表を作成します。</p>
          </div>
          <Link className="button button-primary" href="/matchups/singles">
            <Swords size={18} />
            シングルスへ
          </Link>
        </article>
      </section>
    </div>
  );
}

function formatMatchupTabLabel(route: AppRoute) {
  if (route === "doubles") {
    return "ダブルス";
  }

  if (route === "singles") {
    return "シングルス";
  }

  return "対戦表";
}

function MatchupScreen(props: {
  courtReductionConfirmation: CourtReductionConfirmation | null;
  courtCount: string;
  draftGuestFemaleCount: string;
  draftGuestMaleCount: string;
  draftMemberGuestFemaleCount: string;
  draftMemberGuestMaleCount: string;
  draftSelectedMemberIds: string[];
  eventName: string;
  guestFemaleCount: string;
  guestMaleCount: string;
  isGuest: boolean;
  isExportingPdf: boolean;
  isMatchupGenerating: boolean;
  matchFormat: MatchFormat;
  memberSelectionError: string;
  matchupMode: MatchupMode;
  matchupError: string;
  matchupResult: MatchupResult | null;
  memberSelectionOpen: boolean;
  memberGuestFemaleCount: string;
  memberGuestMaleCount: string;
  members: Member[];
  onCourtCountChange: (value: string) => void;
  onCourtReductionCancel: () => void;
  onCourtReductionConfirm: () => void;
  onDraftGuestFemaleCountChange: (value: string) => void;
  onDraftGuestMaleCountChange: (value: string) => void;
  onDraftMemberGuestFemaleCountChange: (value: string) => void;
  onDraftMemberGuestMaleCountChange: (value: string) => void;
  onEventNameChange: (value: string) => void;
  onMemberSelectionCancel: () => void;
  onMemberSelectionConfirm: () => void;
  onMemberSelectionOpen: () => void;
  onMatchupModeChange: (value: MatchupMode) => void;
  onMatchupCreate: () => void;
  onPdfCreate: (result: MatchupResult) => Promise<void>;
  onRoundCountChange: (value: string) => void;
  onSelectedMembersClear: () => void;
  onSelectedMembersSelectAll: () => void;
  onSelectedMemberToggle: (memberId: string) => void;
  onSortModeChange: (mode: SortMode) => void;
  pdfErrorMessage: string | null;
  roundCount: string;
  selectedFemaleCount: number;
  selectedMaleCount: number;
  selectedMemberIds: string[];
  sortMode: SortMode;
}) {
  const matchupModeOptions: Array<{ label: string; title: string; value: MatchupMode }> = [
    { label: "通常", title: "男女に関係なく組合せを作成します。", value: "standard" },
    { label: "同性対決優先", title: "同性同士の対戦を優先して組合せを作成します。", value: "sameGenderPriority" },
    { label: "混合対決優先", title: "男女混合の対戦を優先して組合せを作成します。", value: "mixedDoublesPriority" },
  ];
  const formatConfig = MATCH_FORMAT_CONFIG[props.matchFormat];
  const guestFemaleDisplayCount = toDisplayCount(props.guestFemaleCount);
  const guestMaleDisplayCount = toDisplayCount(props.guestMaleCount);
  const guestParticipantCount = guestFemaleDisplayCount + guestMaleDisplayCount;
  const memberGuestFemaleDisplayCount = toDisplayCount(props.memberGuestFemaleCount);
  const memberGuestMaleDisplayCount = toDisplayCount(props.memberGuestMaleCount);
  const memberGuestParticipantCount = memberGuestFemaleDisplayCount + memberGuestMaleDisplayCount;
  const summaryGuestFemaleCount = props.isGuest ? guestFemaleDisplayCount : memberGuestFemaleDisplayCount;
  const summaryGuestMaleCount = props.isGuest ? guestMaleDisplayCount : memberGuestMaleDisplayCount;
  const summaryGuestBreakdown = formatGuestSummaryNumberingBreakdown(summaryGuestFemaleCount, summaryGuestMaleCount);
  const registeredParticipantCount = props.selectedMemberIds.length + memberGuestParticipantCount;
  const participantCount = props.isGuest
    ? guestParticipantCount
    : registeredParticipantCount;
  const participantLabel = formatParticipantSummaryLabel({
    guestCount: memberGuestParticipantCount,
    isGuest: props.isGuest,
    participantCount,
  });
  const selectedSummaryCount = participantCount;
  const femaleSummaryCount = props.isGuest
    ? guestFemaleDisplayCount
    : props.selectedFemaleCount + memberGuestFemaleDisplayCount;
  const maleSummaryCount = props.isGuest ? guestMaleDisplayCount : props.selectedMaleCount + memberGuestMaleDisplayCount;
  const parsedCourtCount = parseCount(props.courtCount);
  const parsedRoundCount = parseCount(props.roundCount);
  const usableCourtCount = toUsableCourtCount(participantCount, parsedCourtCount, formatConfig.playersPerCourt);
  const canCreateMatchup =
    participantCount >= formatConfig.participantMin &&
    participantCount <= PARTICIPANT_COUNT_MAX &&
    parsedCourtCount !== null &&
    parsedCourtCount >= COURT_COUNT_MIN &&
    parsedCourtCount <= COURT_COUNT_MAX &&
    usableCourtCount >= 1 &&
    parsedRoundCount !== null &&
    parsedRoundCount >= ROUND_COUNT_MIN &&
    parsedRoundCount <= ROUND_COUNT_MAX;
  const summaryRoundCount = canCreateMatchup ? (parsedRoundCount ?? 0) : 0;
  const summaryParticipantSeparator = props.isGuest ? " / " : "/ ";
  const summaryRoundSeparator = props.isGuest ? " / " : "/ ";
  const memberSelectionTitle = props.isGuest
    ? "女性人数・男性人数を入力します。"
    : "参加メンバーとゲスト人数を選択します。";
  const matchupCreateTitle = canCreateMatchup
    ? "現在の条件で対戦表を作成します。"
    : "参加者数、コート数、実施回数を確認してください。";

  return (
    <div className="home-matchup-layout">
      <section className="panel condition-panel">
        <div className="condition-heading">
          <p className="section-kicker">Conditions</p>
          <p className="condition-intro">{formatConfig.conditionIntro}</p>
        </div>

        {props.matchFormat === "doubles" ? (
          <div className="condition-block">
            <span className="condition-label">対戦モード</span>
            <div className="mode-selector" role="group" aria-label="対戦モード">
              {matchupModeOptions.map((option) => (
                <button
                  aria-pressed={props.matchupMode === option.value}
                  className={`mode-option ${props.matchupMode === option.value ? "mode-option-active" : ""}`}
                  key={option.value}
                  title={option.title}
                  type="button"
                  onClick={() => props.onMatchupModeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="condition-grid">
          <div className="field condition-field condition-field-event">
            <label htmlFor="event-name">開催名</label>
            <input
              id="event-name"
              onChange={(event) => props.onEventNameChange(event.target.value)}
              placeholder="例: 午後の対戦会"
              value={props.eventName}
            />
          </div>

          <div className="condition-member-field">
            <span className="condition-label">参加メンバー</span>
            <div className="member-select-summary">
              <span className="button-title-wrap" title={memberSelectionTitle}>
                <button
                  className="button button-secondary member-select-button"
                  title={memberSelectionTitle}
                  type="button"
                  onClick={props.memberSelectionOpen ? props.onMemberSelectionCancel : props.onMemberSelectionOpen}
                >
                  <Users size={18} />
                  メンバー選択
                </button>
              </span>
              <div className="condition-summary">
                <div>
                  <span>選択中</span>
                  <strong>{selectedSummaryCount}人</strong>
                </div>
                <div>
                  <span>女性 / 男性</span>
                  <strong>
                    {femaleSummaryCount} / {maleSummaryCount}
                  </strong>
                </div>
              </div>
            </div>
            {props.memberSelectionOpen ? (
              props.isGuest ? (
                <GuestParticipantCountDropdown
                  femaleCount={props.draftGuestFemaleCount}
                  maleCount={props.draftGuestMaleCount}
                  onCancel={props.onMemberSelectionCancel}
                  onConfirm={props.onMemberSelectionConfirm}
                  onFemaleCountChange={props.onDraftGuestFemaleCountChange}
                  onMaleCountChange={props.onDraftGuestMaleCountChange}
                />
              ) : (
                <ParticipantSelectionDropdown
                  error={props.memberSelectionError}
                  guestFemaleCount={props.draftMemberGuestFemaleCount}
                  guestMaleCount={props.draftMemberGuestMaleCount}
                  members={props.members}
                  onCancel={props.onMemberSelectionCancel}
                  onClear={props.onSelectedMembersClear}
                  onConfirm={props.onMemberSelectionConfirm}
                  onGuestFemaleCountChange={props.onDraftMemberGuestFemaleCountChange}
                  onGuestMaleCountChange={props.onDraftMemberGuestMaleCountChange}
                  onSelectAll={props.onSelectedMembersSelectAll}
                  onSortModeChange={props.onSortModeChange}
                  onToggle={props.onSelectedMemberToggle}
                  selectedMemberIds={props.draftSelectedMemberIds}
                  sortMode={props.sortMode}
                />
              )
            ) : null}
          </div>

          <div className="field condition-field condition-field-narrow">
            <CountStepperField
              label="コート数"
              value={props.courtCount}
              numericValue={parsedCourtCount ?? 0}
              min={COURT_COUNT_MIN}
              max={COURT_COUNT_MAX}
              inputTestId="court-count-input"
              decrementTestId="court-count-decrement"
              incrementTestId="court-count-increment"
              decrementLabel="コート数を1面減らす"
              incrementLabel="コート数を1面増やす"
              onChange={props.onCourtCountChange}
              onCommit={() => props.onCourtCountChange(commitCountInput(props.courtCount, COURT_COUNT_MIN, COURT_COUNT_MAX))}
              onStep={(delta) => props.onCourtCountChange(stepCountInput(props.courtCount, COURT_COUNT_MIN, COURT_COUNT_MAX, delta))}
            />
          </div>
          <div className="field condition-field">
            <CountStepperField
              label="実施回数"
              value={props.roundCount}
              numericValue={parsedRoundCount ?? 0}
              min={ROUND_COUNT_MIN}
              max={ROUND_COUNT_MAX}
              inputTestId="round-count-input"
              decrementTestId="round-count-decrement"
              incrementTestId="round-count-increment"
              decrementLabel="実施回数を1回減らす"
              incrementLabel="実施回数を1回増やす"
              onChange={props.onRoundCountChange}
              onCommit={() => props.onRoundCountChange(commitCountInput(props.roundCount, ROUND_COUNT_MIN, ROUND_COUNT_MAX))}
              onStep={(delta) => props.onRoundCountChange(stepCountInput(props.roundCount, ROUND_COUNT_MIN, ROUND_COUNT_MAX, delta))}
            />
          </div>
        </div>

        <div className="numbering-summary">
          <div className="numbering-summary-text">
            <p className="section-kicker">Summary</p>
            <p className="numbering-summary-main">
              参加 {participantLabel}{summaryParticipantSeparator}コート {usableCourtCount}面{summaryRoundSeparator}{summaryRoundCount}回
            </p>
            {summaryGuestBreakdown ? (
              <p className="numbering-summary-guest-breakdown">ゲスト {summaryGuestBreakdown}</p>
            ) : null}
            {props.matchupError ? <p className="error-message action-error">{props.matchupError}</p> : null}
          </div>
          <span
            className="button-title-wrap numbering-summary-action"
            title={props.isMatchupGenerating ? "対戦表を作成しています。" : matchupCreateTitle}
          >
            <button
              className="button button-primary"
              disabled={!canCreateMatchup || props.isMatchupGenerating}
              title={props.isMatchupGenerating ? "対戦表を作成しています。" : matchupCreateTitle}
              type="button"
              onClick={props.onMatchupCreate}
            >
              <Swords size={18} />
              {props.isMatchupGenerating ? "作成中..." : "対戦表作成"}
            </button>
          </span>
        </div>
      </section>

      {props.matchupResult ? (
        <MatchupResultPanel
          isExportingPdf={props.isExportingPdf}
          isGuest={props.isGuest}
          onPdfCreate={props.onPdfCreate}
          pdfErrorMessage={props.pdfErrorMessage}
          result={props.matchupResult}
        />
      ) : null}
      {props.courtReductionConfirmation ? (
        <CourtReductionDialog
          isGenerating={props.isMatchupGenerating}
          onCancel={props.onCourtReductionCancel}
          onConfirm={props.onCourtReductionConfirm}
          requestedCourtCount={props.courtReductionConfirmation.requestedCourtCount}
          usableCourtCount={props.courtReductionConfirmation.usableCourtCount}
        />
      ) : null}
    </div>
  );
}

function CourtReductionDialog(props: {
  isGenerating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  requestedCourtCount: number;
  usableCourtCount: number;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-describedby="court-reduction-description"
        aria-labelledby="court-reduction-title"
        aria-modal="true"
        className="confirmation-dialog"
        role="dialog"
      >
        <div>
          <p className="section-kicker">確認</p>
          <h2 id="court-reduction-title">コート数を調整します</h2>
        </div>
        <p id="court-reduction-description">
          入力されたコート数 {props.requestedCourtCount}面 は参加人数に対して多いため、
          <br />
          コート数：
          <strong>{props.usableCourtCount}面</strong>で対戦表を作成します。
        </p>
        <div className="dialog-actions">
          <button className="button button-secondary" disabled={props.isGenerating} type="button" onClick={props.onCancel}>
            キャンセル
          </button>
          <button className="button button-primary" disabled={props.isGenerating} type="button" onClick={props.onConfirm}>
            OK
          </button>
        </div>
      </section>
    </div>
  );
}

function MemberDeleteDialog(props: {
  member: Member;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const onCancel = props.onCancel;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        aria-describedby="member-delete-description"
        aria-labelledby="member-delete-title"
        aria-modal="true"
        className="confirmation-dialog member-delete-dialog"
        role="dialog"
      >
        <div>
          <p className="section-kicker">確認</p>
          <h2 id="member-delete-title">メンバーを削除します</h2>
        </div>
        <p id="member-delete-description">
          「<strong>{props.member.nickname}</strong>」を削除します。よろしいですか？
        </p>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onCancel}>
            キャンセル
          </button>
          <button className="button button-danger" type="button" onClick={props.onConfirm}>
            削除
          </button>
        </div>
      </section>
    </div>
  );
}

function MemberBackupRestoreDialog(props: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const onCancel = props.onCancel;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        aria-describedby="member-backup-restore-description"
        aria-labelledby="member-backup-restore-title"
        aria-modal="true"
        className="confirmation-dialog member-backup-restore-dialog"
        role="dialog"
      >
        <div>
          <p className="section-kicker">MatchupLab</p>
          <h2 id="member-backup-restore-title">メンバーを復元します</h2>
        </div>
        <p id="member-backup-restore-description">
          現在のメンバーデータを置き換えて、<strong>{props.count}件</strong>のバックアップを復元します。
        </p>
        <p className="dialog-warning">現在のメンバーデータはバックアップの内容に置き換わります。</p>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onCancel}>
            キャンセル
          </button>
          <button className="button button-primary" type="button" onClick={props.onConfirm}>
            復元
          </button>
        </div>
      </section>
    </div>
  );
}

function MatchupResultPanel(props: {
  isExportingPdf: boolean;
  isGuest: boolean;
  onPdfCreate: (result: MatchupResult) => Promise<void>;
  pdfErrorMessage: string | null;
  result: MatchupResult;
}) {
  const participantsById = new Map(props.result.conditions.participants.map((participant) => [participant.id, participant]));
  const eventName = props.result.conditions.eventName?.trim() || "対戦表";

  function playerName(playerId: string) {
    const participant = participantsById.get(playerId);

    if (!participant) {
      return playerId;
    }

    return formatParticipantDisplayName(participant);
  }

  function pairLabel(pair?: MatchupPair | null) {
    if (!pair) {
      return "なし";
    }

    return `${playerName(pair.player1Id)} & ${playerName(pair.player2Id)}`;
  }

  function singlesMatchLabel(match?: MatchupSinglesMatch | null) {
    if (!match) {
      return "なし";
    }

    return `${playerName(match.player1Id)} vs ${playerName(match.player2Id)}`;
  }

  return (
    <section className={`panel matchup-result-panel ${props.isGuest ? "matchup-result-panel-guest" : ""}`}>
      <div className="result-heading">
        <div>
          <p className="section-kicker">Matchup Table</p>
          <h2>{eventName}</h2>
        </div>
        <div className="result-actions">
          <button
            className="button button-secondary"
            disabled={props.isExportingPdf}
            title="現在の対戦表をPDFファイルとして出力します。"
            type="button"
            onClick={() => void props.onPdfCreate(props.result)}
          >
            <FileDown size={18} />
            {props.isExportingPdf ? "PDF出力中..." : "PDF作成"}
          </button>
        </div>
      </div>
      {props.pdfErrorMessage ? <p className="error-message">{props.pdfErrorMessage}</p> : null}

      <div className="round-list">
        {props.result.rounds.map((round) => {
          const restNames = round.restPlayerIds.map(playerName);
          const courtCards = round.courts.map((court) => (
            <article className="court-card" key={`${round.roundNumber}-${court.courtNumber}`}>
              <h4>コート{court.courtNumber}</h4>
              {court.isUnused ? (
                <p className="court-unused">未使用</p>
              ) : court.singlesMatch ? (
                <div className="singles-match-display">
                  <strong>{singlesMatchLabel(court.singlesMatch)}</strong>
                </div>
              ) : (
                <dl>
                  <div>
                    <dt>A</dt>
                    <dd>{pairLabel(court.pairA)}</dd>
                  </div>
                  <div>
                    <dt>B</dt>
                    <dd>{pairLabel(court.pairB)}</dd>
                  </div>
                </dl>
              )}
            </article>
          ));
          const restCard = (
            <div className="rest-card" key={`${round.roundNumber}-rest`}>
              <span>休憩</span>
              <strong>{restNames.length > 0 ? restNames.join("、") : props.isGuest ? "この回の休憩者はいません。" : "なし"}</strong>
            </div>
          );

          return (
            <section className="round-card" key={round.roundNumber}>
              <div className="round-heading">
                <h3>第{round.roundNumber}ラウンド</h3>
              </div>
              {props.isGuest ? (
                <div className="guest-result-row">
                  <div className="guest-court-scroll" aria-label={`第${round.roundNumber}ラウンドのコート一覧`}>
                    <div className="guest-court-track">{courtCards}</div>
                  </div>
                  {restCard}
                </div>
              ) : (
                <>
                  <div className="court-card-grid">{courtCards}</div>
                  {restCard}
                </>
              )}
            </section>
          );
        })}
      </div>
      <div className="result-seed-row">
        <div className="seed-pill">seed {props.result.seed}</div>
      </div>
    </section>
  );
}

type CountStepperFieldProps = {
  label: string;
  labelTone?: "female" | "male";
  value: string;
  numericValue: number;
  min: number;
  max: number;
  inputTestId: string;
  decrementTestId: string;
  incrementTestId: string;
  decrementLabel: string;
  incrementLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onStep: (delta: number) => void;
};

function CountStepperField({
  label,
  labelTone,
  value,
  numericValue,
  min,
  max,
  inputTestId,
  decrementTestId,
  incrementTestId,
  decrementLabel,
  incrementLabel,
  disabled = false,
  onChange,
  onCommit,
  onStep,
}: CountStepperFieldProps) {
  const inputId = `${inputTestId}-field`;
  const decrementDisabled = disabled || numericValue <= min;
  const incrementDisabled = disabled || numericValue >= max;

  return (
    <div className="count-stepper-field">
      <label className={labelTone ? `count-stepper-label count-stepper-label-${labelTone}` : "count-stepper-label"} htmlFor={inputId}>
        {label}
      </label>
      <div className={`count-stepper-control ${disabled ? "count-stepper-control-disabled" : ""}`}>
        <button
          aria-label={decrementLabel}
          className="count-stepper-button"
          data-testid={decrementTestId}
          disabled={decrementDisabled}
          title={decrementLabel}
          type="button"
          onClick={() => onStep(-1)}
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <input
          data-testid={inputTestId}
          disabled={disabled}
          id={inputId}
          inputMode="numeric"
          max={max}
          min={min}
          pattern="[0-9]*"
          type="text"
          value={value}
          onBlur={onCommit}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onCommit();
            }
          }}
        />
        <button
          aria-label={incrementLabel}
          className="count-stepper-button"
          data-testid={incrementTestId}
          disabled={incrementDisabled}
          title={incrementLabel}
          type="button"
          onClick={() => onStep(1)}
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}

function GuestParticipantCountDropdown(props: {
  femaleCount: string;
  maleCount: string;
  onCancel: () => void;
  onConfirm: () => void;
  onFemaleCountChange: (value: string) => void;
  onMaleCountChange: (value: string) => void;
}) {
  const selectedCount = toDisplayCount(props.femaleCount) + toDisplayCount(props.maleCount);
  const femaleMax = Math.max(GENDER_COUNT_MIN, PARTICIPANT_COUNT_MAX - toDisplayCount(props.maleCount));
  const maleMax = Math.max(GENDER_COUNT_MIN, PARTICIPANT_COUNT_MAX - toDisplayCount(props.femaleCount));

  return (
    <ParticipantSelectionDialogFrame
      className="participant-count-dialog"
      onCancel={props.onCancel}
      titleId="guest-participant-count-title"
    >
      <div className="participant-dropdown-header">
        <div>
          <h3 id="guest-participant-count-title">参加人数入力（最大30人まで）</h3>
          <p className="muted">選択中: {selectedCount}人</p>
        </div>
      </div>
      <div className="participant-dropdown-body">
        <div className="guest-count-grid">
          <div className="field">
            <CountStepperField
              label="女性人数"
              labelTone="female"
              value={props.femaleCount}
              numericValue={toDisplayCount(props.femaleCount)}
              min={GENDER_COUNT_MIN}
              max={femaleMax}
              inputTestId="guest-female-count-input"
              decrementTestId="guest-female-count-decrement"
              incrementTestId="guest-female-count-increment"
              decrementLabel="女性人数を1人減らす"
              incrementLabel="女性人数を1人増やす"
              onChange={props.onFemaleCountChange}
              onCommit={() => props.onFemaleCountChange(commitCountInput(props.femaleCount, GENDER_COUNT_MIN, femaleMax))}
              onStep={(delta) => props.onFemaleCountChange(stepCountInput(props.femaleCount, GENDER_COUNT_MIN, femaleMax, delta))}
            />
          </div>
          <div className="field">
            <CountStepperField
              label="男性人数"
              labelTone="male"
              value={props.maleCount}
              numericValue={toDisplayCount(props.maleCount)}
              min={GENDER_COUNT_MIN}
              max={maleMax}
              inputTestId="guest-male-count-input"
              decrementTestId="guest-male-count-decrement"
              incrementTestId="guest-male-count-increment"
              decrementLabel="男性人数を1人減らす"
              incrementLabel="男性人数を1人増やす"
              onChange={props.onMaleCountChange}
              onCommit={() => props.onMaleCountChange(commitCountInput(props.maleCount, GENDER_COUNT_MIN, maleMax))}
              onStep={(delta) => props.onMaleCountChange(stepCountInput(props.maleCount, GENDER_COUNT_MIN, maleMax, delta))}
            />
          </div>
        </div>
      </div>
      <div className="participant-dropdown-actions">
        <button className="button button-secondary" title="入力を破棄して閉じます。" type="button" onClick={props.onCancel}>
          キャンセル
        </button>
        <button className="button button-primary" title="入力した人数を確定します。" type="button" onClick={props.onConfirm}>
          OK
        </button>
      </div>
    </ParticipantSelectionDialogFrame>
  );
}

function ParticipantSelectionDialogFrame(props: {
  children: ReactNode;
  className?: string;
  onCancel: () => void;
  titleId: string;
}) {
  const onCancelRef = useRef(props.onCancel);

  useEffect(() => {
    onCancelRef.current = props.onCancel;
  }, [props.onCancel]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const dialogClassName = ["participant-selection-dropdown", "participant-selection-dialog", props.className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="dialog-backdrop participant-selection-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancelRef.current();
        }
      }}
    >
      <section aria-labelledby={props.titleId} aria-modal="true" className={dialogClassName} role="dialog">
        {props.children}
      </section>
    </div>
  );
}

function ParticipantSelectionDropdown(props: {
  error: string;
  guestFemaleCount: string;
  guestMaleCount: string;
  members: Member[];
  onCancel: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onGuestFemaleCountChange: (value: string) => void;
  onGuestMaleCountChange: (value: string) => void;
  onSelectAll: () => void;
  onSortModeChange: (mode: SortMode) => void;
  onToggle: (memberId: string) => void;
  selectedMemberIds: string[];
  sortMode: SortMode;
}) {
  const participantBodyRef = useRef<HTMLDivElement>(null);
  const guestCountPanelRef = useRef<HTMLDivElement>(null);
  const selectedCount = props.selectedMemberIds.length;
  const guestCount = toDisplayCount(props.guestFemaleCount) + toDisplayCount(props.guestMaleCount);
  const totalSelectedCount = selectedCount + guestCount;
  const guestFemaleMax = Math.max(
    GENDER_COUNT_MIN,
    PARTICIPANT_COUNT_MAX - selectedCount - toDisplayCount(props.guestMaleCount),
  );
  const guestMaleMax = Math.max(
    GENDER_COUNT_MIN,
    PARTICIPANT_COUNT_MAX - selectedCount - toDisplayCount(props.guestFemaleCount),
  );
  const selectableMemberIds = props.members.map((member) => member.id);
  const allSelectableMembersSelected =
    selectableMemberIds.length > 0 && selectableMemberIds.every((memberId) => props.selectedMemberIds.includes(memberId));

  useEffect(() => {
    const participantBody = participantBodyRef.current;
    const guestCountPanel = guestCountPanelRef.current;

    if (!participantBody || !guestCountPanel) {
      return;
    }

    const syncGuestCountPanelWidth = () => {
      const firstParticipantCard = participantBody.querySelector<HTMLElement>(".participant-card");

      if (firstParticipantCard) {
        guestCountPanel.style.width = `${firstParticipantCard.getBoundingClientRect().width}px`;
      } else {
        guestCountPanel.style.removeProperty("width");
      }
    };

    syncGuestCountPanelWidth();
    window.addEventListener("resize", syncGuestCountPanelWidth);

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncGuestCountPanelWidth);
    resizeObserver?.observe(participantBody);

    const firstParticipantCard = participantBody.querySelector<HTMLElement>(".participant-card");
    if (firstParticipantCard) {
      resizeObserver?.observe(firstParticipantCard);
    }

    return () => {
      window.removeEventListener("resize", syncGuestCountPanelWidth);
      resizeObserver?.disconnect();
    };
  }, [props.members.length, props.sortMode]);

  return (
    <ParticipantSelectionDialogFrame onCancel={props.onCancel} titleId="participant-selection-title">
      <div className="participant-dropdown-header">
        <div className="participant-dropdown-title-row">
          <h3 id="participant-selection-title">参加メンバー選択</h3>
          <p className="muted">合計: {totalSelectedCount} / 30人（ゲスト含む）</p>
        </div>
        <div className="participant-header-actions">
          <SortModeMenu className="participant-sort-menu" onChange={props.onSortModeChange} value={props.sortMode} />
          <div aria-label="一括選択操作" className="participant-selection-bulk-actions" role="group">
            <button
              className="button button-link participant-select-action-button"
              disabled={selectableMemberIds.length === 0 || allSelectableMembersSelected}
              title="表示中のメンバーをすべて選択します。"
              type="button"
              onClick={props.onSelectAll}
            >
              全選択
            </button>
            <button
              className="button button-link participant-select-action-button"
              disabled={selectedCount === 0}
              title="選択をすべて解除します。"
              type="button"
              onClick={props.onClear}
            >
              選択解除
            </button>
          </div>
        </div>
      </div>
      <div className="participant-dropdown-body" ref={participantBodyRef}>
        {props.members.length === 0 ? (
          <p className="status-message">メンバー未登録です。</p>
        ) : (
          <div className="participant-list">
            {props.members.map((member) => {
              const selected = props.selectedMemberIds.includes(member.id);
              const genderLabel = member.gender === "female" ? "女性" : "男性";

              return (
                <label className={`participant-card ${selected ? "participant-card-selected" : ""}`} key={member.id}>
                  <input
                    aria-label={`${member.nickname} ${genderLabel}`}
                    checked={selected}
                    onChange={() => props.onToggle(member.id)}
                    type="checkbox"
                  />
                  <span className="participant-card-name">
                    <strong title={member.nickname}>{member.nickname}</strong>
                  </span>
                  <small className={`participant-card-gender participant-gender-badge participant-gender-${member.gender}`}>
                    {genderLabel}
                  </small>
                </label>
              );
            })}
          </div>
        )}
      </div>
      <div className="participant-guest-count-panel" ref={guestCountPanelRef}>
        <div className="participant-guest-count-title">ゲスト人数</div>
        <div className="guest-count-grid participant-guest-count-grid">
          <div className="field">
            <CountStepperField
              label="女性"
              labelTone="female"
              value={props.guestFemaleCount}
              numericValue={toDisplayCount(props.guestFemaleCount)}
              min={GENDER_COUNT_MIN}
              max={guestFemaleMax}
              inputTestId="member-guest-female-count-input"
              decrementTestId="member-guest-female-count-decrement"
              incrementTestId="member-guest-female-count-increment"
              decrementLabel="追加女性を1人減らす"
              incrementLabel="追加女性を1人増やす"
              onChange={props.onGuestFemaleCountChange}
              onCommit={() =>
                props.onGuestFemaleCountChange(commitCountInput(props.guestFemaleCount, GENDER_COUNT_MIN, guestFemaleMax))
              }
              onStep={(delta) =>
                props.onGuestFemaleCountChange(stepCountInput(props.guestFemaleCount, GENDER_COUNT_MIN, guestFemaleMax, delta))
              }
            />
          </div>
          <div className="field">
            <CountStepperField
              label="男性"
              labelTone="male"
              value={props.guestMaleCount}
              numericValue={toDisplayCount(props.guestMaleCount)}
              min={GENDER_COUNT_MIN}
              max={guestMaleMax}
              inputTestId="member-guest-male-count-input"
              decrementTestId="member-guest-male-count-decrement"
              incrementTestId="member-guest-male-count-increment"
              decrementLabel="追加男性を1人減らす"
              incrementLabel="追加男性を1人増やす"
              onChange={props.onGuestMaleCountChange}
              onCommit={() =>
                props.onGuestMaleCountChange(commitCountInput(props.guestMaleCount, GENDER_COUNT_MIN, guestMaleMax))
              }
              onStep={(delta) =>
                props.onGuestMaleCountChange(stepCountInput(props.guestMaleCount, GENDER_COUNT_MIN, guestMaleMax, delta))
              }
            />
          </div>
        </div>
      </div>
      <div className="participant-dropdown-actions">
        {props.error ? (
          <p className="participant-dropdown-error" role="alert">
            {props.error}
          </p>
        ) : null}
        <button className="button button-secondary" title="変更を破棄して閉じます。" type="button" onClick={props.onCancel}>
          キャンセル
        </button>
        <button className="button button-primary" title="選択したメンバーを確定します。" type="button" onClick={props.onConfirm}>
          OK
        </button>
      </div>
    </ParticipantSelectionDialogFrame>
  );
}

function SortModeSelect(props: {
  className?: string;
  onChange: (mode: SortMode) => void;
  showLabel?: boolean;
  value: SortMode;
}) {
  return (
    <label className={props.className ? `sort-select-field ${props.className}` : "sort-select-field"}>
      {props.showLabel !== false ? <span>並び順:</span> : null}
      <select
        title="メンバーの表示順を選びます。"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value === "kana" ? "kana" : "registered")}
      >
        {SORT_MODE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortModeMenu(props: {
  className?: string;
  onChange: (mode: SortMode) => void;
  value: SortMode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentOption = SORT_MODE_OPTIONS.find((option) => option.value === props.value) ?? SORT_MODE_OPTIONS[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={props.className ? `sort-mode-menu ${props.className}` : "sort-mode-menu"} ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="sort-mode-menu-trigger"
        ref={triggerRef}
        title="メンバーの並び順を変更"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>並び順: {currentOption.label}</span>
        <ChevronDown aria-hidden="true" className={isOpen ? "chevron-open" : ""} size={15} />
      </button>
      {isOpen ? (
        <div aria-label="並び順の選択" className="sort-mode-menu-popover" role="menu">
          {SORT_MODE_OPTIONS.map((option) => {
            const isSelected = props.value === option.value;
            return (
              <button
                aria-checked={isSelected}
                className={`sort-mode-menu-item ${isSelected ? "sort-mode-menu-item-selected" : ""}`}
                key={option.value}
                role="menuitemradio"
                type="button"
                onClick={() => {
                  props.onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MemberManagementScreen(props: {
  activeMemberCount: number;
  editingMemberId: string | null;
  error: string;
  form: MemberFormInput;
  isFormOpen: boolean;
  members: Member[];
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onCancelEdit: () => void;
  onChange: (value: MemberFormInput) => void;
  onCreate: () => void;
  onDelete: (member: Member) => void;
  onEdit: (member: Member) => void;
  onSortModeChange: (mode: SortMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sortMode: SortMode;
}) {
  return (
    <div className="member-management-screen">
      <MemberListPanel
        activeMemberCount={props.activeMemberCount}
        members={props.members}
        onCreate={props.onCreate}
        onExportBackup={props.onExportBackup}
        onImportBackup={props.onImportBackup}
        onDelete={props.onDelete}
        onEdit={props.onEdit}
        onSortModeChange={props.onSortModeChange}
        sortMode={props.sortMode}
      />
      {props.isFormOpen ? (
        <MemberFormDialog
          editingMemberId={props.editingMemberId}
          error={props.error}
          form={props.form}
          onCancelEdit={props.onCancelEdit}
          onChange={props.onChange}
          onSubmit={props.onSubmit}
        />
      ) : null}
    </div>
  );
}

function MemberFormDialog(props: {
  editingMemberId: string | null;
  error: string;
  form: MemberFormInput;
  onCancelEdit: () => void;
  onChange: (value: MemberFormInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const title = props.editingMemberId ? "メンバー編集" : "メンバー登録";
  const onCancelEdit = props.onCancelEdit;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelEdit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancelEdit]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          props.onCancelEdit();
        }
      }}
    >
      <section
        aria-labelledby="member-form-dialog-title"
        aria-modal="true"
        className="confirmation-dialog member-form-dialog"
        role="dialog"
      >
        <div className="member-form-dialog-header">
          <h2 id="member-form-dialog-title">{title}</h2>
          <button
            aria-label="閉じる"
            className="icon-button member-form-dialog-close"
            title="閉じる"
            type="button"
            onClick={props.onCancelEdit}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <form className="form-grid member-form-dialog-form" onSubmit={props.onSubmit}>
          <div className="inline-fields">
            <div className="field">
              <label htmlFor="nickname">ニックネーム（表示名）</label>
              <input
                id="nickname"
                maxLength={10}
                onChange={(event) => props.onChange({ ...props.form, nickname: event.target.value })}
                required
                value={props.form.nickname}
              />
            </div>
          </div>
          <div className="inline-fields">
            <div className="field">
              <label htmlFor="fullName">氏名</label>
              <input
                id="fullName"
                onChange={(event) => props.onChange({ ...props.form, fullName: event.target.value })}
                value={props.form.fullName}
              />
            </div>
            <div className="field">
              <label htmlFor="gender">性別</label>
              <select
                id="gender"
                onChange={(event) => props.onChange({ ...props.form, gender: event.target.value === "male" ? "male" : "female" })}
                value={props.form.gender}
              >
                <option value="female">女性</option>
                <option value="male">男性</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="note">備考</label>
            <textarea
              id="note"
              onChange={(event) => props.onChange({ ...props.form, note: event.target.value })}
              value={props.form.note}
            />
          </div>
          {props.error ? <p className="error-message">{props.error}</p> : null}
          <div className="actions">
            <button className="button button-primary" type="submit">
              {props.editingMemberId ? <Save size={18} /> : <Plus size={18} />}
              {props.editingMemberId ? "更新" : "登録"}
            </button>
            <button className="button button-secondary" type="button" onClick={props.onCancelEdit}>
              キャンセル
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function clampCount(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function commitCountInput(value: string, min: number, max: number) {
  const parsed = parseCount(value);

  if (parsed === null) {
    return String(min);
  }

  return String(clampCount(parsed, min, max));
}

function stepCountInput(value: string, min: number, max: number, delta: number) {
  const parsed = parseCount(value);
  const base = parsed === null ? min - delta : parsed;

  return String(clampCount(base + delta, min, max));
}

function toDisplayCount(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

function toUsableCourtCount(participantCount: number, requestedCourtCount: number | null, playersPerCourt: 2 | 4) {
  if (requestedCourtCount === null || requestedCourtCount < 1) {
    return 0;
  }

  const maxUsableCourtCount = Math.floor(participantCount / playersPerCourt);

  if (maxUsableCourtCount < 1) {
    return 0;
  }

  return Math.min(requestedCourtCount, maxUsableCourtCount);
}

function parseCount(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

function MemberListPanel(props: {
  activeMemberCount: number;
  members: Member[];
  onCreate: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onDelete: (member: Member) => void;
  onEdit: (member: Member) => void;
  onSortModeChange: (mode: SortMode) => void;
  sortMode: SortMode;
}) {
  const [openMemberMenuId, setOpenMemberMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMemberMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".member-card-menu")) {
        return;
      }
      setOpenMemberMenuId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMemberMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMemberMenuId]);

  return (
    <section className="panel">
      <div className="panel-header member-list-panel-header">
        <h2>メンバー一覧（{props.activeMemberCount}/99）</h2>
        <div className="member-list-toolbar">
          <SortModeSelect onChange={props.onSortModeChange} showLabel={false} value={props.sortMode} />
          <div className="member-list-actions">
            <button
              className="button button-secondary"
              title="メンバー一覧をファイルに保存"
              type="button"
              onClick={props.onExportBackup}
            >
              <FileDown size={18} />
              バックアップ
            </button>
            <MemberBackupRestoreButton onImport={props.onImportBackup} />
            <button
              className="button button-primary"
              title="新しいメンバーを登録"
              type="button"
              onClick={props.onCreate}
            >
              <Plus aria-hidden="true" size={18} />
              新規追加
            </button>
          </div>
        </div>
      </div>
      <div className="panel-body">
        {props.members.length === 0 ? (
          <p className="status-message">メンバー未登録です。</p>
        ) : (
          <div aria-label="メンバー一覧" className="member-list" role="table">
            <div className="member-list-header" role="row">
              <span role="columnheader">ニックネーム</span>
              <span role="columnheader">氏名</span>
              <span role="columnheader">性別</span>
              <span role="columnheader">備考</span>
              <span aria-hidden="true" />
            </div>
            {props.members.map((member) => (
              <article className="member-card" key={member.id} role="row">
                <strong className="member-list-cell member-list-nickname" role="cell" title={member.nickname}>
                  {member.nickname}
                </strong>
                <span className="member-list-cell member-list-full-name" role="cell" title={member.fullName || "氏名未入力"}>
                  {member.fullName || "氏名未入力"}
                </span>
                <span
                  className={`participant-card-gender participant-gender-badge participant-gender-${member.gender} member-list-gender`}
                  role="cell"
                >
                  {member.gender === "female" ? "女性" : "男性"}
                </span>
                <span className="member-list-cell member-list-note" role="cell" title={member.note || "備考なし"}>
                  {member.note || "—"}
                </span>
                <div className="member-card-menu">
                  <button
                    aria-expanded={openMemberMenuId === member.id}
                    aria-haspopup="menu"
                    aria-label={member.nickname + "の操作メニュー"}
                    className="member-card-menu-trigger"
                    title="操作メニュー"
                    type="button"
                    onClick={() => setOpenMemberMenuId((current) => (current === member.id ? null : member.id))}
                  >
                    <EllipsisVertical aria-hidden="true" size={22} />
                  </button>
                  {openMemberMenuId === member.id ? (
                    <div className="member-card-menu-popover" role="menu">
                      <button
                        className="member-card-menu-item"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setOpenMemberMenuId(null);
                          props.onEdit(member);
                        }}
                      >
                        <Pencil aria-hidden="true" size={16} />
                        編集
                      </button>
                      <button
                        className="member-card-menu-item member-card-menu-item-danger"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setOpenMemberMenuId(null);
                          props.onDelete(member);
                        }}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                        削除
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MemberBackupRestoreButton(props: { onImport: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        className="button button-secondary"
        title="バックアップからメンバー一覧を復元"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={18} />
        復元
      </button>
      <input
        ref={inputRef}
        aria-hidden="true"
        accept=".json,application/json"
        className="member-backup-file-input"
        id="member-backup-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            props.onImport(file);
          }
          event.currentTarget.value = "";
        }}
        tabIndex={-1}
        type="file"
      />
    </>
  );
}

function toMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

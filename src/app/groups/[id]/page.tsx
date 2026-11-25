"use client";

import { useDocumentTitle } from "@/lib/use-document-title";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, apiPost, apiDelete, getErrorMessage } from "@/lib/api";
import {
  canManageGroup,
  canPromoteToCoAdmin,
  canRemoveGroupMember,
  formatGroupRoleLabel,
  isGroupAdminRole,
} from "@/lib/group-roles";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import FormField from "@/components/ui/FormField";
import { GroupDetailSkeleton, ErrorState } from "@/components/ui/StateViews";
import InviteCodeBlock from "@/components/groups/InviteCodeBlock";
import QuestionFormModal from "@/components/questions/QuestionFormModal";
import Select from "@/components/ui/Select";
import dynamic from "next/dynamic";
import GroupGamificationPanel from "@/components/groups/GroupGamificationPanel";
import { useGroupHeaderActions } from "@/components/groups/GroupShell";
import QuestionListView from "@/components/questions/QuestionListView";
import QuestionTableSearch from "@/components/questions/QuestionTableSearch";
// Below the fold and data-heavy: fetched after the page shell paints. Fixed height avoids layout shift.
const GroupMomentumPanel = dynamic(() => import("@/components/groups/GroupMomentumPanel"), {
  ssr: false,
  loading: () => <div className="min-h-[240px] animate-pulse rounded-xl bg-[var(--surface-muted)]" aria-hidden />,
});
import { useDebouncedValue } from "@/lib/use-debounced-value";
import TablePagination from "@/components/ui/TablePagination";
import {
  isGroupFull,
  JOIN_CODE_TTL_MINUTES,
  MAX_GROUP_MEMBERS,
  normalizeQuestionStatus,
  sliceTablePage,
  GROUP_QUESTIONS_PAGE_SIZE,
  TABLE_PAGE_SIZE,
  formatDate,
  DEFAULT_QUESTION_TABLE_SORT,
  toggleQuestionSort,
  toDateInputValue,
  splitQuestionFields,
  questionPracticeDay,
  type QuestionSortDir,
  type QuestionSortField,
} from "@/lib/utils";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import type {
  Group,
  GroupGamification,
  GroupRole,
  MemberStat,
  PracticeQuestion,
  QuestionStatus,
  Subject,
} from "@/types";

type GroupQuestion = PracticeQuestion & { subjectName: string; trackLabel?: string };

type GroupDetail = Group & {
  memberStats: (MemberStat & { role: string })[];
  gamification: GroupGamification;
  topicCount: number;
  countdown: { days: number; hours: number; interviewDate: string | null; hasDate?: boolean; isPast?: boolean };
  subjects?: Subject[];
};

type PagedGroupQuestions = {
  items: GroupQuestion[];
  total: number;
  page: number;
  limit: number;
};

function mergeGroupMembers(prev: GroupDetail, updated: Group): GroupDetail {
  const roleByUser = new Map(
    updated.members.map((m) => [String(m.userId), m.role])
  );
  const memberIds = new Set(updated.members.map((m) => String(m.userId)));
  return {
    ...prev,
    ...updated,
    memberStats: prev.memberStats
      .filter((m) => memberIds.has(m.userId))
      .map((m) => ({
        ...m,
        role: roleByUser.get(m.userId) ?? m.role,
      })),
  };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const { user, refreshUser } = useUser();
  const confirm = useConfirm();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  useDocumentTitle(group?.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupQuestions, setGroupQuestions] = useState<GroupQuestion[]>([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionSortBy, setQuestionSortBy] = useState<QuestionSortField>(
    DEFAULT_QUESTION_TABLE_SORT.sortBy
  );
  const [questionSortDir, setQuestionSortDir] = useState<QuestionSortDir>(
    DEFAULT_QUESTION_TABLE_SORT.sortDir
  );
  const [memberPage, setMemberPage] = useState(1);
  const [pointBurst, setPointBurst] = useState<QuestionPointBurst | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState("");
  const [newQuestionDescription, setNewQuestionDescription] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newQuestionLink, setNewQuestionLink] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [practiceDate, setPracticeDate] = useState(toDateInputValue());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInterviewDate, setEditInterviewDate] = useState("");
  const [editWeeklyGoal, setEditWeeklyGoal] = useState("5");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<string | null>(null);
  const [questionSearchInput, setQuestionSearchInput] = useState("");
  const debouncedQuestionSearch = useDebouncedValue(questionSearchInput, 300);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<GroupDetail>(
        `/api/groups/${groupId}?include=subjects`,
        {
          onCached: (c) => {
            setGroup(c);
            setSubjects(c.subjects ?? []);
            setLoading(false);
          },
        }
      );
      const subjectData = data.subjects ?? [];
      setGroup(data);
      setSubjects(subjectData);
      setNewSubjectId((current) =>
        current || subjectData.length === 0 ? current : subjectData[0]._id
      );
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load group"));
      if (!silent) setGroup(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [groupId]);

  const loadGroupQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const searchQ = debouncedQuestionSearch.trim()
        ? `&search=${encodeURIComponent(debouncedQuestionSearch.trim())}`
        : "";
      const data = await apiGet<PagedGroupQuestions>(
        `/api/practice-questions?groupId=${groupId}&scope=group&period=all&page=${questionPage}&limit=${GROUP_QUESTIONS_PAGE_SIZE}&sortBy=${questionSortBy}&sortDir=${questionSortDir}${searchQ}`,
        {
          onCached: (c) => {
            const items = Array.isArray(c) ? c : (c.items ?? []);
            setGroupQuestions(items);
            setQuestionTotal(Array.isArray(c) ? c.length : (c.total ?? items.length));
            setQuestionsLoading(false);
          },
        }
      );
      const items = Array.isArray(data) ? data : (data.items ?? []);
      const total = Array.isArray(data) ? data.length : (data.total ?? items.length);
      setGroupQuestions(items);
      setQuestionTotal(total);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load group questions"));
    } finally {
      setQuestionsLoading(false);
    }
  }, [groupId, questionPage, questionSortBy, questionSortDir, debouncedQuestionSearch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadGroupQuestions(); }, [loadGroupQuestions]);

  useEffect(() => {
    setQuestionPage(1);
  }, [debouncedQuestionSearch]);

  const handleQuestionSort = (field: QuestionSortField) => {
    const next = toggleQuestionSort(field, questionSortBy, questionSortDir);
    setQuestionSortBy(next.sortBy);
    setQuestionSortDir(next.sortDir);
    setQuestionPage(1);
  };

  const membersByJoinDate = useMemo(() => {
    if (!group) return [];
    const joinedAt = new Map(
      group.members.map((m) => [String(m.userId), new Date(m.joinedAt).getTime()])
    );
    // Admin (owner) first, then co-admins, then members; newest joiners first within each tier.
    const roleRank: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    const roles = new Map(group.members.map((m) => [String(m.userId), m.role]));
    const rank = (userId: string) => roleRank[roles.get(userId) ?? "member"] ?? 2;
    return [...group.memberStats].sort(
      (a, b) =>
        rank(a.userId) - rank(b.userId) ||
        (joinedAt.get(b.userId) ?? 0) - (joinedAt.get(a.userId) ?? 0)
    );
  }, [group]);

  const memberPageItems = useMemo(
    () => sliceTablePage(membersByJoinDate, memberPage, TABLE_PAGE_SIZE),
    [membersByJoinDate, memberPage]
  );

  const updateQuestionStatus = async (id: string, status: QuestionStatus) => {
    const normalized = normalizeQuestionStatus(status);
    const current = groupQuestions.find((q) => String(q._id) === String(id));
    if (!current) return;
    const previousStatus = normalizeQuestionStatus(current.status ?? "not_started");

    setGroupQuestions((prev) =>
      prev.map((q) => (String(q._id) === String(id) ? { ...q, status: normalized } : q))
    );

    try {
      const updated = await apiPatch<{ status?: QuestionStatus; pointsEarnedNow?: number }>(
        `/api/practice-questions/${id}`,
        { status: normalized }
      );
      const savedStatus = normalizeQuestionStatus(updated.status ?? normalized);
      setGroupQuestions((prev) =>
        prev.map((q) => (String(q._id) === String(id) ? { ...q, status: savedStatus } : q))
      );
      const earned = updated.pointsEarnedNow;
      triggerQuestionPointsBurst(setPointBurst, id, earned);
      if (earned != null && earned > 0 && user?._id) {
        setGroup((prev) => {
          if (!prev?.gamification) return prev;
          const leaderboard = prev.gamification.leaderboard
            .map((m) =>
              m.userId === user._id ? { ...m, totalPoints: m.totalPoints + earned } : m
            )
            .sort((a, b) => b.totalPoints - a.totalPoints);
          return { ...prev, gamification: { ...prev.gamification, leaderboard } };
        });
      }
    } catch (err) {
      setGroupQuestions((prev) =>
        prev.map((q) => (String(q._id) === String(id) ? { ...q, status: previousStatus } : q))
      );
      toast.error(getErrorMessage(err, "Failed to update question"));
    }
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setNewQuestionTitle("");
    setNewQuestionDescription("");
    setNewQuestionLink("");
    setPracticeDate(toDateInputValue());
  };

  const openAddQuestion = () => {
    resetQuestionForm();
    setShowQuestionModal(true);
  };

  const closeQuestionModal = () => {
    setShowQuestionModal(false);
    resetQuestionForm();
  };

  const openEditQuestion = (q: { _id: string }) => {
    const full = groupQuestions.find((item) => String(item._id) === String(q._id));
    if (!full) return;
    const parts = splitQuestionFields(full.content);
    setEditingQuestionId(String(full._id));
    setNewQuestionTitle(parts.title);
    setNewQuestionDescription(parts.description);
    setNewQuestionLink(full.link ?? "");
    setPracticeDate(questionPracticeDay(full));
    setNewSubjectId(String(full.subjectId));
    setShowQuestionModal(true);
  };

  const saveGroupQuestion = async () => {
    if (!user || !newQuestionTitle.trim() || !newSubjectId) return;
    const payload = {
      title: newQuestionTitle.trim(),
      description: newQuestionDescription.trim(),
      link: newQuestionLink.trim() || undefined,
      subjectId: newSubjectId,
      practiceDate: practiceDate.trim() ? practiceDate : null,
    };
    setSavingQuestion(true);
    try {
      if (editingQuestionId) {
        await apiPatch(`/api/practice-questions/${editingQuestionId}`, payload);
        toast.success("Question updated");
        loadGroupQuestions();
      } else {
        await apiPost("/api/practice-questions", { groupId, scope: "group", ...payload });
        toast.success("Question added for everyone");
        if (questionPage !== 1) setQuestionPage(1);
        else loadGroupQuestions();
      }
      closeQuestionModal();
      load({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, editingQuestionId ? "Failed to update question" : "Failed to add question"));
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteGroupQuestion = async (id: string) => {
    try {
      await apiDelete(`/api/practice-questions/${id}`);
      toast.success("Question deleted");
      const lastOnPage = groupQuestions.length === 1 && questionPage > 1;
      if (lastOnPage) setQuestionPage(questionPage - 1);
      else loadGroupQuestions();
      load({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete question"));
    }
  };

  const generateInviteCode = useCallback(async (opts?: { force?: boolean }) => {
    setInviteLoading(true);
    try {
      const res = await apiPost<{ joinCode: string; joinCodeExpiresAt: string }>(
        `/api/groups/${groupId}/regenerate-code`,
        opts?.force ? { force: true } : {}
      );
      setGroup((prev) =>
        prev
          ? { ...prev, joinCode: res.joinCode, joinCodeExpiresAt: res.joinCodeExpiresAt }
          : prev
      );
      toast.success("Invite code ready to share");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate invite code"));
    } finally {
      setInviteLoading(false);
    }
  }, [groupId]);

  const myRole = (
    group?.memberStats.find((m) => m.userId === user?._id)?.role ??
    group?.members.find((m) => String(m.userId) === user?._id)?.role
  ) as GroupRole | undefined;
  const isGroupAdmin = isGroupAdminRole(myRole);
  const canEditGroup = canManageGroup(myRole);
  const setHeaderActions = useGroupHeaderActions();

  const openEditModal = useCallback(() => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditInterviewDate(group.interviewDate ? toDateInputValue(group.interviewDate) : "");
    setEditWeeklyGoal(String(group.weeklyGoalPerMember ?? 5));
    setTransferTargetId("");
    setShowEditModal(true);
  }, [group]);

  useEffect(() => {
    if (!setHeaderActions) return;
    if (canEditGroup) {
      setHeaderActions(
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("invite-members")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            Invite
          </Button>
          <Button variant="outline" size="sm" onClick={openEditModal}>
            Edit Group
          </Button>
        </div>
      );
    } else {
      setHeaderActions(null);
    }
    return () => setHeaderActions(null);
  }, [canEditGroup, setHeaderActions, openEditModal]);

  const saveGroup = async () => {
    const goal = Number(editWeeklyGoal);
    if (!editName.trim() || !Number.isInteger(goal) || goal < 1 || goal > 100) return;
    setSavingGroup(true);
    try {
      const updated = await apiPatch<Group>(`/api/groups/${groupId}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        interviewDate: editInterviewDate || null,
        weeklyGoalPerMember: goal,
      });
      setGroup((prev) => (prev ? { ...prev, ...updated } : prev));
      setShowEditModal(false);
      toast.success("Group updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update group"));
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async () => {
    setDeletingGroup(true);
    try {
      await apiDelete(`/api/groups/${groupId}`);
      await refreshUser();
      toast.success("Group deleted");
      router.push("/groups");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete group"));
    } finally {
      setDeletingGroup(false);
    }
  };

  const setMemberRole = async (memberId: string, role: "admin" | "member") => {
    setUpdatingRoleMemberId(memberId);
    try {
      const updated = await apiPatch<Group>(
        `/api/groups/${groupId}/members/${memberId}`,
        { role }
      );
      setGroup((prev) => (prev ? mergeGroupMembers(prev, updated) : prev));
      toast.success(role === "admin" ? "Co-admin added" : "Co-admin removed");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update role"));
    } finally {
      setUpdatingRoleMemberId(null);
    }
  };

  const removeMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      const updated = await apiDelete<Group>(
        `/api/groups/${groupId}/members/${memberId}`
      );
      if (memberId === user?._id) {
        await refreshUser();
        toast.success("You left the group");
        router.push("/groups");
        return;
      }
      setGroup((prev) => (prev ? mergeGroupMembers(prev, updated) : prev));
      toast.success("Member removed");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove member"));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const transferOwnership = async () => {
    if (!transferTargetId) return;
    setTransferring(true);
    try {
      const updated = await apiPost<Group>(`/api/groups/${groupId}/transfer-ownership`, {
        newOwnerId: transferTargetId,
      });
      setGroup((prev) => (prev ? mergeGroupMembers(prev, updated) : prev));
      toast.success("Admin role transferred");
      setShowEditModal(false);
      setTransferTargetId("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to transfer admin role"));
    } finally {
      setTransferring(false);
    }
  };

  const otherMembers = group?.memberStats.filter(
    (m) => m.userId !== user?._id && !isGroupAdminRole(m.role)
  ) ?? [];

  if (loading) return <GroupDetailSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!group) return <ErrorState message="Group not found" onRetry={load} />;

  return (
    <div className="space-y-6">
      {group.countdown?.interviewDate && (
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {group.countdown.isPast
                  ? "Interview date has passed"
                  : group.countdown.days === 0
                    ? `Interview today${group.countdown.hours > 0 ? ` · ${group.countdown.hours}h to go` : ""}`
                    : `${group.countdown.days} day${group.countdown.days === 1 ? "" : "s"} to the interview`}
              </p>
              <p className="text-xs text-[var(--muted)]">{formatDate(group.countdown.interviewDate)}</p>
            </div>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader
          title="Group Questions"
          subtitle={
            questionTotal > 0
              ? `${questionTotal} shared question${questionTotal === 1 ? "" : "s"} — each member tracks their own progress`
              : "Shared with everyone — each member tracks their own progress"
          }
          action={
            <div className="flex gap-2">
              <Button href="/questions" variant="outline" size="sm">View All</Button>
              {canEditGroup && (
                <Button size="sm" onClick={openAddQuestion} disabled={subjects.length === 0}>
                  Add Question
                </Button>
              )}
            </div>
          }
        />
        <div className="space-y-3">
          <QuestionTableSearch
            value={questionSearchInput}
            onChange={setQuestionSearchInput}
            inputId="group-questions-search"
            className="max-w-md"
          />
          {questionTotal === 0 && !questionsLoading ? (
            <p className="text-sm text-[var(--muted)]">
              {debouncedQuestionSearch.trim()
                ? "No group questions match your search."
                : "No group questions yet. Add questions everyone should practice together."}
            </p>
          ) : (
            <>
              <QuestionListView
                pointBurst={pointBurst}
                questions={groupQuestions.map((q) => ({ ...q, scope: "group" as const }))}
                onStatusChange={updateQuestionStatus}
                onEdit={canEditGroup ? openEditQuestion : undefined}
                onDelete={canEditGroup ? deleteGroupQuestion : undefined}
                showActions={canEditGroup}
                sortBy={questionSortBy}
                sortDir={questionSortDir}
                onSort={handleQuestionSort}
                loading={questionsLoading}
                localSearch={questionSearchInput}
              />
              <TablePagination
                page={questionPage}
                total={questionTotal}
                pageSize={GROUP_QUESTIONS_PAGE_SIZE}
                loading={questionsLoading}
                onPageChange={setQuestionPage}
              />
            </>
          )}
        </div>
      </Card>

      <GroupMomentumPanel groupId={group._id} />

      {group.gamification && <GroupGamificationPanel gamification={group.gamification} />}

      <Card padding="sm">
        <CardHeader
          title={`Members (${group.memberStats.length}/${MAX_GROUP_MEMBERS})`}
          subtitle={
            isGroupAdmin
              ? "Promote members to co-admin using Make co-admin in the Actions column."
              : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Group members</caption>
            <thead>
              <tr className="table-head">
                <th scope="col" className="pb-2">Member</th>
                <th scope="col" className="pb-2">Role</th>
                <th scope="col" className="pb-2">Solved</th>
                <th scope="col" className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberPageItems.map((m) => {
                const points =
                  group.gamification?.leaderboard.find((g) => g.userId === m.userId)?.totalPoints ?? 0;
                const isMe = m.userId === user?._id;
                const targetRole = (m.role ??
                  group.members.find((gm) => String(gm.userId) === m.userId)?.role ??
                  "member") as GroupRole;
                const canRemove = canRemoveGroupMember(myRole, targetRole, isMe);
                const canChangeRole =
                  canPromoteToCoAdmin(myRole) && !isMe && !isGroupAdminRole(targetRole);
                return (
                  <tr key={m.userId} className="table-row">
                    <td className="py-2.5 font-medium">
                      <Link href={`/users/${m.userId}`} className="text-brand hover:underline">
                        {m.name}
                        {isMe ? " (you)" : ""}
                      </Link>
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">{formatGroupRoleLabel(targetRole)}</td>
                    <td className="py-2.5 font-semibold text-brand">{points}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {canChangeRole && targetRole === "member" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingRoleMemberId === m.userId}
                            onClick={() => setMemberRole(m.userId, "admin")}
                          >
                            {updatingRoleMemberId === m.userId ? "…" : "Make co-admin"}
                          </Button>
                        )}
                        {canChangeRole && targetRole === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingRoleMemberId === m.userId}
                            onClick={() => setMemberRole(m.userId, "member")}
                          >
                            {updatingRoleMemberId === m.userId ? "…" : "Remove co-admin"}
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removingMemberId === m.userId}
                            onClick={async () => {
                              const ok = await confirm(
                                isMe
                                  ? {
                                      title: "Leave group?",
                                      message:
                                        "Leave this group? You can rejoin with an invite code.",
                                      confirmLabel: "Leave",
                                    }
                                  : {
                                      title: "Remove member?",
                                      message: `Remove ${m.name} from the group?`,
                                      confirmLabel: "Remove",
                                    }
                              );
                              if (!ok) return;
                              removeMember(m.userId);
                            }}
                          >
                            {removingMemberId === m.userId
                              ? "…"
                              : isMe
                                ? "Leave"
                                : "Remove"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <TablePagination
            page={memberPage}
            total={group.memberStats.length}
            onPageChange={setMemberPage}
          />
        </div>
      </Card>

      <div id="invite-members" className="scroll-mt-6">
      <Card>
        <CardHeader title="Invite Members" />
        {canEditGroup ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Generate a short-lived invite code when you are ready to add someone. Codes expire after{" "}
              {JOIN_CODE_TTL_MINUTES} minutes.
            </p>
            {isGroupFull(group.memberStats.length) ? (
              <p className="text-sm text-[var(--muted)]">
                Group is full ({MAX_GROUP_MEMBERS}/{MAX_GROUP_MEMBERS} members).
              </p>
            ) : (
              <InviteCodeBlock
                joinCode={group.joinCode}
                joinCodeExpiresAt={group.joinCodeExpiresAt}
                onGenerate={generateInviteCode}
                generating={inviteLoading}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Ask a group admin or co-admin for a fresh invite code when you want to add a teammate.
          </p>
        )}
      </Card>
      </div>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Group">
        <div className="space-y-5">
          <div className="space-y-3">
            <FormField label="Group name">
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </FormField>
            <FormField label="Description">
              <Input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
            <FormField
              label="Interview date"
              hint="Shown to everyone as a countdown. Leave empty if there isn't one yet."
            >
              <DatePicker
                value={editInterviewDate}
                onChange={setEditInterviewDate}
                clearable
                placeholder="Not set"
              />
            </FormField>
            <FormField
              label="Weekly goal per member"
              hint="Questions each person aims to solve per week. The group target is this times the members."
            >
              <Input
                type="number"
                min={1}
                max={100}
                value={editWeeklyGoal}
                onChange={(e) => setEditWeeklyGoal(e.target.value)}
                className="max-w-[8rem]"
              />
            </FormField>
          </div>

          {isGroupAdmin && otherMembers.length > 0 && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Transfer admin role</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  New admin takes over; you become a regular member. The admin can&apos;t leave a group, so transfer the role first if you want to leave.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={transferTargetId}
                  onChange={setTransferTargetId}
                  aria-label="New admin"
                  placeholder="Select member…"
                  className="min-w-0 flex-1"
                  options={otherMembers.map((m) => ({ value: m.userId, label: m.name }))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 sm:w-auto"
                  loading={transferring}
                  disabled={!transferTargetId}
                  onClick={transferOwnership}
                >
                  {transferring ? "Transferring…" : "Transfer"}
                </Button>
              </div>
            </div>
          )}

          {isGroupAdmin && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Delete group</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Permanently deletes <strong>{group.name}</strong> and all questions, tracks, and
                  progress.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                loading={deletingGroup}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete group?",
                    message: `Delete "${group.name}" and all questions, tracks, and progress? This cannot be undone.`,
                    confirmLabel: "Delete group",
                  });
                  if (!ok) return;
                  deleteGroup();
                }}
              >
                {deletingGroup ? "Deleting…" : "Delete group"}
              </Button>
            </div>
          )}

          <ModalFooter onCancel={() => setShowEditModal(false)} cancelDisabled={savingGroup} className="!mt-5">
            <Button
              onClick={saveGroup}
              loading={savingGroup}
              disabled={
                !editName.trim() ||
                !Number.isInteger(Number(editWeeklyGoal)) ||
                Number(editWeeklyGoal) < 1 ||
                Number(editWeeklyGoal) > 100
              }
            >
              {savingGroup ? "Saving…" : "Save changes"}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      <QuestionFormModal
        open={showQuestionModal}
        onClose={closeQuestionModal}
        editing={Boolean(editingQuestionId)}
        values={{
          title: newQuestionTitle,
          description: newQuestionDescription,
          link: newQuestionLink,
          subjectId: newSubjectId,
          practiceDate,
          scope: "group",
        }}
        onChange={(patch) => {
          if (patch.title !== undefined) setNewQuestionTitle(patch.title);
          if (patch.description !== undefined) setNewQuestionDescription(patch.description);
          if (patch.link !== undefined) setNewQuestionLink(patch.link);
          if (patch.subjectId !== undefined) setNewSubjectId(patch.subjectId);
          if (patch.practiceDate !== undefined) setPracticeDate(patch.practiceDate);
        }}
        tracks={subjects.filter((sb) => sb.scope !== "personal")}
        canChooseScope={false}
        saving={savingQuestion}
        onSave={saveGroupQuestion}
        onCreateTrack={async (name) => {
          try {
            await apiPost("/api/subjects", { groupId, name, scope: "group" });
            toast.success("Track created");
            await load({ silent: true });
          } catch (err) {
            toast.error(getErrorMessage(err, "Couldn't create the track"));
          }
        }}
      />
    </div>
  );
}

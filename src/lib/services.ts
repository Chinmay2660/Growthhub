import mongoose from "mongoose";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import QuestionProgress from "@/models/QuestionProgress";
import PracticeQuestion from "@/models/PracticeQuestion";
import MockInterview from "@/models/MockInterview";
import MockInterviewSession from "@/models/MockInterviewSession";
import MockInterviewSlot from "@/models/MockInterviewSlot";
import MockInterviewRound from "@/models/MockInterviewRound";
import StudySession from "@/models/StudySession";
import PreparationPlan from "@/models/PreparationPlan";
import GroupNote from "@/models/GroupNote";
import type { GroupRole } from "@/types";
import { canManageGroup } from "@/lib/group-roles";
import { generateJoinCode } from "@/lib/auth";

export { canManageGroup };
import {
  formatSubjectTrack,
  joinCodeExpiryDate,
  needsJoinCodeReissue,
  normalizeQuestionStatus,
  questionDatePeriodRange,
  serializeDoc,
  startOfDay,
} from "./utils";
import { questionProgressFields, questionStatusForUser } from "./question-progress";
import { NATIVE_PERSONAL_QUESTION_FILTER } from "./practice-question-filters";
import type { ContentUnit, TodayQuestion } from "@/types";
import {
  buildGroupGamification,
  buildMemberGamification,
  type GroupGamification,
} from "./question-gamification";
import { getCached, groupInsightsCacheKey, invalidateCachePrefix } from "./ttl-cache";

const GROUP_INSIGHTS_TTL_MS = 30_000;

export function invalidateGroupInsights(groupId: string): void {
  invalidateCachePrefix(groupInsightsCacheKey(groupId));
  invalidateCachePrefix("analytics:");
}

type GroupStatsContext = {
  topics: { _id: mongoose.Types.ObjectId; status: string; confidence: string }[];
  users: { _id: mongoose.Types.ObjectId; name?: string; studyStreak?: number }[];
  topicProgress: {
    userId: mongoose.Types.ObjectId;
    topicId: mongoose.Types.ObjectId;
    status?: string;
    confidence?: string;
  }[];
  mocks: { userId: mongoose.Types.ObjectId; score: number }[];
  group: { interviewDate?: Date } | null;
  questions: {
    _id: mongoose.Types.ObjectId;
    practiceDate?: Date;
    createdAt: Date;
  }[];
  questionProgress: {
    userId: mongoose.Types.ObjectId;
    questionId: mongoose.Types.ObjectId;
    status?: string;
    lastPracticed?: Date;
    pointsAwarded?: number;
    firstCompletedAt?: Date;
  }[];
};

async function loadGroupStatsContext(
  groupId: string,
  memberIds: string[]
): Promise<GroupStatsContext | null> {
  if (memberIds.length === 0) return null;

  const objectIds = memberIds.map((id) => new mongoose.Types.ObjectId(id));

  const topics = await Topic.find({ groupId }).lean();
  const topicIds = topics.map((t) => t._id);
  // Questions of archived (inactive) tracks are not part of anyone's progress or the leaderboard.
  const activeSubjects = await Subject.find({ groupId, scope: "group", isActive: true }).select("_id").lean();
  const activeSubjectIds = new Set(activeSubjects.map((s) => String(s._id)));
  const questions = (await PracticeQuestion.find({ groupId, scope: "group" }).lean()).filter((q) =>
    activeSubjectIds.has(String(q.subjectId))
  );
  const questionIds = questions.map((q) => q._id);

  const [users, topicProgress, mocks, group, questionProgress] = await Promise.all([
    User.find({ _id: { $in: objectIds } }).lean(),
    topicIds.length > 0
      ? TopicProgress.find({ userId: { $in: objectIds }, topicId: { $in: topicIds } }).lean()
      : Promise.resolve([]),
    MockInterview.find({ userId: { $in: objectIds }, groupId }).lean(),
    Group.findById(groupId).lean(),
    questionIds.length > 0
      ? QuestionProgress.find({
          userId: { $in: objectIds },
          questionId: { $in: questionIds },
        }).lean()
      : Promise.resolve([]),
  ]);

  return {
    topics,
    users,
    topicProgress,
    mocks,
    group,
    questions,
    questionProgress,
  };
}

function memberStatsFrom(
  memberIds: string[],
  roleMap: Map<string, GroupRole> | undefined,
  ctx: GroupStatsContext,
  gamification: GroupGamification
): MemberStat[] {
  const userMap = new Map(ctx.users.map((u) => [String(u._id), u]));
  const solved = new Map(gamification.leaderboard.map((m) => [m.userId, m.totalPoints]));
  return memberIds.map((userId) => ({
    userId,
    name: userMap.get(userId)?.name ?? "Unknown",
    questionsSolved: solved.get(userId) ?? 0,
    role: roleMap?.get(userId),
  }));
}

function gamificationFromContext(memberIds: string[], ctx: GroupStatsContext): GroupGamification {
  const userMap = new Map(ctx.users.map((u) => [String(u._id), u.name]));
  const progressByUser = new Map<string, Map<string, (typeof ctx.questionProgress)[number]>>();
  for (const p of ctx.questionProgress) {
    const uid = String(p.userId);
    const byQuestion = progressByUser.get(uid) ?? new Map();
    byQuestion.set(String(p.questionId), p);
    progressByUser.set(uid, byQuestion);
  }

  const members = memberIds.map((userId) => {
    const byQuestion = progressByUser.get(userId) ?? new Map();
    const memberQuestions = ctx.questions.map((q) => {
      const p = byQuestion.get(String(q._id));
      return {
        _id: String(q._id),
        practiceDate: q.practiceDate ?? q.createdAt,
        createdAt: q.createdAt,
        status: normalizeQuestionStatus(p?.status ?? "not_started"),
        lastPracticed: p?.lastPracticed,
        pointsAwarded: p?.pointsAwarded,
        firstCompletedAt: p?.firstCompletedAt,
      };
    });
    return buildMemberGamification(userId, userMap.get(userId) ?? "Unknown", memberQuestions);
  });

  return buildGroupGamification(members);
}

export async function seedGroupSubjects(groupId: string, subjectNames: string[]) {
  const created = [];
  for (let i = 0; i < subjectNames.length; i++) {
    const name = subjectNames[i]?.trim();
    if (!name) continue;
    const subject = await Subject.create({
      groupId,
      scope: "group",
      name,
      priority: i < 2 ? "high" : "medium",
      order: i,
    });
    created.push(subject);
  }
  return created;
}

export async function ensureTopicProgress(userId: string, groupId: string) {
  const topics = await Topic.find({ groupId }).lean();
  const existing = await TopicProgress.find({
    userId,
    topicId: { $in: topics.map((t) => t._id) },
  }).lean();
  const existingIds = new Set(existing.map((e) => String(e.topicId)));

  const toCreate = topics
    .filter((t) => !existingIds.has(String(t._id)))
    .map((t) => ({ userId, topicId: t._id }));

  if (toCreate.length > 0) {
    await TopicProgress.insertMany(toCreate);
  }
}

async function ensurePersonalSubjectForGroupSubject(
  userId: string,
  groupSubjectId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId> {
  const groupSubject = await Subject.findById(groupSubjectId).lean();
  if (!groupSubject) throw new Error("Subject not found");

  const existing = await Subject.findOne({
    userId,
    scope: "personal",
    name: groupSubject.name,
    isActive: true,
  }).lean();
  if (existing) return existing._id;

  const count = await Subject.countDocuments({ userId, scope: "personal" });
  const created = await Subject.create({
    userId,
    scope: "personal",
    name: groupSubject.name,
    priority: groupSubject.priority,
    order: count,
  });
  return created._id;
}

export async function syncGroupProgressToPersonal(
  userId: string,
  groupQuestion: {
    _id: mongoose.Types.ObjectId;
    groupId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    topicId?: mongoose.Types.ObjectId;
    practiceDate?: Date;
    content: string;
    link?: string;
    difficulty: "easy" | "medium" | "hard";
  },
  progress: {
    status: "not_started" | "in_progress" | "revised" | "done";
    confidence: "weak" | "okay" | "strong";
    lastPracticed?: Date;
    notes?: string;
  }
) {
  if (progress.status === "not_started") return;

  const personalSubjectId = await ensurePersonalSubjectForGroupSubject(
    userId,
    groupQuestion.subjectId
  );

  await PracticeQuestion.findOneAndUpdate(
    { userId, sourceGroupQuestionId: groupQuestion._id, scope: "personal" },
    {
      $setOnInsert: {
        userId,
        groupId: groupQuestion.groupId,
        scope: "personal",
        sourceGroupQuestionId: groupQuestion._id,
        subjectId: personalSubjectId,
        topicId: groupQuestion.topicId,
        practiceDate: groupQuestion.practiceDate ?? new Date(),
        content: groupQuestion.content,
        link: groupQuestion.link,
        difficulty: groupQuestion.difficulty,
      },
      $set: {
        status: progress.status,
        confidence: progress.confidence,
        lastPracticed: progress.lastPracticed,
        notes: progress.notes,
      },
    },
    { upsert: true }
  );
}

export async function seedQuestionProgressForMembers(questionId: string, groupId: string) {
  const group = await Group.findById(groupId).lean();
  if (!group) return;

  const memberIds = group.members.map((m) => m.userId);
  const existing = await QuestionProgress.find({
    questionId,
    userId: { $in: memberIds },
  }).lean();
  const existingUserIds = new Set(existing.map((e) => String(e.userId)));

  const missing = memberIds.filter((id) => !existingUserIds.has(String(id)));
  if (missing.length === 0) return;

  const qid = new mongoose.Types.ObjectId(questionId);
  await QuestionProgress.bulkWrite(
    missing.map((userId) => ({
      updateOne: {
        filter: { userId, questionId: qid },
        update: {
          $setOnInsert: {
            userId,
            questionId: qid,
            status: "not_started",
            confidence: "weak",
          },
        },
        upsert: true,
      },
    }))
  );
}

export function isGroupMember(
  group: { members?: { userId: mongoose.Types.ObjectId; role: GroupRole }[] },
  userId: string
): GroupRole | null {
  const member = (group.members ?? []).find((m) => String(m.userId) === userId);
  return member?.role ?? null;
}

export async function issueJoinCode(
  group: InstanceType<typeof Group>,
  excludeId?: string
): Promise<{ joinCode: string; joinCodeExpiresAt: Date }> {
  let joinCode = generateJoinCode();
  while (await Group.findOne({ joinCode, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    joinCode = generateJoinCode();
  }
  group.joinCode = joinCode;
  group.joinCodeExpiresAt = joinCodeExpiryDate();
  await group.save();
  return { joinCode, joinCodeExpiresAt: group.joinCodeExpiresAt };
}

export async function ensureFreshJoinCodeForOwner(
  groupId: string,
  userId: string
): Promise<InstanceType<typeof Group> | null> {
  const group = await Group.findById(groupId);
  if (!group) return null;
  if (!canManageGroup(isGroupMember(group, userId))) return group;
  if (!needsJoinCodeReissue(group.joinCode, group.joinCodeExpiresAt)) return group;
  await issueJoinCode(group, groupId);
  return group;
}

/** ponytail: deletes group-scoped data; upgrade path is soft-delete + archive if retention needed */
export async function deleteGroupData(groupId: string) {
  const gid = new mongoose.Types.ObjectId(groupId);
  const [questionIds, topicIds] = await Promise.all([
    PracticeQuestion.find({ groupId: gid }).distinct("_id"),
    Topic.find({ groupId: gid }).distinct("_id"),
  ]);

  await Promise.all([
    PracticeQuestion.deleteMany({ groupId: gid }),
    questionIds.length > 0
      ? QuestionProgress.deleteMany({ questionId: { $in: questionIds } })
      : Promise.resolve(),
    Subject.deleteMany({ groupId: gid }),
    Topic.deleteMany({ groupId: gid }),
    topicIds.length > 0
      ? TopicProgress.deleteMany({ topicId: { $in: topicIds } })
      : Promise.resolve(),
    MockInterview.deleteMany({ groupId: gid }),
    MockInterviewSession.deleteMany({ groupId: gid }),
    MockInterviewSlot.deleteMany({ groupId: gid }),
    MockInterviewRound.deleteMany({ groupId: gid }),
    GroupNote.deleteMany({ groupId: gid }),
    StudySession.deleteMany({ groupId: gid }),
    PreparationPlan.deleteMany({ groupId: gid }),
  ]);
}

/** Removes a track and its questions, topics, and related progress. */
export async function deleteSubjectData(subjectId: string) {
  const sid = new mongoose.Types.ObjectId(subjectId);
  const [questionIds, topicIds] = await Promise.all([
    PracticeQuestion.find({ subjectId: sid }).distinct("_id"),
    Topic.find({ subjectId: sid }).distinct("_id"),
  ]);

  await PracticeQuestion.deleteMany({
    $or: [
      { subjectId: sid },
      ...(questionIds.length > 0
        ? [{ sourceGroupQuestionId: { $in: questionIds }, scope: "personal" as const }]
        : []),
    ],
  });

  await Promise.all([
    questionIds.length > 0
      ? QuestionProgress.deleteMany({ questionId: { $in: questionIds } })
      : Promise.resolve(),
    topicIds.length > 0
      ? TopicProgress.deleteMany({ topicId: { $in: topicIds } })
      : Promise.resolve(),
    Topic.deleteMany({ subjectId: sid }),
    MockInterview.deleteMany({ subjectId: sid }),
    MockInterviewSession.deleteMany({ "questions.subjectId": sid }),
    StudySession.deleteMany({ subjectId: sid }),
    PreparationPlan.deleteMany({ subjectId: sid }),
    Subject.deleteOne({ _id: sid }),
  ]);
}

/**
 * Called after a group is deleted: everyone who had it active is moved to another group they still
 * belong to (the newest one), or has the setting cleared when they have none.
 */
export async function clearActiveGroupForMembers(groupId: string) {
  const gid = new mongoose.Types.ObjectId(groupId);
  const affected = await User.find({ activeGroupId: gid }).select("_id").lean();
  for (const u of affected) {
    const fallback = await Group.findOne({ "members.userId": u._id, _id: { $ne: gid } })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();
    await User.updateOne({ _id: u._id }, fallback ? { activeGroupId: fallback._id } : { $unset: { activeGroupId: 1 } });
  }
}

/**
 * The user's active group, verified. If it is unset, deleted, or they have left it, they are moved
 * to another group they belong to (and that is saved), or null when they are in none.
 */
export async function resolveActiveGroupId(
  userId: string,
  activeGroupId?: mongoose.Types.ObjectId | string | null
): Promise<string | null> {
  const uid = new mongoose.Types.ObjectId(userId);
  if (activeGroupId && (await Group.exists({ _id: activeGroupId, "members.userId": uid }))) {
    return String(activeGroupId);
  }
  const fallback = await Group.findOne({ "members.userId": uid }).sort({ createdAt: -1 }).select("_id").lean();
  if (fallback) {
    await User.updateOne({ _id: uid }, { activeGroupId: fallback._id });
    return String(fallback._id);
  }
  if (activeGroupId) await User.updateOne({ _id: uid }, { $unset: { activeGroupId: 1 } });
  return null;
}

export interface MemberStat {
  userId: string;
  name: string;
  questionsSolved: number;
  role?: GroupRole;
}

export async function getGroupInsights(
  groupId: string,
  memberIds: string[],
  roleMap?: Map<string, GroupRole>
): Promise<{ memberStats: MemberStat[]; gamification: GroupGamification }> {
  return getCached(groupInsightsCacheKey(groupId), GROUP_INSIGHTS_TTL_MS, async () => {
    const ctx = await loadGroupStatsContext(groupId, memberIds);
    if (!ctx) {
      return { memberStats: [], gamification: buildGroupGamification([]) };
    }
    const gamification = gamificationFromContext(memberIds, ctx);
    return {
      memberStats: memberStatsFrom(memberIds, roleMap, ctx, gamification),
      gamification,
    };
  });
}

export async function getMemberStatsBatch(
  memberIds: string[],
  groupId: string,
  roleMap?: Map<string, GroupRole>
): Promise<MemberStat[]> {
  const ctx = await loadGroupStatsContext(groupId, memberIds);
  if (!ctx) return [];
  return memberStatsFrom(memberIds, roleMap, ctx, gamificationFromContext(memberIds, ctx));
}

export async function getGroupGamificationStats(
  groupId: string,
  memberIds: string[]
): Promise<GroupGamification> {
  const ctx = await loadGroupStatsContext(groupId, memberIds);
  if (!ctx) return buildGroupGamification([]);
  return gamificationFromContext(memberIds, ctx);
}

/** Group tab question list — one DB round-trip for progress (scoped by question ids). */
export async function listGroupPracticeQuestionsForUser(groupId: string, userId: string) {
  const [questions, subjects] = await Promise.all([
    PracticeQuestion.find({ groupId, scope: "group" })
      .sort({ practiceDate: -1, createdAt: -1 })
      .lean(),
    Subject.find({ groupId, scope: "group", isActive: true })
      .sort({ order: 1 })
      .select("name totalQuestions contentUnit")
      .lean(),
  ]);

  const questionIds = questions.map((q) => q._id);
  const progress =
    questionIds.length > 0
      ? await QuestionProgress.find({
          userId,
          questionId: { $in: questionIds },
        }).lean()
      : [];

  const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
  const progressMap = new Map(progress.map((p) => [String(p.questionId), p]));
  const activeSubjectIds = new Set(subjectMap.keys());

  return questions
    .filter((q) => activeSubjectIds.has(String(q.subjectId)))
    .map((q) => {
    const base = serializeDoc(q);
    const subject = subjectMap.get(String(q.subjectId));
    const p = progressMap.get(String(q._id));
    const practiceDate = q.practiceDate?.toISOString();
    const fields = questionProgressFields(p, q);
    return {
      ...base,
      ...(practiceDate ? { practiceDate } : {}),
      subjectName: subject?.name ?? "",
      trackLabel: subject
        ? formatSubjectTrack({
            name: subject.name,
            totalQuestions: subject.totalQuestions ?? 0,
            contentUnit: subject.contentUnit ?? "questions",
          })
        : "",
      ...fields,
    };
  });
}

function mapTodayQuestion(
  q: {
    _id: unknown;
    scope: "group" | "personal";
    content: string;
    subjectId: unknown;
    practiceDate?: Date;
    createdAt: Date;
    link?: string;
    status?: string;
  },
  subjectMap: Map<string, { name: string; totalQuestions?: number; contentUnit?: ContentUnit }>,
  progressMap: Map<string, { status?: string }>
): TodayQuestion {
  const subject = subjectMap.get(String(q.subjectId));
  const trackLabel = subject
    ? formatSubjectTrack({
        name: subject.name,
        totalQuestions: subject.totalQuestions ?? 0,
        contentUnit: subject.contentUnit ?? "questions",
      })
    : "";
  const status = questionStatusForUser(progressMap.get(String(q._id)), q);

  return {
    _id: String(q._id),
    content: q.content,
    scope: q.scope,
    subjectName: subject?.name ?? "",
    trackLabel,
    status,
    practiceDate: q.practiceDate?.toISOString(),
    link: q.link,
  };
}

export async function getTodayQuestionsForUser(
  userId: string,
  groupIdOrIds: string | string[]
): Promise<{ group: TodayQuestion[]; personal: TodayQuestion[] }> {
  const groupIds = Array.isArray(groupIdOrIds) ? groupIdOrIds : [groupIdOrIds];
  const range = questionDatePeriodRange("today");
  if (!range) return { group: [], personal: [] };

  const dateFilter = { practiceDate: { $gte: range.start, $lt: range.end } };

  const [groupQuestions, personalQuestions, subjects] = await Promise.all([
    PracticeQuestion.find({ groupId: { $in: groupIds }, scope: "group", ...dateFilter })
      .sort({ practiceDate: -1, createdAt: -1 })
      .lean(),
    // Personal questions belong to the person, not to whichever group they were added under.
    PracticeQuestion.find({
      userId,
      scope: "personal",
      ...NATIVE_PERSONAL_QUESTION_FILTER,
      ...dateFilter,
    })
      .sort({ practiceDate: -1, createdAt: -1 })
      .lean(),
    Subject.find({
      $or: [
        { groupId: { $in: groupIds }, scope: "group", isActive: true },
        { userId, scope: "personal", isActive: true },
      ],
    }).lean(),
  ]);

  const groupNames = new Map(
    (await Group.find({ _id: { $in: groupIds } }).select("_id name").lean()).map((g) => [String(g._id), g.name])
  );
  const questionIds = [
    ...groupQuestions.map((q) => q._id),
    ...personalQuestions.map((q) => q._id),
  ];
  const progress =
    questionIds.length > 0
      ? await QuestionProgress.find({ userId, questionId: { $in: questionIds } }).lean()
      : [];

  const subjectMap = new Map(
    subjects.map((s) => [
      String(s._id),
      { name: s.name, totalQuestions: s.totalQuestions, contentUnit: s.contentUnit },
    ])
  );
  const progressMap = new Map(progress.map((p) => [String(p.questionId), p]));
  const activeSubjectIds = new Set(subjectMap.keys());

  return {
    group: groupQuestions
      .filter((q) => activeSubjectIds.has(String(q.subjectId)))
      .map((q) => ({
        ...mapTodayQuestion({ ...q, scope: "group" }, subjectMap, progressMap),
        groupId: String(q.groupId),
        groupName: groupNames.get(String(q.groupId)),
      })),
    personal: personalQuestions
      .filter((q) => activeSubjectIds.has(String(q.subjectId)))
      .map((q) =>
        mapTodayQuestion({ ...q, scope: "personal" }, subjectMap, progressMap)
      ),
  };
}

/** Counts today as a study day (called whenever a question is practised or solved). */
export async function updateStudyStreak(userId: string) {
  const user = await User.findById(userId).select("studyStreak lastStudyDate").lean();
  if (!user) return;

  const today = startOfDay(new Date());
  const last = user.lastStudyDate ? startOfDay(new Date(user.lastStudyDate)) : null;
  let next = 1;
  if (last) {
    const gap = Math.round((today.getTime() - last.getTime()) / 86400000);
    if (gap <= 0) return; // already counted today
    next = gap === 1 ? (user.studyStreak ?? 0) + 1 : 1;
  }

  // Conditional write: two requests landing together must not both extend the streak.
  await User.updateOne(
    {
      _id: userId,
      $or: [{ lastStudyDate: { $exists: false } }, { lastStudyDate: null }, { lastStudyDate: { $lt: today } }],
    },
    { studyStreak: next, lastStudyDate: new Date() }
  );
}

export { serializeDoc };

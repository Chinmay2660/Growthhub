import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import {
  jsonOk,
  jsonError,
  currentStreak,
  startOfDay,
  addIstDays,
  splitQuestionFields,
} from "@/lib/utils";
import { getTodayQuestionsForUser } from "@/lib/services";
import { getInterviewCountdown } from "@/lib/readiness";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import MockInterviewRound from "@/models/MockInterviewRound";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import { NATIVE_PERSONAL_QUESTION_FILTER } from "@/lib/practice-question-filters";
import type { DashboardData } from "@/types";

/**
 * The dashboard covers every group the person belongs to at once (there is no single "current" group
 * to pick): today's and overdue questions, the group strips, the nearest interview date and the next mock.
 */
export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();

    const user = await User.findById(userId)
      .select("studyStreak lastStudyDate dailyQuestionGoal")
      .lean();
    if (!user) return jsonError("User not found", 404);

    const groups = await Group.find({ "members.userId": userId })
      .select("_id name members interviewDate createdAt")
      .sort({ createdAt: -1 })
      .lean();
    if (groups.length === 0) return jsonError("No active group", 400);

    const groupIds = groups.map((g) => String(g._id));
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addIstDays(now, 1);
    const dailyGoal = user.dailyQuestionGoal ?? 3;

    // ---- the interview that matters most: the nearest one still ahead, else the most recent that passed
    const dated = groups.filter((g) => g.interviewDate);
    const upcoming = dated
      .filter((g) => new Date(g.interviewDate as Date).getTime() > now.getTime())
      .sort((a, b) => new Date(a.interviewDate as Date).getTime() - new Date(b.interviewDate as Date).getTime())[0];
    const interviewGroup =
      upcoming ??
      [...dated].sort((a, b) => new Date(b.interviewDate as Date).getTime() - new Date(a.interviewDate as Date).getTime())[0];
    const countdown = getInterviewCountdown(interviewGroup?.interviewDate);

    const [todayQuestions, subjects, groupQuestions, personalQuestions] = await Promise.all([
      getTodayQuestionsForUser(userId, groupIds),
      Subject.find({
        $or: [
          { groupId: { $in: groupIds }, scope: "group", isActive: true },
          { userId, scope: "personal", isActive: true },
        ],
      })
        .select("_id name")
        .lean(),
      PracticeQuestion.find({ groupId: { $in: groupIds }, scope: "group" })
        .select("_id subjectId practiceDate")
        .lean(),
      PracticeQuestion.find({ userId, scope: "personal", ...NATIVE_PERSONAL_QUESTION_FILTER })
        .select("_id subjectId practiceDate status")
        .lean(),
    ]);

    const activeSubjectIds = new Set(subjects.map((s) => String(s._id)));
    const visibleGroupQuestions = groupQuestions.filter((q) => activeSubjectIds.has(String(q.subjectId)));
    const visiblePersonalQuestions = personalQuestions.filter((q) => activeSubjectIds.has(String(q.subjectId)));

    // ---- what is overdue: scheduled before today and not solved by me yet
    const mySolved = visibleGroupQuestions.length
      ? new Set(
          (
            await QuestionProgress.find({
              userId,
              questionId: { $in: visibleGroupQuestions.map((q) => q._id) },
              status: { $in: ["done", "revised"] },
            })
              .select("questionId")
              .lean()
          ).map((p) => String(p.questionId))
        )
      : new Set<string>();

    const overdueCandidates = [
      ...visibleGroupQuestions
        .filter((q) => q.practiceDate && q.practiceDate < todayStart && !mySolved.has(String(q._id)))
        .map((q) => ({ id: String(q._id), at: q.practiceDate as Date })),
      ...visiblePersonalQuestions
        .filter(
          (q) => q.practiceDate && q.practiceDate < todayStart && q.status !== "done" && q.status !== "revised"
        )
        .map((q) => ({ id: String(q._id), at: q.practiceDate as Date })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    // ---- what changed while away
    const lastActive = user.lastStudyDate ? new Date(user.lastStudyDate) : null;
    const daysAway = lastActive
      ? Math.round((todayStart.getTime() - startOfDay(lastActive).getTime()) / 86_400_000)
      : 0;
    const otherMemberIds = Array.from(
      new Set(groups.flatMap((g) => (g.members ?? []).map((m) => String(m.userId))))
    ).filter((id) => id !== userId);

    const [solvedToday, overdueRows, teamSolved, nextRound] = await Promise.all([
      QuestionProgress.countDocuments({
        userId,
        firstCompletedAt: { $gte: todayStart, $lt: tomorrowStart },
      }),
      overdueCandidates.length
        ? PracticeQuestion.find({ _id: { $in: overdueCandidates.slice(0, 5).map((c) => c.id) } })
            .select("_id content subjectId practiceDate scope")
            .lean()
        : Promise.resolve([]),
      daysAway >= 3 && lastActive && otherMemberIds.length && groupQuestions.length
        ? QuestionProgress.countDocuments({
            userId: { $in: otherMemberIds },
            questionId: { $in: groupQuestions.map((q) => q._id) },
            status: { $in: ["done", "revised"] },
            firstCompletedAt: { $gt: lastActive },
          })
        : Promise.resolve(0),
      MockInterviewRound.findOne({ groupId: { $in: groupIds }, interviewDate: { $gte: now } })
        .sort({ interviewDate: 1 })
        .select("groupId roundNumber interviewDate")
        .lean(),
    ]);

    const subjectNameById = new Map(subjects.map((s) => [String(s._id), s.name as string]));
    const overdueOrder = new Map(overdueCandidates.map((c, i) => [c.id, i]));
    const overdueItems = overdueRows
      .map((q) => ({
        _id: String(q._id),
        title: splitQuestionFields(q.content).title,
        subjectName: subjectNameById.get(String(q.subjectId)) ?? "",
        practiceDate: (q.practiceDate as Date).toISOString(),
        scope: q.scope as "group" | "personal",
      }))
      .sort((a, b) => (overdueOrder.get(a._id) ?? 0) - (overdueOrder.get(b._id) ?? 0));

    const nextMockGroup = nextRound ? groups.find((g) => String(g._id) === String(nextRound.groupId)) : undefined;

    const data: DashboardData = {
      countdown: {
        ...countdown,
        interviewDate: interviewGroup?.interviewDate?.toISOString() ?? null,
      },
      todayQuestions,
      studyStreak: currentStreak(user.studyStreak, user.lastStudyDate),
      daily: { goal: dailyGoal, solvedToday },
      away: daysAway >= 3 ? { days: daysAway, overdue: overdueCandidates.length, teamSolved } : null,
      overdue: { count: overdueCandidates.length, items: overdueItems },
      groups: groups.map((g) => ({ _id: String(g._id), name: g.name })),
      nextMock: nextRound?.interviewDate
        ? {
            roundNumber: nextRound.roundNumber,
            date: new Date(nextRound.interviewDate).toISOString(),
            groupId: String(nextRound.groupId),
            groupName: nextMockGroup?.name ?? "",
          }
        : null,
    };

    return jsonOk(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch dashboard", 500);
  }
}

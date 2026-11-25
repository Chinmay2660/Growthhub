import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonError } from "@/lib/utils";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import QuestionProgress from "@/models/QuestionProgress";
import PracticeQuestion from "@/models/PracticeQuestion";
import MockInterview from "@/models/MockInterview";
import GroupNote from "@/models/GroupNote";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUserId = requireAuthUserId(request);
    const { id } = await params;
    if (authUserId !== id) return jsonError("Unauthorized", 403);

    await connectToDatabase();
    // authCodeHash / recoveryKeyHash are select:false, so they never load here.
    const user = await User.findById(id).lean();
    if (!user) return jsonError("User not found", 404);
    if (user.isGuest) return jsonError("The shared demo account's data can't be exported", 403);

    const uid = new mongoose.Types.ObjectId(id);
    const [groups, subjects, questions, topicProgress, mocks, notes] = await Promise.all([
      Group.find({ "members.userId": uid }).select("name members").lean(),
      Subject.find({ userId: uid, scope: "personal" }).lean(),
      PracticeQuestion.find({ userId: uid, scope: "personal" }).lean(),
      TopicProgress.find({ userId: uid }).lean(),
      MockInterview.find({ $or: [{ userId: uid }, { interviewerId: uid }] }).lean(),
      GroupNote.find({ $or: [{ fromUserId: uid }, { toUserId: uid }] }).lean(),
    ]);
    const subjectIds = subjects.map((s) => s._id);
    const [topics, progress] = await Promise.all([
      subjectIds.length ? Topic.find({ subjectId: { $in: subjectIds } }).lean() : [],
      questions.length
        ? QuestionProgress.find({ userId: uid, questionId: { $in: questions.map((q) => q._id) } }).lean()
        : [],
    ]);
    const progressByQuestion = new Map(progress.map((p) => [String(p.questionId), p]));

    const data = {
      exportedAt: new Date().toISOString(),
      profile: {
        username: user.username,
        name: user.name,
        email: user.email,
        preparationLevel: user.preparationLevel,
        dailyStudyMinutes: user.dailyStudyMinutes,
        dailyQuestionGoal: user.dailyQuestionGoal,
        targetCompany: user.targetCompany,
        targetRole: user.targetRole,
        targetCtcLpa: user.targetCtcLpa,
        theme: user.theme,
        studyStreak: user.studyStreak,
        lastStudyDate: user.lastStudyDate,
        createdAt: user.createdAt,
      },
      groups: groups.map((g) => {
        const me = g.members.find((m) => String(m.userId) === id);
        return { name: g.name, role: me?.role, joinedAt: me?.joinedAt };
      }),
      personalTracks: subjects.map((s) => ({
        name: s.name,
        priority: s.priority,
        description: s.description,
        contentUnit: s.contentUnit,
        totalQuestions: s.totalQuestions,
        topics: topics
          .filter((t) => String(t.subjectId) === String(s._id))
          .map((t) => ({
            name: t.name,
            status: t.status,
            confidence: t.confidence,
            priority: t.priority,
            studyMinutes: t.studyMinutes,
            lastStudied: t.lastStudied,
            nextRevision: t.nextRevision,
          })),
      })),
      practiceQuestions: questions.map((q) => {
        const p = progressByQuestion.get(String(q._id));
        return {
          content: q.content,
          link: q.link,
          difficulty: q.difficulty,
          subject: subjects.find((s) => String(s._id) === String(q.subjectId))?.name,
          practiceDate: q.practiceDate,
          status: q.status,
          confidence: q.confidence,
          notes: q.notes,
          createdAt: q.createdAt,
          progress: p
            ? {
                status: p.status,
                confidence: p.confidence,
                lastPracticed: p.lastPracticed,
                firstCompletedAt: p.firstCompletedAt,
                pointsAwarded: p.pointsAwarded,
                notes: p.notes,
                lastReviewedAt: p.lastReviewedAt,
                lastTimeSpentSec: p.lastTimeSpentSec,
              }
            : null,
        };
      }),
      topicProgress: topicProgress.map((t) => ({
        topicId: String(t.topicId),
        status: t.status,
        confidence: t.confidence,
        studyMinutes: t.studyMinutes,
        lastStudied: t.lastStudied,
        nextRevision: t.nextRevision,
        notes: t.notes,
      })),
      mockInterviews: mocks.map((m) => ({
        role: String(m.userId) === id ? "interviewee" : "reviewer",
        date: m.date,
        interviewer: m.interviewer,
        score: m.score,
        rubric: m.rubric,
        questionsAsked: m.questionsAsked,
        strengths: m.strengths,
        weaknesses: m.weaknesses,
        feedback: m.feedback,
      })),
      groupNotes: notes.map((n) => ({
        direction: String(n.fromUserId) === id ? "sent" : "received",
        kind: n.kind,
        message: n.message,
        emoji: n.emoji,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    };

    const day = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="growthhub-export-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to export data", 500);
  }
}

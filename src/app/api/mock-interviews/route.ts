import { withAuth } from "@/lib/api-handler";
import { isDuplicateKeyError } from "@/lib/db-indexes";
import { jsonOk, jsonError } from "@/lib/utils";
import { serializeDoc, isGroupMember, invalidateGroupInsights } from "@/lib/services";
import { isObjectId } from "@/lib/access";
import MockInterview from "@/models/MockInterview";
import MockInterviewSession from "@/models/MockInterviewSession";
import Subject from "@/models/Subject";
import TopicProgress from "@/models/TopicProgress";
import Group from "@/models/Group";
import User from "@/models/User";

const RUBRIC_KEYS = ["communication", "correctness", "depth", "confidence"] as const;

function cleanRubric(input: unknown) {
  if (!input || typeof input !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const key of RUBRIC_KEYS) {
    const v = Number((input as Record<string, unknown>)[key]);
    if (!Number.isFinite(v)) return undefined;
    out[key] = Math.min(5, Math.max(1, Math.round(v)));
  }
  return out;
}

export const GET = withAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const filter: Record<string, unknown> = { userId };
  if (groupId) filter.groupId = groupId;

  const interviews = await MockInterview.find(filter).sort({ date: -1 }).lean();
  const subjects = await Subject.find({ _id: { $in: interviews.map((i) => i.subjectId).filter(Boolean) } })
    .select("_id name")
    .lean();
  const subjectMap = new Map(subjects.map((s) => [String(s._id), s.name]));

  return jsonOk(
    interviews.map((i) => ({
      ...serializeDoc(i),
      subjectName: i.subjectId ? subjectMap.get(String(i.subjectId)) : undefined,
    }))
  );
}, "Failed to fetch interviews");

/** Scores under this mark queue the session's topics for revision. */
const NEEDS_REVISION_BELOW = 70;
const MAX_LIST_ITEMS = 10;

function cleanList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

export const POST = withAuth(async (request, { userId: authUserId }) => {
  const body = await request.json().catch(() => ({}));
  const { sessionId, score, strengths, weaknesses, feedback, rubric } = body;

  if (!isObjectId(sessionId)) return jsonError("sessionId is required");
  if (score === undefined || score === null || (typeof score === "string" && !score.trim())) {
    return jsonError("score is required");
  }
  const scoreNum = Number(score);
  if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
    return jsonError("Score must be a number from 0 to 100");
  }
  if (feedback !== undefined && (typeof feedback !== "string" || feedback.length > 2000)) {
    return jsonError("Feedback must be text under 2000 characters");
  }

  const session = await MockInterviewSession.findById(sessionId).lean();
  if (!session) return jsonError("Mock session not found", 404);

  // Everything that identifies the mock comes from the stored session, never from the request body.
  const groupId = String(session.groupId);
  const intervieweeId = String(session.intervieweeId);

  const group = await Group.findById(groupId).lean();
  if (!group || !isGroupMember(group, authUserId)) {
    return jsonError("Not a member of this group", 403);
  }
  if (!group.members.some((m) => String(m.userId) === intervieweeId)) {
    return jsonError("Interviewee is no longer a group member", 400);
  }
  if (intervieweeId === authUserId) {
    return jsonError("Interviewee cannot score their own mock", 400);
  }

  const existingScore = await MockInterview.findOne({ sessionId, interviewerId: authUserId }).lean();
  if (existingScore) {
    return jsonError("You have already submitted a score for this mock", 409);
  }

  const interviewer = await User.findById(authUserId).lean();
  const sessionQuestions = session.questions.map((q) => `${q.subjectName}: ${q.question}`);
  const sessionTopicIds = session.questions.filter((q) => q.topicId).map((q) => String(q.topicId));
  const finalScore = Math.round(scoreNum);

  let interview;
  try {
    interview = await MockInterview.create({
      userId: intervieweeId,
      groupId,
      sessionId,
      interviewerId: authUserId,
      date: new Date(),
      interviewer: interviewer?.name,
      score: finalScore,
      questionsAsked: sessionQuestions,
      strengths: cleanList(strengths),
      weaknesses: cleanList(weaknesses),
      feedback: typeof feedback === "string" ? feedback.trim() : undefined,
      rubric: cleanRubric(rubric),
      followUpTopicIds: sessionTopicIds,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return jsonError("You have already submitted a score for this mock", 409);
    }
    throw err;
  }

  // A weak result queues the topics that were asked for the interviewee only (not the whole group),
  // and a strong one leaves their progress alone.
  if (finalScore < NEEDS_REVISION_BELOW && sessionTopicIds.length > 0) {
    const now = new Date();
    await TopicProgress.bulkWrite(
      sessionTopicIds.map((topicId) => ({
        updateOne: {
          filter: { userId: intervieweeId, topicId },
          update: { $set: { confidence: "weak", status: "learning", nextRevision: now } },
          upsert: true,
        },
      }))
    );
  }

  invalidateGroupInsights(groupId); // the interviewee's analytics include their mock scores

  return jsonOk(serializeDoc(interview), 201);
}, "Failed to create interview");

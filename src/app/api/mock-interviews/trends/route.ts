import { withAuth } from "@/lib/api-handler";
import { jsonOk, jsonError } from "@/lib/utils";
import { isGroupMember } from "@/lib/services";
import { isObjectId } from "@/lib/access";
import { listMockRounds } from "@/lib/mock-rounds";
import MockInterview from "@/models/MockInterview";
import MockInterviewSession from "@/models/MockInterviewSession";
import Group from "@/models/Group";

const KEYS = ["communication", "correctness", "depth", "confidence"] as const;

/**
 * A member's mock results averaged per round: overall score plus each rubric dimension. Defaults to the
 * caller; `userId` shows another member of the same group (the roster already shows their averages).
 */
export const GET = withAuth(async (request, { userId: viewerId }) => {
  const params = new URL(request.url).searchParams;
  const groupId = params.get("groupId");
  if (!isObjectId(groupId)) return jsonError("groupId is required");
  const requested = params.get("userId");
  if (requested && !isObjectId(requested)) return jsonError("Invalid user");

  const group = await Group.findById(groupId).select("members").lean();
  if (!group || !isGroupMember(group, viewerId)) return jsonError("Not a member of this group", 403);

  const userId = requested ?? viewerId;
  if (!isGroupMember(group, userId)) return jsonError("That person is not in this group", 404);

  const [rounds, sessions] = await Promise.all([
    listMockRounds(groupId),
    MockInterviewSession.find({ groupId, intervieweeId: userId }).select("_id roundId").lean(),
  ]);
  const roundBySession = new Map(sessions.map((s) => [String(s._id), String(s.roundId)]));
  const results = await MockInterview.find({
    userId,
    groupId,
    sessionId: { $in: sessions.map((s) => s._id) },
  }).lean();

  const points = rounds
    .map((round) => {
      const mine = results.filter((r) => roundBySession.get(String(r.sessionId)) === String(round._id));
      if (mine.length === 0) return null;
      const avg = (vals: number[]) =>
        vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      const rubric = Object.fromEntries(
        KEYS.map((k) => [k, avg(mine.map((m) => m.rubric?.[k]).filter((v): v is number => typeof v === "number"))])
      );
      return {
        roundNumber: round.roundNumber,
        score: avg(mine.map((m) => m.score)),
        reviewers: mine.length,
        rubric,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return jsonOk({ points });
}, "Failed to load mock trends");

import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { normalizeUser } from "@/lib/user";
import { isDuplicateKeyError } from "@/lib/db-indexes";
import { getGroupRole, isObjectId } from "@/lib/access";
import mongoose from "mongoose";
import { clearSessionCookie } from "@/lib/session";
import { deleteGroupData, invalidateGroupInsights } from "@/lib/services";
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
import GroupNote from "@/models/GroupNote";
import PreparationPlan from "@/models/PreparationPlan";
import StudySession from "@/models/StudySession";

const THEMES = ["light", "dark", "system"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// The demo account is shared by every visitor, so visitors may only change view preferences on it.
const GUEST_ALLOWED = new Set(["theme", "activeGroupId"]);

function intInRange(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUserId = requireAuthUserId(request);
    const { id } = await params;
    if (authUserId !== id) return jsonError("Unauthorized", 403);

    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("Invalid request");

    const current = await User.findById(id).select("isGuest").lean();
    if (!current) return jsonError("User not found", 404);
    if (current.isGuest) {
      const blocked = Object.keys(body).find((k) => !GUEST_ALLOWED.has(k));
      if (blocked) return jsonError("The shared demo account can't be edited", 403);
    }

    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 60) {
        return jsonError("Name must be 1-60 characters");
      }
      set.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (body.email === null || body.email === "") unset.email = 1;
      else if (typeof body.email !== "string" || body.email.length > 120 || !EMAIL_RE.test(body.email.trim())) {
        return jsonError("Enter a valid email address");
      } else set.email = body.email.trim().toLowerCase();
    }
    if (body.preparationLevel !== undefined) {
      if (!LEVELS.includes(body.preparationLevel)) return jsonError("Invalid preparation level");
      set.preparationLevel = body.preparationLevel;
    }
    if (body.theme !== undefined) {
      if (!THEMES.includes(body.theme)) return jsonError("Invalid theme");
      set.theme = body.theme;
    }
    if (body.dailyStudyMinutes !== undefined) {
      const v = intInRange(body.dailyStudyMinutes, 15, 720);
      if (v === null) return jsonError("Daily study time must be between 15 and 720 minutes");
      set.dailyStudyMinutes = v;
    }
    if (body.dailyQuestionGoal !== undefined) {
      const v = intInRange(body.dailyQuestionGoal, 1, 50);
      if (v === null) return jsonError("Daily question goal must be between 1 and 50");
      set.dailyQuestionGoal = v;
    }
    for (const key of ["targetCompany", "targetRole"] as const) {
      if (body[key] === undefined) continue;
      if (body[key] === null || body[key] === "") unset[key] = 1;
      else if (typeof body[key] !== "string" || body[key].trim().length > 120) {
        return jsonError(`${key === "targetCompany" ? "Company" : "Role"} must be under 120 characters`);
      } else set[key] = body[key].trim();
    }
    if (body.targetCtcLpa !== undefined) {
      const ctc = Number(body.targetCtcLpa);
      if (!Number.isFinite(ctc) || ctc < 0 || ctc > 200) {
        return jsonError("targetCtcLpa must be between 0 and 200", 400);
      }
      if (ctc > 0) set.targetCtcLpa = ctc;
      else unset.targetCtcLpa = 1;
    }

    // Switching groups: only to a group the user actually belongs to (empty value clears it).
    if (body.activeGroupId !== undefined) {
      const target = body.activeGroupId;
      if (target === null || target === "") unset.activeGroupId = 1;
      else {
        if (!isObjectId(target)) return jsonError("Invalid group", 400);
        if ((await getGroupRole(target, id)) === null) return jsonError("You are not a member of that group", 403);
        set.activeGroupId = target;
      }
    }

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      return jsonError("Nothing to update");
    }

    let user;
    try {
      user = await User.findByIdAndUpdate(
        id,
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { new: true, runValidators: true }
      ).lean();
    } catch (err) {
      if (isDuplicateKeyError(err)) return jsonError("That email is already used by another account", 409);
      throw err;
    }
    if (!user) return jsonError("User not found", 404);
    return jsonOk(normalizeUser(user));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to update user", 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUserId = requireAuthUserId(request);
    const { id } = await params;
    if (authUserId !== id) return jsonError("Unauthorized", 403);

    await connectToDatabase();
    const user = await User.findById(id).select("username isGuest").lean();
    if (!user) return jsonError("User not found", 404);
    if (user.isGuest) return jsonError("The shared demo account can't be deleted", 403);

    const body = await request.json().catch(() => null);
    if (user.username) {
      if (!body || typeof body.username !== "string" || body.username.trim().toLowerCase() !== user.username) {
        return jsonError("Type your username to confirm account deletion");
      }
    } else if (!body || body.confirm !== "DELETE") {
      return jsonError("Type DELETE to confirm account deletion");
    }

    const uid = new mongoose.Types.ObjectId(id);
    const groups = await Group.find({ "members.userId": uid }).select("name ownerId members").lean();

    // Owners of groups that still have other members must hand over first (nothing is deleted yet).
    const blocking = groups.find(
      (g) => String(g.ownerId) === id && g.members.some((m) => String(m.userId) !== id)
    );
    if (blocking) {
      return jsonError(
        `You own the group "${blocking.name}" and it still has other members. Transfer ownership to another member before deleting your account.`,
        409
      );
    }

    for (const g of groups) {
      const others = g.members.filter((m) => String(m.userId) !== id);
      if (others.length === 0) {
        await deleteGroupData(String(g._id));
        await Group.deleteOne({ _id: g._id });
      } else {
        await Group.updateOne({ _id: g._id }, { $pull: { members: { userId: uid } } });
      }
      invalidateGroupInsights(String(g._id));
    }

    const [personalSubjectIds, personalQuestionIds] = await Promise.all([
      Subject.find({ userId: uid, scope: "personal" }).distinct("_id"),
      PracticeQuestion.find({ userId: uid, scope: "personal" }).distinct("_id"),
    ]);
    const personalTopicIds = personalSubjectIds.length
      ? await Topic.find({ subjectId: { $in: personalSubjectIds } }).distinct("_id")
      : [];

    await Promise.all([
      QuestionProgress.deleteMany({ $or: [{ userId: uid }, { questionId: { $in: personalQuestionIds } }] }),
      TopicProgress.deleteMany({ $or: [{ userId: uid }, { topicId: { $in: personalTopicIds } }] }),
      PracticeQuestion.deleteMany({ userId: uid, scope: "personal" }),
      Topic.deleteMany({ _id: { $in: personalTopicIds } }),
      Subject.deleteMany({ userId: uid, scope: "personal" }),
      MockInterview.deleteMany({ $or: [{ userId: uid }, { interviewerId: uid }] }),
      MockInterviewSession.deleteMany({ intervieweeId: uid }),
      MockInterviewSlot.deleteMany({ intervieweeId: uid }),
      GroupNote.deleteMany({ $or: [{ fromUserId: uid }, { toUserId: uid }] }),
      PreparationPlan.deleteMany({ userId: uid }),
      StudySession.deleteMany({ userId: uid }),
    ]);
    await User.deleteOne({ _id: uid });

    const response = jsonOk({ deleted: true });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to delete account", 500);
  }
}

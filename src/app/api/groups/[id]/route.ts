import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import {
  serializeDoc,
  isGroupMember,
  canManageGroup,
  getGroupInsights,
  listGroupPracticeQuestionsForUser,
  deleteGroupData,
  clearActiveGroupForMembers,
  invalidateGroupInsights,
} from "@/lib/services";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import type { GroupRole } from "@/types";
import { getInterviewCountdown } from "@/lib/readiness";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    const groupDoc = await Group.findById(id).lean();
    if (!groupDoc) return jsonError("Group not found", 404);
    if (!isGroupMember(groupDoc, userId)) return jsonError("Unauthorized", 403);

    if (view === "header") {
      const me = groupDoc.members.find((m) => String(m.userId) === userId);
      return jsonOk({
        _id: String(groupDoc._id),
        name: groupDoc.name,
        description: groupDoc.description ?? "",
        myRole: (me?.role as GroupRole | undefined) ?? null,
      });
    }

    const roleMap = new Map(
      groupDoc.members.map((m) => [String(m.userId), m.role as GroupRole])
    );
    const memberIds = groupDoc.members.map((m) => String(m.userId));
    const include = new Set(
      (searchParams.get("include") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const [topicCount, { memberStats, gamification }, subjects, groupQuestions] =
      await Promise.all([
        Topic.countDocuments({ groupId: id }),
        getGroupInsights(id, memberIds, roleMap),
        include.has("subjects")
          ? Subject.find({ groupId: id, scope: "group", isActive: true })
              .sort({ order: 1 })
              .lean()
              .then((rows) => rows.map(serializeDoc))
          : Promise.resolve(undefined),
        include.has("questions")
          ? listGroupPracticeQuestionsForUser(id, userId)
          : Promise.resolve(undefined),
      ]);

    const countdown = getInterviewCountdown(groupDoc.interviewDate);

    const serialized: Record<string, unknown> = { ...serializeDoc(groupDoc) };
    if (!canManageGroup(isGroupMember(groupDoc, userId))) {
      delete serialized.joinCode;
      delete serialized.joinCodeExpiresAt;
    }

    return jsonOk({
      ...serialized,
      topicCount,
      memberStats,
      gamification,
      countdown: {
        ...countdown,
        interviewDate: groupDoc.interviewDate?.toISOString() ?? null,
      },
      ...(subjects ? { subjects } : {}),
      ...(groupQuestions ? { groupQuestions } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch group", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();
    const { name, description, interviewDate, weeklyGoalPerMember } = body;

    const group = await Group.findById(id);
    if (!group) return jsonError("Group not found", 404);

    const role = isGroupMember(group, userId);
    if (!canManageGroup(role)) return jsonError("Unauthorized", 403);

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
        return jsonError("Group name must be 1-80 characters");
      }
      group.name = name.trim();
    }
    if (description !== undefined) {
      if (description !== null && (typeof description !== "string" || description.length > 300)) {
        return jsonError("Description must be under 300 characters");
      }
      group.description = description?.trim() || undefined;
    }
    if (interviewDate !== undefined) {
      if (interviewDate === null || interviewDate === "") {
        group.interviewDate = undefined; // clearing the date is allowed
      } else {
        const parsed = new Date(interviewDate);
        if (Number.isNaN(parsed.getTime())) return jsonError("Invalid interview date");
        group.interviewDate = parsed;
      }
    }
    if (weeklyGoalPerMember !== undefined) {
      const goal = Number(weeklyGoalPerMember);
      if (!Number.isInteger(goal) || goal < 1 || goal > 100) {
        return jsonError("Weekly goal must be a whole number from 1 to 100");
      }
      group.weeklyGoalPerMember = goal;
    }
    await group.save();
    invalidateGroupInsights(id);

    return jsonOk(serializeDoc(group));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to update group", 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;

    const group = await Group.findById(id);
    if (!group) return jsonError("Group not found", 404);
    if (String(group.ownerId) !== userId) return jsonError("Only the group admin can delete the group", 403);

    await deleteGroupData(id);
    await clearActiveGroupForMembers(id);
    await group.deleteOne();
    return jsonOk({ deleted: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to delete group", 500);
  }
}

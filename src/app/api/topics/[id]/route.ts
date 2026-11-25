import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { serializeDoc, invalidateGroupInsights } from "@/lib/services";
import { canManageGroup } from "@/lib/group-roles";
import { getGroupRole, isObjectId } from "@/lib/access";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import Subject from "@/models/Subject";

const STATUSES = ["not_started", "learning", "practiced", "revised"];
const CONFIDENCES = ["weak", "okay", "strong"];
const PRIORITIES = ["critical", "high", "medium", "low"];

/** Who may touch a topic: the owner of a personal track, or a member of the topic's group. */
async function topicAccess(topicId: string, userId: string) {
  const topic = await Topic.findById(topicId).lean();
  if (!topic) return null;
  const subject = await Subject.findById(topic.subjectId).select("scope userId").lean();
  if (!subject) return null;
  if (subject.scope === "personal") {
    const own = String(subject.userId) === userId;
    return own ? { topic, canEditShared: true } : null;
  }
  const role = await getGroupRole(String(topic.groupId), userId);
  return role ? { topic, canEditShared: canManageGroup(role) } : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    const { id } = await params;
    if (!isObjectId(id)) return jsonError("Topic not found", 404);
    await connectToDatabase();

    const access = await topicAccess(id, userId);
    // Same answer for "missing" and "not yours" so ids can't be probed.
    if (!access) return jsonError("Topic not found", 404);

    const body = await request.json().catch(() => ({}));

    // ---- validate everything up front
    const progressSet: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return jsonError("Invalid status");
      progressSet.status = body.status;
    }
    if (body.confidence !== undefined) {
      if (!CONFIDENCES.includes(body.confidence)) return jsonError("Invalid confidence");
      progressSet.confidence = body.confidence;
    }
    if (body.studyMinutes !== undefined) {
      const minutes = Number(body.studyMinutes);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 100000) return jsonError("Invalid study minutes");
      progressSet.studyMinutes = Math.round(minutes);
    }
    if (body.notes !== undefined) {
      if (typeof body.notes !== "string" || body.notes.length > 2000) return jsonError("Notes must be under 2000 characters");
      progressSet.notes = body.notes.trim();
    }

    const sharedSet: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120) return jsonError("Invalid name");
      sharedSet.name = body.name.trim();
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority)) return jsonError("Invalid priority");
      sharedSet.priority = body.priority;
    }
    if (Object.keys(sharedSet).length > 0 && !access.canEditShared) {
      return jsonError("Only a group admin can rename or re-prioritise a shared topic", 403);
    }

    // ---- apply
    let result: unknown = serializeDoc(access.topic);
    if (Object.keys(sharedSet).length > 0) {
      const updated = await Topic.findByIdAndUpdate(id, sharedSet, { new: true, runValidators: true }).lean();
      if (updated) result = serializeDoc(updated);
    }
    if (Object.keys(progressSet).length > 0) {
      const update: Record<string, unknown> = { ...progressSet };
      // "Last studied" moves only when the user actually studied or changed status, not on a notes edit.
      if (progressSet.status !== undefined || progressSet.studyMinutes !== undefined) update.lastStudied = new Date();
      if (progressSet.status === "practiced" || progressSet.status === "revised") {
        // Per person: one member revising a topic must not move everyone else's revision date.
        const next = new Date();
        next.setDate(next.getDate() + (progressSet.status === "practiced" ? 3 : 7));
        update.nextRevision = next;
      }
      const progress = await TopicProgress.findOneAndUpdate({ userId, topicId: id }, update, {
        new: true,
        upsert: true,
        runValidators: true,
      }).lean();
      result = serializeDoc(progress!);
    }
    invalidateGroupInsights(String(access.topic.groupId));
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to update topic", 500);
  }
}

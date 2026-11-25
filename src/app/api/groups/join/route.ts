import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import {
  jsonOk,
  jsonError,
  isGroupFull,
  isJoinCodeActive,
  isValidJoinCode,
  MAX_GROUP_MEMBERS,
  normalizeJoinCode,
} from "@/lib/utils";
import { serializeDoc } from "@/lib/services";
import { checkKeyedRateLimit } from "@/lib/auth-rate-limit";
import Group from "@/models/Group";
import User from "@/models/User";

export async function PUT(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    // 6-digit codes are guessable by brute force, so cap attempts per person.
    if (!checkKeyedRateLimit(`join:${userId}`, 10)) {
      return jsonError("Too many join attempts. Try again in a few minutes.", 429);
    }
    await connectToDatabase();
    const body = await request.json();
    const { code } = body;
    if (!code?.trim()) return jsonError("Join code is required");
    const normalized = normalizeJoinCode(code);
    if (!isValidJoinCode(normalized)) return jsonError("Join code must be 6 digits");

    const group = await Group.findOne({ joinCode: normalized });
    if (!group) return jsonError("Invalid join code", 404);
    if (!isJoinCodeActive(group.joinCode, group.joinCodeExpiresAt)) {
      return jsonError("Join code has expired. Ask the group owner for a new code.", 400);
    }

    const alreadyMember = group.members.some((m) => String(m.userId) === userId);
    if (alreadyMember) return jsonError("Already a member of this group", 400);
    if (isGroupFull(group.members.length)) {
      return jsonError(`This group is full (max ${MAX_GROUP_MEMBERS} members)`, 400);
    }

    const memberId = new mongoose.Types.ObjectId(userId);
    const joined = await Group.findOneAndUpdate(
      {
        _id: group._id,
        "members.userId": { $ne: memberId },
        $expr: { $lt: [{ $size: "$members" }, MAX_GROUP_MEMBERS] },
      },
      { $push: { members: { userId: memberId, role: "member", joinedAt: new Date() } } },
      { new: true }
    );
    if (!joined) {
      // Someone else got there first: say why.
      const fresh = await Group.findById(group._id).select("members").lean();
      if (fresh?.members.some((m) => String(m.userId) === userId)) return jsonError("Already a member of this group", 400);
      return jsonError(`This group is full (max ${MAX_GROUP_MEMBERS} members)`, 400);
    }

    await User.findByIdAndUpdate(userId, { activeGroupId: joined._id });

    return jsonOk(serializeDoc(joined));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to join group", 500);
  }
}

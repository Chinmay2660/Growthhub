import mongoose from "mongoose";
import Group from "@/models/Group";
import { isGroupMember } from "@/lib/services";
import type { GroupRole } from "@/types";

/** The caller's role in a group, or null when the id is malformed, the group is gone, or they are not a member. */
export async function getGroupRole(groupId: string | null | undefined, userId: string): Promise<GroupRole | null> {
  if (!groupId || !mongoose.isValidObjectId(groupId)) return null;
  const group = await Group.findById(groupId).select("members").lean();
  if (!group) return null;
  return isGroupMember(group as Parameters<typeof isGroupMember>[0], userId);
}

export const isObjectId = (v: unknown): v is string => typeof v === "string" && mongoose.isValidObjectId(v);

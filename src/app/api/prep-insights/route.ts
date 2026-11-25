import { withAuth } from "@/lib/api-handler";
import { jsonOk, jsonError } from "@/lib/utils";
import { getPrepInsights } from "@/lib/prep-insights";
import { resolveActiveGroupId } from "@/lib/services";
import User from "@/models/User";

export const GET = withAuth(async (_request, { userId }) => {
  const user = await User.findById(userId).select("activeGroupId").lean();
  const groupId = await resolveActiveGroupId(userId, user?.activeGroupId);
  if (!groupId) return jsonError("No active group", 400);
  return jsonOk(await getPrepInsights(userId, groupId));
}, "Failed to load prep insights");

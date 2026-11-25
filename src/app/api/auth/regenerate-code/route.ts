import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { generateAuthCode, hashAuthCode } from "@/lib/auth";
import { checkAuthRateLimit, checkKeyedRateLimit } from "@/lib/auth-rate-limit";
import { jsonOk, jsonError } from "@/lib/utils";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    if (!checkAuthRateLimit(request, "regenerate", 20, 60 * 60 * 1000)) {
      return jsonError("Too many code regeneration attempts. Try again later.", 429);
    }

    const userId = requireAuthUserId(request);
    if (!checkKeyedRateLimit(`regenerate:${userId}`, 5, 60 * 60 * 1000)) {
      return jsonError("Too many code regeneration attempts. Try again later.", 429);
    }
    await connectToDatabase();

    const authCode = generateAuthCode();
    // The shared demo account is used by everyone, so its code can't be changed by one visitor.
    const user = await User.findOneAndUpdate(
      { _id: userId, isGuest: { $ne: true } },
      { authCodeHash: hashAuthCode(authCode) },
      { new: true }
    ).lean();
    if (!user) return jsonError("The demo account's code can't be changed", 403);

    return jsonOk({ authCode });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to regenerate code", 500);
  }
}

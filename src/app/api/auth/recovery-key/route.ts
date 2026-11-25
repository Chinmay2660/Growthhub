import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { checkKeyedRateLimit } from "@/lib/auth-rate-limit";
import { generateRecoveryKey, hashRecoveryKey } from "@/lib/recovery-key";
import { jsonOk, jsonError } from "@/lib/utils";
import User from "@/models/User";

const HOUR = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const user = await User.findById(userId).select("isGuest").lean();
    if (!user) return jsonError("User not found", 404);
    if (user.isGuest) return jsonError("The shared demo account can't have a recovery key", 403);

    if (!checkKeyedRateLimit(`recovery-key:${userId}`, 5, HOUR)) {
      return jsonError("Too many recovery key requests. Try again in an hour.", 429);
    }

    const recoveryKey = generateRecoveryKey();
    await User.updateOne({ _id: userId }, { $set: { recoveryKeyHash: hashRecoveryKey(recoveryKey) } });
    return jsonOk({ recoveryKey });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to create recovery key", 500);
  }
}

import { connectToDatabase } from "@/lib/mongodb";
import {
  hashAuthCode,
  isReservedDemoUsername,
  isValidAuthCode,
  normalizeUsername,
  UNUSABLE_AUTH_HASH,
} from "@/lib/auth";
import { generateRecoveryKey, hashRecoveryKey, isValidRecoveryKeyShape, verifyRecoveryKey } from "@/lib/recovery-key";
import { buildSessionCookie } from "@/lib/session";
import { jsonOk, jsonError } from "@/lib/utils";
import { normalizeUser } from "@/lib/user";
import { clearLoginFailures, loginBlockedSeconds, recordLoginFailure } from "@/lib/auth-rate-limit";
import User from "@/models/User";

const GENERIC = "Invalid username or recovery key";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
    const recoveryKey = typeof body.recoveryKey === "string" ? body.recoveryKey : "";
    const newCode = typeof body.newCode === "string" ? body.newCode.trim() : "";

    if (!username || !recoveryKey.trim()) return jsonError("Username and recovery key are required");
    if (!isValidAuthCode(newCode)) return jsonError("New code must be exactly 6 digits");

    const wait = loginBlockedSeconds(request, username);
    if (wait > 0) {
      const res = jsonError("Too many failed attempts. Try again later.", 429);
      res.headers.set("Retry-After", String(wait));
      return res;
    }

    const fail = () => {
      recordLoginFailure(request, username);
      return jsonError(GENERIC, 401);
    };

    // Wrong-shaped keys and demo/reserved names get the same generic answer as an unknown account.
    if (!isValidRecoveryKeyShape(recoveryKey) || isReservedDemoUsername(username)) return fail();

    await connectToDatabase();
    const user = await User.findOne({ username }).select("+recoveryKeyHash");
    // Always run one scrypt, even for unknown users, so timing doesn't reveal which usernames exist.
    const ok = verifyRecoveryKey(recoveryKey, user?.recoveryKeyHash || UNUSABLE_AUTH_HASH);
    if (!user || user.isGuest || !user.recoveryKeyHash || !ok) return fail();

    const nextKey = generateRecoveryKey();
    await User.updateOne(
      { _id: user._id },
      { $set: { authCodeHash: hashAuthCode(newCode), recoveryKeyHash: hashRecoveryKey(nextKey) } }
    );

    clearLoginFailures(username);
    const response = jsonOk({ user: normalizeUser(user), recoveryKey: nextKey });
    response.headers.set("Set-Cookie", await buildSessionCookie(String(user._id)));
    return response;
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Recovery failed", 500);
  }
}

import { connectToDatabase } from "@/lib/mongodb";
import {
  hashAuthCode,
  isReservedDemoUsername,
  isValidAuthCode,
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth";
import { buildSessionCookie } from "@/lib/session";
import { jsonOk, jsonError } from "@/lib/utils";
import { normalizeUser } from "@/lib/user";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { generateRecoveryKey, hashRecoveryKey } from "@/lib/recovery-key";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    if (!checkAuthRateLimit(request, "register")) {
      return jsonError("Too many registration attempts. Try again later.", 429);
    }

    await connectToDatabase();
    const body = await request.json();
    const { name, code } = body;
    const username = normalizeUsername(body.username ?? "");

    if (!isValidUsername(username)) {
      return jsonError("Username must be 3-20 chars (letters, numbers, underscore)");
    }
    if (!name?.trim()) return jsonError("Name is required");

    const authCode = code?.trim();
    if (!authCode) return jsonError("Login code is required");
    if (!isValidAuthCode(authCode)) {
      return jsonError("Code must be exactly 6 digits");
    }

    const existing = isReservedDemoUsername(username) ? true : await User.findOne({ username });
    if (existing) {
      return jsonError("Username already taken", 409);
    }

    const recoveryKey = generateRecoveryKey();
    const user = await User.create({
      username,
      authCodeHash: hashAuthCode(authCode),
      recoveryKeyHash: hashRecoveryKey(recoveryKey),
      name: name.trim(),
      onboardingComplete: false,
    });

    const response = jsonOk(
      { user: normalizeUser(user), authCode, recoveryKey },
      201
    );
    response.headers.set("Set-Cookie", await buildSessionCookie(String(user._id)));
    return response;
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Registration failed", 500);
  }
}

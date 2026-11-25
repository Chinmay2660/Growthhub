import { connectToDatabase } from "@/lib/mongodb";
import { isReservedDemoUsername, normalizeUsername, verifyAuthCode, UNUSABLE_AUTH_HASH } from "@/lib/auth";
import { buildSessionCookie } from "@/lib/session";
import { jsonOk, jsonError } from "@/lib/utils";
import { normalizeUser } from "@/lib/user";
import { clearLoginFailures, loginBlockedSeconds, recordLoginFailure } from "@/lib/auth-rate-limit";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!username || !code) return jsonError("Username and code are required");

    const wait = loginBlockedSeconds(request, username);
    if (wait > 0) {
      const res = jsonError("Too many failed attempts. Try again later.", 429);
      res.headers.set("Retry-After", String(wait));
      return res;
    }

    await connectToDatabase();
    const user = await User.findOne({ username }).select("+authCodeHash");

    // Always run one scrypt, even for unknown users, so response time doesn't reveal which usernames exist.
    const ok = verifyAuthCode(code, user?.authCodeHash || UNUSABLE_AUTH_HASH);

    // The shared demo accounts are entered only through "Try demo" (which honours the production guest
    // switch), never through the code form.
    if (user && (user.isGuest || isReservedDemoUsername(username))) {
      return jsonError('This is the shared demo account. Use "Try demo" on the login page.', 403);
    }

    if (!user?.authCodeHash || !ok) {
      recordLoginFailure(request, username);
      return jsonError("Invalid username or code", 401);
    }

    clearLoginFailures(username);
    const response = jsonOk({ user: normalizeUser(user) });
    response.headers.set("Set-Cookie", await buildSessionCookie(String(user._id)));
    return response;
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Login failed", 500);
  }
}

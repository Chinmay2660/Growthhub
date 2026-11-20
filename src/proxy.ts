import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PAGES = ["/login", "/register"];
const PUBLIC_API = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/guest",
  "/api/auth/google",
  "/api/auth/sso-callback",
];

async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// Runaway-client guard: a fixed window per user, in process memory (use a shared store if you run
// several instances). Generous enough that normal navigation never hits it.
const API_LIMIT = 300;
const API_WINDOW_MS = 60_000;
const apiBuckets = new Map<string, { count: number; resetAt: number }>();

function apiRateLimited(userId: string): number {
  const now = Date.now();
  if (apiBuckets.size > 5000) {
    apiBuckets.forEach((b, k) => {
      if (b.resetAt <= now) apiBuckets.delete(k);
    });
  }
  const bucket = apiBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    apiBuckets.set(userId, { count: 1, resetAt: now + API_WINDOW_MS });
    return 0;
  }
  bucket.count += 1;
  return bucket.count > API_LIMIT ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = await getSessionUserId(request);

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some((p) => pathname === p)) {
      return NextResponse.next();
    }
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const retryAfter = apiRateLimited(userId);
    if (retryAfter > 0) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
    const headers = new Headers(request.headers);
    headers.delete("x-user-id");
    headers.set("x-user-id", userId);
    return NextResponse.next({ request: { headers } });
  }

  // ponytail: don't redirect /login from cookie alone — stale sessions loop with AppShell
  if (PUBLIC_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js).*)"],
};

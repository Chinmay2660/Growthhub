type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED = 5000;

const FIFTEEN_MIN = 15 * 60 * 1000;
/** Failed sign-ins allowed per username, and per client address, in a 15-minute window. */
const LOGIN_FAILS_PER_USER = 8;
const LOGIN_FAILS_PER_IP = 25;

function isAuthRateLimitEnabled(): boolean {
  if (process.env.AUTH_RATE_LIMIT_ENABLED !== undefined) {
    return process.env.AUTH_RATE_LIMIT_ENABLED === "true";
  }
  if (process.env.RATE_LIMIT_ENABLED !== undefined) {
    return process.env.RATE_LIMIT_ENABLED === "true";
  }
  return process.env.NODE_ENV === "production";
}

/**
 * The client address. The platform headers are set by the hosting proxy and cannot be forged by the
 * caller; a generic X-Forwarded-For list is client-writable on its left, so only its LAST entry
 * (appended by our own proxy) is trusted. Without any of these, everyone shares one "local" bucket.
 */
export function clientIp(request: Request): string {
  const h = request.headers;
  const platform = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip");
  if (platform) return platform.split(",")[0].trim();
  const chain = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return chain?.length ? chain[chain.length - 1] : "local";
}

function sweep(now: number) {
  if (buckets.size < MAX_TRACKED) return;
  buckets.forEach((b, k) => {
    if (b.resetAt <= now) buckets.delete(k);
  });
}

/** Counts one hit; returns false once `max` hits were made inside the window. */
function hit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

function secondsLeft(key: string, max: number): number {
  const b = buckets.get(key);
  if (!b || Date.now() > b.resetAt || b.count < max) return 0;
  return Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000));
}

// ponytail: in-memory per-process limiter; upgrade to Redis if you scale horizontally
/** Per-address limiter for actions where every attempt counts (registration, code regeneration). */
export function checkAuthRateLimit(
  request: Request,
  action: "register" | "regenerate" | "join",
  max = 30,
  windowMs = FIFTEEN_MIN
): boolean {
  if (!isAuthRateLimitEnabled()) return true;
  return hit(`${clientIp(request)}:auth:${action}`, max, windowMs);
}

/** Limiter keyed by an arbitrary identity (for example a signed-in user id). */
export function checkKeyedRateLimit(key: string, max: number, windowMs = FIFTEEN_MIN): boolean {
  if (!isAuthRateLimitEnabled()) return true;
  return hit(`key:${key}`, max, windowMs);
}

const userKey = (username: string) => `login-fail:user:${username}`;
const ipKey = (request: Request) => `login-fail:ip:${clientIp(request)}`;

/**
 * Seconds to wait before another sign-in attempt is allowed (0 = allowed). Only FAILED attempts
 * count, per username (so one account cannot be ground through its 1,000,000 codes from many
 * addresses) and per address (so one address cannot spray many usernames).
 */
export function loginBlockedSeconds(request: Request, username: string): number {
  if (!isAuthRateLimitEnabled()) return 0;
  return Math.max(secondsLeft(userKey(username), LOGIN_FAILS_PER_USER), secondsLeft(ipKey(request), LOGIN_FAILS_PER_IP));
}

export function recordLoginFailure(request: Request, username: string) {
  if (!isAuthRateLimitEnabled()) return;
  hit(userKey(username), LOGIN_FAILS_PER_USER, FIFTEEN_MIN);
  hit(ipKey(request), LOGIN_FAILS_PER_IP, FIFTEEN_MIN);
}

export function clearLoginFailures(username: string) {
  buckets.delete(userKey(username));
}

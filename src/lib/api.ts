import { getLocalDb, type OutboxItem } from "@/lib/local-db";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

/** Fired when the server says the session is gone, so the app can sign the person out instead of showing "Unauthorized". */
/** Fired after any write succeeds (or queued writes are replayed) so open screens can refresh quietly. */
export const DATA_CHANGED_EVENT = "growthhub:data-changed";
const announceChange = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
};

export const UNAUTHORIZED_EVENT = "growthhub:unauthorized";

/** A request that hasn't answered in this long is given up on (the offline cache or queue takes over where it can). */
const REQUEST_TIMEOUT_MS = 20_000;

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    // The sign-in screens themselves answer 401 for a wrong code; only react to a lost session elsewhere.
    let path = "";
    try {
      path = new URL(res.url).pathname;
    } catch {
      /* relative or opaque URL: treat as an ordinary 401 */
    }
    if (!path.startsWith("/api/auth/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After"));
    throw new ApiError(
      wait > 0 ? `Too many requests. Try again in ${wait} second${wait === 1 ? "" : "s"}.` : "Too many requests. Try again shortly.",
      429
    );
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(body.error || `Request failed with status ${res.status}`, res.status);
  }
  return body.data as T;
}

/** fetch with a timeout, so a stalled connection ends in an error instead of a spinner that never stops. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const fetchOpts = { credentials: "include" as RequestCredentials };

/* ------------------------------------------------------------------ */
/* Local-first layer: Dexie read cache + offline write outbox.         */
/* MongoDB stays the source of truth; this only mirrors and queues.    */
/* ------------------------------------------------------------------ */

/** Read responses mirrored for offline viewing. Every online read still revalidates against the
 *  server, so shared group data is only ever stale while offline or for the instant before the
 *  fresh response lands. Group writes are NOT queued offline (see QUEUEABLE). */
const CACHEABLE = [
  "/api/dashboard",
  "/api/analytics",
  "/api/subjects",
  "/api/topics",
  "/api/practice-questions",
  "/api/prep-insights",
  "/api/groups",
  "/api/group-notes",
  "/api/group-dynamics",
  "/api/mock-interviews",
  "/api/users",
];
/** Writes to these may be queued while offline. */
/** Group notes (nudges, mark-as-read) are append-only and idempotent, so they queue safely too.
 *  Admin actions (edit group, members, roles, codes, scheduling) deliberately do not. */
const QUEUEABLE = [
  "/api/subjects",
  "/api/topics",
  "/api/practice-questions",
  "/api/group-notes",
];

const isCacheable = (url: string) => matches(CACHEABLE, url) || /^\/api\/groups\/[^/?]+\?view=header$/.test(url);

function matches(list: string[], url: string) {
  const path = url.split("?")[0];
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

let localUserId: string | null = null;
const OUTBOX_EVENT = "growthhub:outbox-changed";

/** Called by UserProvider. Cache and outbox stay off until a user is known. */
export function setLocalUser(userId: string | null) {
  localUserId = userId;
}

export function onOutboxChange(cb: () => void): () => void {
  window.addEventListener(OUTBOX_EVENT, cb);
  return () => window.removeEventListener(OUTBOX_EVENT, cb);
}

const notifyOutbox = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_EVENT));
};

export async function pendingWriteCount(): Promise<number> {
  const d = await getLocalDb();
  if (!d || !localUserId) return 0;
  return d.outbox.where("userId").equals(localUserId).count().catch(() => 0);
}

async function readCache<T>(url: string): Promise<T | undefined> {
  const d = await getLocalDb();
  if (!d || !localUserId || !isCacheable(url)) return undefined;
  try {
    const row = await d.responses.get(`${localUserId}|${url}`);
    return row?.data as T | undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(url: string, data: unknown) {
  const d = await getLocalDb();
  if (!d || !localUserId || !isCacheable(url)) return;
  try {
    await d.responses.put({
      key: `${localUserId}|${url}`,
      userId: localUserId,
      url,
      data,
      savedAt: Date.now(),
    });
  } catch {
    /* quota or private mode: the cache is best-effort */
  }
}

async function clearCache() {
  const d = await getLocalDb();
  if (!d || !localUserId) return;
  await d.responses.where("userId").equals(localUserId).delete().catch(() => {});
}

export type GetOptions<T> = {
  /** Called with the cached copy (if any) before the network answers. */
  onCached?: (data: T) => void;
};

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof DOMException && err.name === "AbortError") ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  );
}

/** Stale-while-revalidate: cached copy first (via onCached), then always the fresh response. */
export async function apiGet<T>(url: string, opts?: GetOptions<T>): Promise<T> {
  if (opts?.onCached) {
    const cached = await readCache<T>(url);
    if (cached !== undefined) opts.onCached(cached);
  }
  try {
    const res = await timedFetch(url, { ...fetchOpts, cache: "no-store" });
    const data = await handle<T>(res);
    void writeCache(url, data);
    return data;
  } catch (err) {
    // Offline or server unreachable: fall back to the last known copy.
    if (isNetworkError(err)) {
      const cached = await readCache<T>(url);
      if (cached !== undefined) return cached;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError("The request timed out. Check your connection and try again.");
      }
    }
    throw err;
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Mongo-style 24-hex id so a queued create looks like a real one until replay maps it. */
const newTempId = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

/** Patch (or remove, when patch is null) every cached object with this _id so offline edits show up. */
async function applyOptimistic(id: string | undefined, patch: Record<string, unknown> | null) {
  const d = await getLocalDb();
  if (!d || !localUserId || !id) return;

  const touch = (node: unknown): { value: unknown; changed: boolean } => {
    if (Array.isArray(node)) {
      let changed = false;
      const out: unknown[] = [];
      for (const item of node) {
        if (patch === null && item && typeof item === "object" && (item as { _id?: unknown })._id === id) {
          changed = true;
          continue;
        }
        const r = touch(item);
        changed ||= r.changed;
        out.push(r.value);
      }
      return { value: out, changed };
    }
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = { ...(node as Record<string, unknown>) };
      let changed = false;
      if (out._id === id && patch) {
        Object.assign(out, patch);
        changed = true;
      }
      for (const k of Object.keys(out)) {
        if (out[k] && typeof out[k] === "object") {
          const r = touch(out[k]);
          if (r.changed) {
            out[k] = r.value;
            changed = true;
          }
        }
      }
      return { value: out, changed };
    }
    return { value: node, changed: false };
  };

  try {
    const rows = await d.responses.where("userId").equals(localUserId).toArray();
    for (const row of rows) {
      const r = touch(row.data);
      if (r.changed) await d.responses.put({ ...row, data: r.value });
    }
  } catch {
    /* best-effort */
  }
}

function entityId(url: string): string | undefined {
  const parts = url.split("?")[0].split("/").filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 1] : undefined;
}

type Method = OutboxItem["method"];

async function send<T>(method: Method, url: string, payload: unknown, idempotencyKey: string): Promise<T> {
  const hasBody = payload !== undefined;
  const res = await timedFetch(url, {
    ...fetchOpts,
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      "Idempotency-Key": idempotencyKey,
    },
    body: hasBody ? JSON.stringify(payload) : undefined,
  });
  return handle<T>(res);
}

async function enqueue<T>(method: Method, url: string, payload: unknown, key: string): Promise<T> {
  const d = (await getLocalDb())!;
  const tempId = method === "POST" ? newTempId() : undefined;
  await d.outbox.add({
    userId: localUserId!,
    method,
    url,
    body: payload,
    idempotencyKey: key,
    tempId,
    createdAt: Date.now(),
  });
  notifyOutbox();

  const id = entityId(url);
  if (method === "DELETE") await applyOptimistic(id, null);
  else if (method === "PATCH" || method === "PUT") {
    await applyOptimistic(id, (payload ?? {}) as Record<string, unknown>);
  }
  // Optimistic return so callers keep working; real data arrives after replay + refetch.
  if (method === "POST") return { ...(payload as object), _id: tempId } as T;
  if (method === "DELETE") return {} as T;
  return { ...(payload as object), _id: id } as T;
}

async function write<T>(method: Method, url: string, payload?: unknown): Promise<T> {
  const key = newId();
  const canQueue = matches(QUEUEABLE, url) && !!localUserId && !!(await getLocalDb());
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (canQueue && offline) return enqueue<T>(method, url, payload, key);

  try {
    const data = await send<T>(method, url, payload, key);
    // server state changed; derived views (dashboard, analytics) are now stale
    void clearCache().finally(announceChange);
    return data;
  } catch (err) {
    // Connection dropped mid-request: queue it. The same key makes replay safe if it did land.
    if (canQueue && isNetworkError(err)) return enqueue<T>(method, url, payload, key);
    throw err;
  }
}

let flushing = false;

/** Replays queued writes in order. Stops at the first network/5xx failure; drops items the server rejects. */
export async function flushOutbox(): Promise<{ sent: number; dropped: number }> {
  const d = await getLocalDb();
  const result = { sent: 0, dropped: 0 };
  if (!d || !localUserId || flushing) return result;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return result;
  flushing = true;
  try {
    const userId = localUserId;
    const idMap = new Map<string, string>(); // temp id -> real id
    for (;;) {
      const queue = await d.outbox.where("userId").equals(userId).sortBy("createdAt");
      const item = queue[0];
      if (!item || item.id === undefined) break;

      let url = item.url;
      let body = item.body;
      if (idMap.size) {
        let b = body === undefined ? undefined : JSON.stringify(body);
        idMap.forEach((real, temp) => {
          url = url.split(temp).join(real);
          if (b !== undefined) b = b.split(temp).join(real);
        });
        body = b === undefined ? undefined : JSON.parse(b);
      }

      try {
        const data = await send<{ _id?: string } | undefined>(item.method, url, body, item.idempotencyKey);
        if (item.tempId && data && typeof data === "object" && data._id) {
          idMap.set(item.tempId, String(data._id));
        }
        await d.outbox.delete(item.id);
        result.sent++;
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 404 && item.method === "DELETE") {
          await d.outbox.delete(item.id); // already gone: the goal is met
          result.sent++;
        } else if (status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 409) {
          await d.outbox.delete(item.id); // server rejected it; retrying can't help
          result.dropped++;
        } else {
          break; // offline, 5xx, 401, or in-progress: keep the queue and try again later
        }
      }
    }
  } finally {
    flushing = false;
    notifyOutbox();
  }
  if (result.sent || result.dropped) {
    await clearCache();
    announceChange();
  }
  return result;
}

/** Wipe all local data (logout, or a different user signing in on this browser). */
export async function resetLocalData(): Promise<void> {
  const d = await getLocalDb();
  localUserId = null;
  if (!d) return;
  await Promise.all([d.responses.clear(), d.outbox.clear()]).catch(() => {});
  notifyOutbox();
}

export const apiPost = <T>(url: string, payload?: unknown) => write<T>("POST", url, payload);
export const apiPatch = <T>(url: string, payload: unknown) => write<T>("PATCH", url, payload);
export const apiPut = <T>(url: string, payload: unknown) => write<T>("PUT", url, payload);
export const apiDelete = <T>(url: string) => write<T>("DELETE", url);

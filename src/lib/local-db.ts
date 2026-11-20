import Dexie, { type EntityTable } from "dexie";

/** One cached GET response, scoped to the signed-in user. */
export interface CachedResponse {
  key: string; // `${userId}|${url}`
  userId: string;
  url: string;
  data: unknown;
  savedAt: number;
}

/** A write made while offline, replayed to the server in order. */
export interface OutboxItem {
  id?: number;
  userId: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  body?: unknown;
  idempotencyKey: string;
  tempId?: string; // client-generated _id returned to the UI for queued creates
  createdAt: number;
}

class LocalDb extends Dexie {
  responses!: EntityTable<CachedResponse, "key">;
  outbox!: EntityTable<OutboxItem, "id">;

  constructor() {
    super("growthhub-local");
    // Bump the version (never edit an old one) when the schema changes.
    this.version(1).stores({
      responses: "key, userId, savedAt",
      outbox: "++id, userId, createdAt",
    });
  }
}

let db: LocalDb | null = null;

/** Browser-only. Returns null on the server or when IndexedDB is unavailable. */
export function getLocalDb(): LocalDb | null {
  if (typeof indexedDB === "undefined") return null;
  if (!db) db = new LocalDb();
  return db;
}

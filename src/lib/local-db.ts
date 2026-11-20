import type { Dexie, EntityTable } from "dexie";

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

export type LocalDb = Dexie & {
  responses: EntityTable<CachedResponse, "key">;
  outbox: EntityTable<OutboxItem, "id">;
};

let dbPromise: Promise<LocalDb | null> | null = null;

/**
 * Browser-only. Dexie is loaded on first use (dynamic import) so it stays out of the
 * initial JavaScript every page downloads. Resolves to null on the server or when
 * IndexedDB is unavailable.
 */
export function getLocalDb(): Promise<LocalDb | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = import("dexie")
      .then(({ default: DexieCtor }) => {
        const db = new DexieCtor("growthhub-local") as LocalDb;
        // Bump the version (never edit an old one) when the schema changes.
        db.version(1).stores({
          responses: "key, userId, savedAt",
          outbox: "++id, userId, createdAt",
        });
        return db;
      })
      .catch(() => null);
  }
  return dbPromise;
}

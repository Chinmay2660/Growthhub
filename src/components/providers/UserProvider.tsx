"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { User } from "@/types";
import toast from "react-hot-toast";
import { ApiError, UNAUTHORIZED_EVENT, apiGet, apiPatch, apiPost, flushOutbox, pendingWriteCount, resetLocalData, setLocalUser } from "@/lib/api";
import { clearOfflineCaches } from "@/lib/offline-cache";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { normalizeUser } from "@/lib/user";

interface UserContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<boolean>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  updateUser: async () => {},
  logout: async () => true,
});

const USER_STORAGE_KEY = "growthhub-user";

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? normalizeUser(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveStoredUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    /* storage unavailable: just skip the shortcut */
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiGet<User>("/api/auth/me");
      const next = normalizeUser(data);
      setLocalUser(next._id);
      setUser(next);
      saveStoredUser(next);
      void flushOutbox();
    } catch (err) {
      if (err instanceof ApiError) {
        // The server answered and said we're not signed in.
        setLocalUser(null);
        setUser(null);
        saveStoredUser(null);
      }
      // Network failure: keep whatever user we already have (cached or live) so the app works offline.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Show the app shell from the last-known user right away so pages start loading in
    // parallel with /api/auth/me instead of waiting behind it. The server stays authoritative:
    // a 401 from /me (or from any API call) signs the user out.
    const stored = loadStoredUser();
    if (stored) {
      setLocalUser(stored._id);
      setUser(stored);
      setLoading(false);
    }
    refreshUser();
  }, [refreshUser]);

  // Presence heartbeat: lets teammates see who is online. Only pings while the tab is visible.
  const signedIn = Boolean(user?._id);
  useEffect(() => {
    if (!signedIn) return;
    const ping = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void apiPost("/api/presence").catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [signedIn]);

  // Any request answered with 401 means the session ended (expired or revoked): re-check it, which
  // signs the person out and sends them to the login page.
  useEffect(() => {
    if (!signedIn) return;
    const onUnauthorized = () => void refreshUser();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [signedIn, refreshUser]);

  // Replay writes made offline as soon as the connection returns.
  useEffect(() => {
    if (!signedIn) return;
    const onOnline = async () => {
      const { sent, dropped } = await flushOutbox();
      if (sent) toast.success(`Synced ${sent} offline change${sent === 1 ? "" : "s"}`);
      if (dropped) toast.error(`${dropped} offline change${dropped === 1 ? " was" : "s were"} rejected by the server`);
    };
    window.addEventListener("online", onOnline);
    // Retry stalled replays (5xx, dropped connection) every 30s while changes are queued.
    const id = window.setInterval(async () => {
      if ((await pendingWriteCount()) === 0) return;
      const { sent } = await flushOutbox();
      if (sent) toast.success(`Synced ${sent} offline change${sent === 1 ? "" : "s"}`);
    }, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, [signedIn]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) throw new Error("Not signed in");
    const updated = await apiPatch<User>(`/api/users/${user._id}`, updates);
    const next = normalizeUser(updated);
    setUser(next);
    saveStoredUser(next);
  }, [user]);

  const confirm = useConfirm();
  const logout = useCallback(async () => {
    // Try to sync first; logging out wipes the outbox, so warn if changes would be lost.
    await flushOutbox();
    const pending = await pendingWriteCount();
    if (pending > 0) {
      const proceed = await confirm({
        title: "Unsynced changes",
        message: `${pending} change${pending === 1 ? " has" : "s have"} not synced to the server yet. Logging out will discard ${pending === 1 ? "it" : "them"}. Log out anyway?`,
        confirmLabel: "Log out anyway",
        variant: "danger",
      });
      if (!proceed) return false;
    }
    await apiPost("/api/auth/logout");
    saveStoredUser(null);
    await clearOfflineCaches();
    await resetLocalData(); // never leave one user's cached data on a shared browser
    setUser(null);
    return true;
  }, [confirm]);

  const value = useMemo(
    () => ({ user, loading, setUser, refreshUser, updateUser, logout }),
    [user, loading, refreshUser, updateUser, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

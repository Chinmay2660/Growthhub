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
import { apiGet, apiPatch, apiPost, flushOutbox, pendingWriteCount, resetLocalData, setLocalUser } from "@/lib/api";
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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiGet<User>("/api/auth/me");
      const next = normalizeUser(data);
      setLocalUser(next._id);
      setUser(next);
      void flushOutbox();
    } catch {
      setLocalUser(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Presence heartbeat: lets teammates see who is online. Only pings while the tab is visible.
  const signedIn = Boolean(user?._id);
  useEffect(() => {
    if (!signedIn) return;
    const ping = () => {
      if (document.visibilityState === "visible") void apiPost("/api/presence").catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [signedIn]);

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
    setUser(normalizeUser(updated));
  }, [user]);

  const logout = useCallback(async () => {
    // Try to sync first; logging out wipes the outbox, so warn if changes would be lost.
    await flushOutbox();
    const pending = await pendingWriteCount();
    if (pending > 0) {
      const proceed = window.confirm(
        `${pending} change${pending === 1 ? " has" : "s have"} not synced to the server yet. Logging out will discard ${pending === 1 ? "it" : "them"}. Log out anyway?`
      );
      if (!proceed) return false;
    }
    await apiPost("/api/auth/logout");
    await resetLocalData(); // never leave one user's cached data on a shared browser
    setUser(null);
    return true;
  }, []);

  const value = useMemo(
    () => ({ user, loading, setUser, refreshUser, updateUser, logout }),
    [user, loading, refreshUser, updateUser, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}

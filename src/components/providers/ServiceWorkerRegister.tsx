"use client";

import { useEffect } from "react";
import { useUser } from "@/components/providers/UserProvider";
import { warmOfflineData } from "@/lib/offline-warmup";

/** Pages worth having available offline from the first session. Others are cached as they're visited. */
const PRECACHE = ["/dashboard", "/questions", "/subjects", "/topics", "/analytics", "/groups", "/settings"];

/**
 * Production: registers the offline app-shell worker and warms the main pages once signed in.
 * Development: removes any worker and its caches. A leftover worker serving stale scripts is the
 * classic "old design still showing" bug, so it must never run under `next dev`.
 */
export default function ServiceWorkerRegister() {
  const { user } = useUser();
  const userId = user?._id;
  const activeGroupId = user?.activeGroupId;
  const signedIn = Boolean(userId);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if ("caches" in window) {
        void caches
          .keys()
          .then((names) => Promise.all(names.filter((n) => n.startsWith("gh-")).map((n) => caches.delete(n))))
          .catch(() => {});
      }
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !signedIn || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.ready.then(async (reg) => {
      if (cancelled || !navigator.onLine) return;
      reg.active?.postMessage({ type: "PRECACHE", urls: PRECACHE });
      // Also fetch the data for the main screens, and the HTML for every group page, so they
      // open offline without having been visited first.
      const groupRoutes = await warmOfflineData(userId!, activeGroupId);
      if (!cancelled && groupRoutes.length) reg.active?.postMessage({ type: "PRECACHE", urls: groupRoutes });
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, userId, activeGroupId]);

  return null;
}

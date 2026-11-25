"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

/** Fired when notes are marked read, so the badge updates straight away instead of waiting for the next check. */
export const NOTES_CHANGED_EVENT = "growthhub:notes-changed";

const CHECK_EVERY_MS = 120_000;

/** How many cheers and nudges are waiting for the person in their active group. Checked while the tab is visible. */
export function useUnreadNotes(groupId?: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!groupId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      apiGet<{ unread: number }>(`/api/group-notes?groupId=${groupId}`)
        .then((d) => !cancelled && setCount(d.unread ?? 0))
        .catch(() => {});
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener(NOTES_CHANGED_EVENT, check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(NOTES_CHANGED_EVENT, check);
    };
  }, [groupId]);

  return count;
}

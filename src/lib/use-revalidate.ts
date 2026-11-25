"use client";

import { useEffect, useRef } from "react";
import { DATA_CHANGED_EVENT } from "@/lib/api";

// Set by a screen's refresh callback so its loader skips the spinner for that one run.
let quietNext = false;
export const markQuiet = () => {
  quietNext = true;
};
export const takeQuiet = () => {
  const q = quietNext;
  quietNext = false;
  return q;
};

const FOCUS_MIN_GAP_MS = 5_000; // returning to the tab right after a refresh should not refetch again
const POLL_MS = 30_000; // how stale shared data (other members' progress, notes) can get while the tab is open

/**
 * Keeps a screen's data fresh without a manual reload. Calls `refresh` (which should update quietly,
 * without a spinner) when:
 *  - any write succeeds anywhere in the app, so other widgets showing the same data update at once;
 *  - the tab becomes visible again, the window regains focus, or the connection returns;
 *  - every 30 seconds while the tab is visible, which is how changes made by other people arrive.
 */
export function useRevalidate(refresh: () => void, enabled = true) {
  const ref = useRef(refresh);
  useEffect(() => {
    ref.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      last = Date.now();
      ref.current();
    };
    const onReturn = () => {
      if (Date.now() - last >= FOCUS_MIN_GAP_MS) run();
    };
    const onChanged = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, 300); // several writes in a row become one refresh
    };
    const poll = setInterval(run, POLL_MS);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("online", run);
    window.addEventListener(DATA_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(poll);
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", run);
      window.removeEventListener(DATA_CHANGED_EVENT, onChanged);
    };
  }, [enabled]);
}

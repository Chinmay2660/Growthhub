"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin bar at the top of the screen that starts when an in-app link is clicked and finishes when the new
 * route has rendered, so a slow navigation never looks like nothing happened.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (timer.current) clearTimeout(timer.current);
      setState("running");
      timer.current = setTimeout(() => setState("idle"), 10_000); // safety net if the route never changes
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setState("done");
    timer.current = setTimeout(() => setState("idle"), 400);
  }, [pathname]);

  if (state === "idle") return null;
  return <div className="route-progress" data-state={state} role="progressbar" aria-label="Loading page" />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useUser } from "@/components/providers/UserProvider";

// Dialogs are fetched the first time one opens, so the shell stays small.
const CaptureDialogs = dynamic(() => import("./CaptureDialogs"), { ssr: false });

const GO_KEYS: { key: string; label: string; href: (groupId?: string) => string | null }[] = [
  { key: "d", label: "Dashboard", href: () => "/dashboard" },
  { key: "q", label: "Questions", href: () => "/questions" },
  { key: "t", label: "Tasks", href: () => "/tasks" },
  { key: "a", label: "Analytics", href: () => "/analytics" },
  { key: "m", label: "Mock interviews", href: (g) => (g ? `/groups/${g}/mock-interviews` : null) },
];

const SHORTCUT_LABELS = GO_KEYS.map(({ key, label }) => ({ key, label }));

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT" || node.isContentEditable;
}

/** Global shortcuts (g then a letter to navigate, c to capture, ? for help) and the quick-capture dialog. */
export const OPEN_QUICK_CAPTURE_EVENT = "growthhub:quick-capture";

export default function ShortcutsAndCapture() {
  const { user } = useUser();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [dialogsLoaded, setDialogsLoaded] = useState(false);
  const awaitingGo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupId = user?.activeGroupId;

  // Warm the dialogs chunk when the browser is idle so the first shortcut press is instant.
  useEffect(() => {
    const warm = () => void import("./CaptureDialogs");
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 3000);
    return () => clearTimeout(t);
  }, []);

  // Once opened, keep the dialogs mounted so they close with their animation and keep their draft.
  useEffect(() => {
    if (captureOpen || helpOpen) setDialogsLoaded(true);
  }, [captureOpen, helpOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.body.classList.contains("growthhub-modal-open")) return;

      if (awaitingGo.current) {
        clearTimeout(awaitingGo.current);
        awaitingGo.current = null;
        const target = GO_KEYS.find((g) => g.key === e.key.toLowerCase());
        const href = target?.href(groupId);
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (e.key === "g") {
        awaitingGo.current = setTimeout(() => {
          awaitingGo.current = null;
        }, 1200);
      } else if (e.key === "c") {
        e.preventDefault();
        setCaptureOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupId, router]);

  // Lets the mobile top bar open the dialog without owning its state.
  useEffect(() => {
    const open = () => setCaptureOpen(true);
    window.addEventListener(OPEN_QUICK_CAPTURE_EVENT, open);
    return () => window.removeEventListener(OPEN_QUICK_CAPTURE_EVENT, open);
  }, []);

  if (!groupId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture (c)"
        title="Quick capture (c)"
        className="fixed bottom-6 right-6 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 focus-visible:shadow-focus lg:flex"
      >
        <Plus className="h-6 w-6" aria-hidden />
      </button>

      {(captureOpen || helpOpen || dialogsLoaded) && (
        <CaptureDialogs
          groupId={groupId}
          captureOpen={captureOpen}
          onCloseCapture={() => setCaptureOpen(false)}
          helpOpen={helpOpen}
          onCloseHelp={() => setHelpOpen(false)}
          shortcuts={SHORTCUT_LABELS}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useUser } from "@/components/providers/UserProvider";

const GO_KEYS: { key: string; label: string; href: (groupId?: string) => string | null }[] = [
  { key: "d", label: "Dashboard", href: () => "/dashboard" },
  { key: "q", label: "Questions", href: () => "/questions" },
  { key: "s", label: "Tracks", href: () => "/subjects" },
  { key: "a", label: "Analytics", href: () => "/analytics" },
  { key: "m", label: "Mock interviews", href: (g) => (g ? `/groups/${g}/mock-interviews` : null) },
  { key: "g", label: "Groups", href: () => "/groups" },
];

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT" || node.isContentEditable;
}

/** Global keyboard shortcuts: press g then a letter to navigate, ? for the list. */
export default function KeyboardShortcuts() {
  const { user } = useUser();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const awaitingGo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupId = user?.activeGroupId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.body.classList.contains("growthhub-modal-open")) return;

      if (awaitingGo.current) {
        clearTimeout(awaitingGo.current);
        awaitingGo.current = null;
        if (e.key === "Escape") return;
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
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupId, router]);

  return (
    <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" size="sm">
      <ul className="space-y-1.5 text-sm">
        {GO_KEYS.map((g) => (
          <li key={g.key} className="flex justify-between">
            <span>Go to {g.label}</span>
            <span>
              <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">g</kbd>{" "}
              <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">{g.key}</kbd>
            </span>
          </li>
        ))}
        <li className="flex justify-between">
          <span>This help</span>
          <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">?</kbd>
        </li>
      </ul>
    </Modal>
  );
}

"use client";

import { RefObject, useEffect, useRef } from "react";

/** Open dialogs, oldest first. Only the last one (topmost) reacts to Escape and Tab. */
const dialogStack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true" && el.getClientRects().length > 0
  );
}

/** Last focused element outside any dialog, so focus can go back even when a child uses autoFocus. */
let lastOutsideFocus: HTMLElement | null = null;
let trackingFocus = false;

function trackFocus() {
  if (trackingFocus || typeof document === "undefined") return;
  trackingFocus = true;
  document.addEventListener(
    "focusin",
    (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && !t.closest('[aria-modal="true"]')) lastOutsideFocus = t;
    },
    true
  );
}
trackFocus();

function lockScroll() {
  document.body.style.overflow = "hidden";
  document.body.classList.add("growthhub-modal-open");
}

function unlockScroll() {
  document.body.style.overflow = "";
  document.body.classList.remove("growthhub-modal-open");
}

/**
 * Shared dialog behaviour: scroll lock, focus moved in on open and restored on close,
 * Tab/Shift+Tab trapped inside `containerRef`, Escape closing only the topmost dialog.
 */
export function useDialog({
  active,
  onClose,
  containerRef,
}: {
  active: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const activeEl = document.activeElement;
    const previouslyFocused =
      activeEl instanceof HTMLElement && !activeEl.closest('[aria-modal="true"]') && activeEl !== document.body
        ? activeEl
        : lastOutsideFocus;
    lockScroll();

    const container = containerRef.current;
    if (container) {
      const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
      const first =
        preferred ?? getFocusable(container).find((el) => !el.hasAttribute("data-dialog-close"));
      (first ?? container).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const el = containerRef.current;
      if (!el) return;
      const items = getFocusable(el);
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === firstEl || current === el || !el.contains(current))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (current === lastEl || !el.contains(current))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = dialogStack.indexOf(token);
      if (i >= 0) dialogStack.splice(i, 1);
      if (dialogStack.length === 0) unlockScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

type Position = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const GAP = 4;
const MARGIN = 8;

/**
 * A popover that renders in a portal with fixed positioning, so it is never clipped by a modal's
 * scroll area or an `overflow-hidden` card. It opens below the anchor, or above when there is no
 * room, closes on outside click / Escape / resize, and follows the anchor while the page scrolls.
 */
export default function FloatingPanel({
  anchorRef,
  open,
  onClose,
  children,
  width = "anchor",
  maxHeight = 288,
  align = "start",
  className,
  id,
  role,
  "aria-label": ariaLabel,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "anchor" matches the trigger's width; a number is a fixed width in px. */
  width?: "anchor" | number;
  maxHeight?: number;
  align?: "start" | "end";
  className?: string;
  id?: string;
  role?: string;
  "aria-label"?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = width === "anchor" ? r.width : width;
    const wanted = panelRef.current?.scrollHeight ?? maxHeight;
    const below = window.innerHeight - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const openUp = below < Math.min(wanted, maxHeight) && above > below;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN));
    setPos(
      openUp
        ? { left, width: w, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(maxHeight, above) }
        : { left, width: w, top: r.bottom + GAP, maxHeight: Math.min(maxHeight, below) }
    );
  }, [anchorRef, width, maxHeight, align]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    update();
  }, [open, update, children]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // don't also close a modal underneath
        onClose();
        (anchorRef.current?.querySelector("button") ?? (anchorRef.current as HTMLElement | null))?.focus?.();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, onClose, update, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        zIndex: 300, // above the modal layer (z-200)
        left: pos?.left ?? 0,
        width: pos?.width,
        top: pos?.top,
        bottom: pos?.bottom,
        maxHeight: pos?.maxHeight,
        visibility: pos ? "visible" : "hidden",
      }}
      className={clsx(
        "overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-panel animate-scale-in",
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
}

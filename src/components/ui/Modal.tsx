"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialog } from "./use-dialog";

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  dismissOnOverlay = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Clicking the dark overlay closes the dialog. */
  dismissOnOverlay?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDialog({ active: open && mounted, onClose, containerRef: dialogRef });

  if (!open || !mounted) return null;

  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] isolate flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 z-0 animate-fade-in bg-[var(--overlay)]"
        onClick={dismissOnOverlay ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "relative z-10 isolate max-h-[min(90dvh,100%)] w-full overflow-y-auto animate-scale-in rounded-2xl bg-[var(--card)] p-6 shadow-panel focus:outline-none",
          sizes[size]
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-dialog-close
            className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

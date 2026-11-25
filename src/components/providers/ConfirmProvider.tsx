"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import { useDialog } from "@/components/ui/use-dialog";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
};

type ConfirmState = ConfirmOptions & { open: true };

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: (confirmed: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const {
    title = "Are you sure?",
    message,
    confirmLabel,
    cancelLabel = "Cancel",
    variant = "danger",
  } = state;
  const resolvedConfirmLabel =
    confirmLabel ?? (variant === "danger" ? "Delete" : "Confirm");

  useEffect(() => {
    setMounted(true);
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const messageId = `${uid}-message`;

  useDialog({ active: mounted, onClose: () => onClose(false), containerRef: dialogRef });

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[250] isolate flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 z-0 animate-fade-in bg-[var(--overlay)]"
        onClick={() => onClose(false)}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md animate-scale-in rounded-2xl bg-[var(--card)] p-6 shadow-panel focus:outline-none"
      >
        <h3
          id={titleId}
          className="text-lg font-semibold text-[var(--foreground)]"
        >
          {title}
        </h3>
        <p id={messageId} className="mt-2 text-sm text-[var(--muted)]">
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" data-autofocus onClick={() => onClose(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={() => onClose(true)}
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts: ConfirmOptions =
      typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...opts, open: true });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(result);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state?.open ? <ConfirmDialog state={state} onClose={close} /> : null}
    </ConfirmContext.Provider>
  );
}

import { ReactNode } from "react";
import clsx from "clsx";
import Button from "./Button";

/**
 * Standard footer for form modals: ghost Cancel + the primary action on the right (stacked, primary
 * first, on mobile). `start` renders a secondary action (e.g. Delete) on the left on wider screens.
 */
export default function ModalFooter({
  onCancel,
  cancelLabel = "Cancel",
  cancelDisabled,
  start,
  children,
  className,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  start?: ReactNode;
  /** The primary action button(s). */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "mt-5 flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
    >
      {start && <div className="flex flex-col sm:mr-auto">{start}</div>}
      <Button type="button" variant="ghost" onClick={onCancel} disabled={cancelDisabled}>
        {cancelLabel}
      </Button>
      {children}
    </div>
  );
}

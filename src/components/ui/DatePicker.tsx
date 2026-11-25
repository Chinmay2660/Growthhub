"use client";

import clsx from "clsx";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import FloatingPanel from "./FloatingPanel";

/** Values are plain `YYYY-MM-DD` strings (same as <input type="date">), so callers don't change. */
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function display(value: string): string {
  const p = parse(value);
  if (!p) return "";
  return new Date(p.y, p.m, p.d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Custom calendar popover (replaces the native date input). */
export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  disabled,
  clearable,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Show a Clear button (for optional dates). */
  clearable?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const uid = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [view, setView] = useState(() => {
    const p = selected ?? parse(todayKey())!;
    return { y: p.y, m: p.m };
  });
  const [focusKey, setFocusKey] = useState(value || todayKey());

  const outOfRange = useCallback(
    (key: string) => (min ? key < min : false) || (max ? key > max : false),
    [min, max]
  );

  const openCalendar = () => {
    if (disabled) return;
    const p = parse(value) ?? parse(todayKey())!;
    setView({ y: p.y, m: p.m });
    setFocusKey(value || todayKey());
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);

  const pick = (key: string) => {
    if (outOfRange(key)) return;
    onChange(key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  // 6 rows x 7 columns starting on the Sunday on/before the 1st
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const start = new Date(view.y, view.m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { key: toKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === view.m };
    });
  }, [view]);

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const moveFocus = (days: number) => {
    const p = parse(focusKey)!;
    const d = new Date(p.y, p.m, p.d + days);
    setFocusKey(toKey(d.getFullYear(), d.getMonth(), d.getDate()));
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${focusKey}"]`)?.focus();
  }, [open, focusKey, view]);

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      moveFocus(step[e.key]);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const p = parse(focusKey)!;
      const d = new Date(p.y, p.m + (e.key === "PageUp" ? -1 : 1), p.d);
      setFocusKey(toKey(d.getFullYear(), d.getMonth(), d.getDate()));
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
  };

  const today = todayKey();

  return (
    <div ref={anchorRef} className={clsx("relative", className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-cal` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openCalendar())}
        className={clsx(
          "input flex items-center justify-between gap-2 text-left !py-2",
          open && "!border-[var(--accent)] shadow-[0_0_0_3px_var(--ring)]"
        )}
      >
        <span className={clsx("truncate", !value && "text-[var(--muted)]")}>{value ? display(value) : placeholder}</span>
        <Calendar className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      </button>
      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={close}
        id={`${uid}-cal`}
        role="dialog"
        aria-label="Choose date"
        width={280}
        maxHeight={400}
        className="!p-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold" aria-live="polite">
            {MONTHS[view.m]} {view.y}
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-[var(--muted)]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div ref={gridRef} role="grid" className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKey}>
          {cells.map((c) => {
            const isSel = c.key === value;
            const isToday = c.key === today;
            const off = outOfRange(c.key);
            return (
              <button
                key={c.key}
                type="button"
                role="gridcell"
                data-key={c.key}
                aria-selected={isSel}
                aria-current={isToday ? "date" : undefined}
                disabled={off}
                tabIndex={c.key === focusKey ? 0 : -1}
                onClick={() => pick(c.key)}
                className={clsx(
                  "h-8 rounded-lg text-sm transition-colors",
                  !c.inMonth && "text-[var(--muted)] opacity-50",
                  off && "cursor-not-allowed opacity-30",
                  isSel
                    ? "bg-brand font-semibold text-white"
                    : "hover:bg-[var(--surface-muted)]",
                  isToday && !isSel && "ring-1 ring-brand/60"
                )}
              >
                {c.day}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-xs">
          <button
            type="button"
            onClick={() => pick(today)}
            disabled={outOfRange(today)}
            className="rounded-md px-2 py-1 font-medium text-brand hover:bg-brand/10 disabled:opacity-40"
          >
            Today
          </button>
          {clearable && value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            >
              Clear
            </button>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}

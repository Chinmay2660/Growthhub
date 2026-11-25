"use client";

import clsx from "clsx";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import FloatingPanel from "./FloatingPanel";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional leading element (dot, icon) shown in the list and the trigger. */
  leading?: ReactNode;
};

/**
 * Custom single-select dropdown (replaces the native <select>). Keyboard: Arrow keys / Home / End
 * move, Enter or Space picks, Escape closes, typing jumps to a matching option.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  triggerClassName,
  panelClassName,
  id,
  "aria-label": ariaLabel,
  icon,
  align = "start",
  panelWidth = "anchor",
  onClick,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Wrapper classes (width, margin). */
  className?: string;
  /** Replaces the default field-style trigger, e.g. for the status pill. */
  triggerClassName?: string;
  panelClassName?: string;
  id?: string;
  "aria-label"?: string;
  icon?: ReactNode;
  align?: "start" | "end";
  panelWidth?: "anchor" | number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef({ text: "", t: 0 });

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback(() => setOpen(false), []);
  const openList = useCallback(() => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const pick = useCallback(
    (i: number) => {
      const o = options[i];
      if (!o || o.disabled) return;
      onChange(o.value);
      setOpen(false);
      buttonRef.current?.focus();
    },
    [options, onChange]
  );

  const move = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let step = 1; step <= options.length; step++) {
        const i = (from + dir * step + options.length * 2) % options.length;
        if (!options[i].disabled) return i;
      }
      return from;
    },
    [options]
  );

  // keep the active option visible while moving with the keyboard
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) return openList();
        setActive((a) => move(a, e.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? move(-1, 1) : move(options.length, -1));
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) return openList();
        if (active >= 0) pick(active);
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          typed.current.text = now - typed.current.t > 700 ? e.key : typed.current.text + e.key;
          typed.current.t = now;
          const q = typed.current.text.toLowerCase();
          const i = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(q));
          if (i >= 0) {
            if (!open) setOpen(true);
            setActive(i);
          }
        }
    }
  };

  return (
    <div ref={anchorRef} className={clsx("relative", className)} onClick={onClick}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={
          triggerClassName ??
          clsx(
            "input flex items-center justify-between gap-2 text-left !py-2",
            open && "!border-[var(--accent)] shadow-[0_0_0_3px_var(--ring)]"
          )
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          {selected?.leading}
          <span className={clsx("truncate", !selected && "text-[var(--muted)]")}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={clsx("h-4 w-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={close}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        align={align}
        width={panelWidth}
        className={panelClassName}
      >
        {options.length === 0 && <div className="px-3 py-2 text-sm text-[var(--muted)]">No options</div>}
        {options.map((o, i) => {
          const isSel = o.value === value;
          return (
            <div
              key={o.value}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={isSel}
              aria-disabled={o.disabled || undefined}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()} // keep focus on the trigger
              onClick={() => pick(i)}
              className={clsx(
                "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
                o.disabled && "cursor-not-allowed opacity-40",
                i === active ? "bg-brand/10 text-[var(--foreground)]" : "text-[var(--foreground)]",
                isSel && "font-semibold"
              )}
            >
              {o.leading}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {isSel && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />}
            </div>
          );
        })}
      </FloatingPanel>
    </div>
  );
}

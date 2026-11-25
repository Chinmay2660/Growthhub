"use client";

import clsx from "clsx";
import { useRef } from "react";

/** Custom slider (replaces <input type="range">). Pointer drag and keyboard (arrows, Page, Home/End). */
export default function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-valuetext": ariaValueText,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-valuetext"?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => clamp(Math.round((v - min) / step) * step + min);
  const pct = max === min ? 0 : ((clamp(value) - min) / (max - min)) * 100;

  const fromPointer = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    onChange(snap(min + ((clientX - r.left) / r.width) * (max - min)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const big = Math.max(step, (max - min) / 10);
    const next: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (e.key in next) {
      e.preventDefault();
      onChange(snap(next[e.key]));
    }
  };

  return (
    <div
      ref={trackRef}
      className={clsx("relative h-6 w-full touch-none select-none", disabled ? "opacity-50" : "cursor-pointer", className)}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!disabled && e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--surface-muted)]">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div
        id={id}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamp(value)}
        aria-valuetext={ariaValueText}
        aria-disabled={disabled}
        onKeyDown={onKeyDown}
        style={{ left: `${pct}%` }}
        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-[var(--card)] shadow-soft transition-shadow focus-visible:shadow-focus focus-visible:outline-none"
      />
    </div>
  );
}

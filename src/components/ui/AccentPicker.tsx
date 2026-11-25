"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { ACCENTS, applyAccent, getStoredAccent } from "@/lib/accent";

/**
 * Accent colour choice. Each preset is checked for readable contrast in both light and dark mode, so any pick
 * keeps buttons and links legible. The choice is saved on this device and applied before the page paints.
 */
export default function AccentPicker() {
  const labelId = useId();
  const [accent, setAccent] = useState(getStoredAccent);

  return (
    <div className="mt-5">
      <p id={labelId} className="text-sm font-medium">
        Accent colour
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Used for buttons, links and highlights. Every option stays readable in light and dark mode.
      </p>
      <div role="group" aria-labelledby={labelId} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ACCENTS.map((a) => {
          const active = accent === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={active}
              title={`${a.label}, similar to ${a.like}`}
              onClick={() => {
                applyAccent(a.id);
                setAccent(a.id);
              }}
              className={clsx(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-brand bg-brand/10 text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--input-border)] hover:text-[var(--foreground)]"
              )}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm"
                style={{ background: a.swatch }}
                aria-hidden
              >
                {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
              </span>
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

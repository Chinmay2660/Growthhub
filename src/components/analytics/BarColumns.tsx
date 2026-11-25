"use client";

import clsx from "clsx";

export type BarItem = {
  key: string;
  /** Main label under the bar (for example a weekday or a round). */
  label: string;
  /** Smaller second line (for example the day of the month). */
  sub?: string;
  value: number;
  /** Highlights the column, e.g. today. */
  emphasis?: boolean;
};

/**
 * Evenly spaced column chart. Every column gets the same width and the same labels, so the axis never shifts
 * or skips entries, and the chart fills whatever width its card gives it. Values are written above the bars.
 */
export default function BarColumns({
  items,
  max,
  height = 168,
  suffix = "",
  ariaLabel,
}: {
  items: BarItem[];
  /** Top of the scale; defaults to the largest value. */
  max?: number;
  height?: number;
  /** Appended to the value in the tooltip, e.g. "solved". */
  suffix?: string;
  ariaLabel: string;
}) {
  const top = Math.max(max ?? 0, ...items.map((i) => i.value), 1);
  const total = items.reduce((n, i) => n + i.value, 0);

  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <div className="relative flex items-end gap-1.5 sm:gap-2.5" style={{ height }}>
        {/* faint guide lines so bar heights are easy to compare */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div
            key={f}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--border)]"
            style={{ bottom: `${f * 100}%` }}
          />
        ))}
        {items.map((item) => {
          const pct = (item.value / top) * 100;
          return (
            <div
              key={item.key}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              title={`${item.label}${item.sub ? ` ${item.sub}` : ""}: ${item.value}${suffix ? ` ${suffix}` : ""}`}
            >
              {item.value > 0 && (
                <span className="mb-1 text-xs font-semibold tabular-nums text-[var(--foreground)]">{item.value}</span>
              )}
              <div
                className={clsx(
                  "w-full max-w-[3rem] rounded-t-md transition-[height] duration-300",
                  item.value > 0 ? (item.emphasis ? "bg-brand" : "bg-brand/70") : "bg-[var(--surface-muted)]"
                )}
                style={{ height: item.value > 0 ? `max(${pct}%, 4px)` : "3px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {items.map((item) => (
          <div key={item.key} className="min-w-0 flex-1 text-center leading-tight">
            <p className={clsx("truncate text-xs", item.emphasis ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]")}>
              {item.label}
            </p>
            {item.sub && <p className="text-xs text-[var(--muted)]">{item.sub}</p>}
          </div>
        ))}
      </div>
      {total === 0 && <p className="mt-2 text-xs text-[var(--muted)]">Nothing here yet.</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Card from "@/components/ui/Card";
import {
  REALITY_QUOTES,
  ROTATE_EVERY_MS,
  categoryOf,
  createQuoteDeck,
  highlightSegments,
  personalQuotes,
  type RealityQuote,
} from "@/lib/reality-check";

const FADE_MS = 200;

/**
 * REALITY CHECK: one blunt, sarcastic career-and-money line at a time. It changes by itself every 60 seconds,
 * with a quiet countdown. The timer counts down to a wall-clock deadline instead of counting ticks, so it stays
 * accurate when the browser throttles a background tab: coming back shows a fresh quote, not a stuck countdown.
 */
export default function RealityCheck({
  targetCtcLpa,
  targetCompany,
  targetRole,
}: {
  /** From Settings: makes some roasts about the person's own number. */
  targetCtcLpa?: number | null;
  targetCompany?: string | null;
  targetRole?: string | null;
}) {
  // The shared list, plus lines written around the person's own CTC target when one is set.
  const pool = useMemo(
    () => [...REALITY_QUOTES, ...personalQuotes(targetCtcLpa, targetCompany, targetRole)],
    [targetCtcLpa, targetCompany, targetRole]
  );

  const [quote, setQuote] = useState<RealityQuote>(() => createQuoteDeck(pool).next());
  const [visible, setVisible] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(ROTATE_EVERY_MS / 1000);
  const [progress, setProgress] = useState(1);

  const quoteRef = useRef(quote);
  const deckRef = useRef<ReturnType<typeof createQuoteDeck> | null>(null);
  const deckPool = useRef<RealityQuote[] | null>(null);
  const deadlineRef = useRef(0);
  const fadeTimer = useRef<number | null>(null);

  /** Fades to the next quote (never the same one twice in a row) and restarts the 60 seconds. */
  const swap = useCallback(() => {
    if (!deckRef.current || deckPool.current !== pool) {
      // The new deck starts after whatever is showing, so a change of pool can't repeat it either.
      deckRef.current = createQuoteDeck(pool, Math.random, quoteRef.current.id);
      deckPool.current = pool;
    }
    const next = deckRef.current.next();
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    setVisible(false);
    fadeTimer.current = window.setTimeout(() => {
      quoteRef.current = next;
      setQuote(next);
      setVisible(true);
    }, FADE_MS);
    deadlineRef.current = Date.now() + ROTATE_EVERY_MS;
    setSecondsLeft(ROTATE_EVERY_MS / 1000);
    setProgress(1);
  }, [pool]);

  useEffect(() => {
    deadlineRef.current = Date.now() + ROTATE_EVERY_MS;
    const tick = () => {
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        swap(); // one change however long the tab was asleep, never a burst
      } else {
        setSecondsLeft(Math.ceil(left / 1000));
        setProgress(left / ROTATE_EVERY_MS);
      }
    };
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    };
  }, [swap]);

  const category = categoryOf(quote.category);

  return (
    <Card className="relative overflow-hidden" aria-label="Reality check">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/15 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">Reality Check 🔥</h2>
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand",
              "transition-opacity duration-200",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            <span aria-hidden>{quote.personal ? "🎯" : category.emoji}</span>{" "}
            {quote.personal ? "Your CTC target" : category.label}
          </span>
        </div>

        {/* aria-live is off: a new line every minute should not interrupt a screen reader */}
        <blockquote
          className={clsx(
            "mt-4 flex min-h-[8rem] items-center text-2xl font-extrabold leading-tight tracking-tight",
            "text-[var(--foreground)] transition-all duration-200 ease-out sm:min-h-[6.5rem] sm:text-3xl",
            visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
          )}
          aria-live="off"
        >
          <p>
            {highlightSegments(quote.text).map((seg, i) =>
              seg.hot ? (
                <mark key={i} className="rounded bg-brand/20 px-1 font-black text-brand">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </p>
        </blockquote>
        {quote.source && (
          <p
            className={clsx(
              "mt-1 text-xs text-[var(--muted)] transition-opacity duration-200",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            Inspired by <span className="font-medium">{quote.source}</span>
          </p>
        )}

        <div className="mt-4">
          <p className="mb-1.5 text-xs tabular-nums text-[var(--muted)]">Next roast in {secondsLeft}s</p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden>
            <div
              className="h-full rounded-full bg-brand/70 transition-[width] duration-300 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

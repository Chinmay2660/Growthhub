"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronUp, Flame, Pause, Play } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import {
  DEFAULT_REALITY_PREFS,
  REALITY_CATEGORIES,
  REALITY_PREFS_KEY,
  REALITY_QUOTES,
  ROTATE_EVERY_MS,
  categoryOf,
  createQuoteDeck,
  highlightSegments,
  parseRealityPrefs,
  personalQuotes,
  type RealityPrefs,
  type RealityQuote,
} from "@/lib/reality-check";

const FADE_MS = 200;

/** The shared list for the chosen category, plus the person's own CTC lines (shown with "All" and "CTC Obsession"). */
const poolFor = (category: RealityPrefs["category"], mine: RealityQuote[]) => [
  ...(category === "all" ? REALITY_QUOTES : REALITY_QUOTES.filter((q) => q.category === category)),
  ...(category === "all" || category === "ctc" ? mine : []),
];

function loadPrefs(): RealityPrefs {
  if (typeof window === "undefined") return DEFAULT_REALITY_PREFS;
  try {
    return parseRealityPrefs(localStorage.getItem(REALITY_PREFS_KEY));
  } catch {
    return DEFAULT_REALITY_PREFS; // storage blocked: the card still works, it just won't remember
  }
}

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...REALITY_CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}` })),
];

/**
 * REALITY CHECK: one blunt, sarcastic career-and-money line at a time, a new one every 60 seconds.
 * The timer counts down to a wall-clock deadline instead of counting ticks, so it stays accurate when
 * the browser throttles a background tab: coming back shows a fresh quote, not a stuck countdown.
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
  const mine = useMemo(
    () => personalQuotes(targetCtcLpa, targetCompany, targetRole),
    [targetCtcLpa, targetCompany, targetRole]
  );
  const [prefs, setPrefs] = useState<RealityPrefs>(loadPrefs);
  const [quote, setQuote] = useState<RealityQuote>(() => createQuoteDeck(poolFor(loadPrefs().category, personalQuotes(targetCtcLpa, targetCompany, targetRole))).next());
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ROTATE_EVERY_MS / 1000);
  const [progress, setProgress] = useState(1);
  const [announce, setAnnounce] = useState(false);

  const quoteRef = useRef(quote);
  const prefsRef = useRef(prefs);
  const deckRef = useRef<ReturnType<typeof createQuoteDeck> | null>(null);
  const deckKey = useRef<string | null>(null);
  const mineRef = useRef(mine);
  const deadlineRef = useRef(0);
  const leftWhenStoppedRef = useRef(ROTATE_EVERY_MS);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    mineRef.current = mine;
  }, [mine]);

  const nextQuote = useCallback((): RealityQuote => {
    const category = prefsRef.current.category;
    const key = `${category}|${mineRef.current.length}`;
    if (!deckRef.current || deckKey.current !== key) {
      // the new deck starts after whatever is showing, so a category change can't repeat it either
      deckRef.current = createQuoteDeck(poolFor(category, mineRef.current), Math.random, quoteRef.current.id);
      deckKey.current = key;
    }
    return deckRef.current.next();
  }, []);

  /** Fades to the next quote and restarts the 60 seconds. */
  const swap = useCallback(
    (manual: boolean) => {
      const next = nextQuote();
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
      setAnnounce(manual); // only a button press is read out; the minute-by-minute change stays silent
      setVisible(false);
      fadeTimer.current = window.setTimeout(() => {
        quoteRef.current = next;
        setQuote(next);
        setVisible(true);
      }, FADE_MS);
      deadlineRef.current = Date.now() + ROTATE_EVERY_MS;
      leftWhenStoppedRef.current = ROTATE_EVERY_MS;
      setSecondsLeft(ROTATE_EVERY_MS / 1000);
      setProgress(1);
    },
    [nextQuote]
  );

  const running = prefs.autoRotate && !paused && !prefs.collapsed;

  useEffect(() => {
    if (!running) return;
    deadlineRef.current = Date.now() + leftWhenStoppedRef.current;

    const tick = () => {
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        swap(false); // one change however long the tab was asleep, never a burst
      } else {
        setSecondsLeft(Math.ceil(left / 1000));
        setProgress(left / ROTATE_EVERY_MS);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      // remember what was left so Resume continues instead of starting over
      leftWhenStoppedRef.current = Math.max(1000, deadlineRef.current - Date.now());
    };
  }, [running, swap]);

  useEffect(
    () => () => {
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    },
    []
  );

  const update = (patch: Partial<RealityPrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    try {
      localStorage.setItem(REALITY_PREFS_KEY, JSON.stringify(next));
    } catch {
      /* private mode or blocked storage: keep working for this visit */
    }
  };

  if (prefs.collapsed) {
    return (
      <Card padding="sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="h-4 w-4 text-brand" aria-hidden /> Reality Check 🔥
          </span>
          <Button size="sm" variant="ghost" onClick={() => update({ collapsed: false })}>
            Show
          </Button>
        </div>
      </Card>
    );
  }

  const category = categoryOf(quote.category);
  const countdown = !prefs.autoRotate ? "Auto-rotate is off" : paused ? "Paused" : `Next roast in ${secondsLeft}s`;

  return (
    <Card className="relative overflow-hidden" aria-label="Reality check">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/15 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <Button size="sm" variant="ghost" onClick={() => update({ collapsed: true })} aria-label="Hide Reality Check">
            <ChevronUp className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <blockquote
          className={clsx(
            "mt-4 flex min-h-[8rem] items-center text-2xl font-extrabold leading-tight tracking-tight",
            "text-[var(--foreground)] transition-all duration-200 ease-out sm:min-h-[6.5rem] sm:text-3xl",
            visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
          )}
          aria-live={announce ? "polite" : "off"}
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
          <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="tabular-nums">{countdown}</span>
            <span>{REALITY_QUOTES.length} roasts and counting</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden>
            <div
              className="h-full rounded-full bg-brand/70 transition-[width] duration-300 ease-linear"
              style={{ width: `${prefs.autoRotate ? progress * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => swap(true)}>Roast Me Again 🔥</Button>
          <Button
            variant="outline"
            onClick={() => setPaused((p) => !p)}
            disabled={!prefs.autoRotate}
            aria-label={paused ? "Resume automatic roasts" : "Pause automatic roasts"}
          >
            {paused ? (
              <>
                <Play className="mr-1.5 h-4 w-4" aria-hidden /> Resume
              </>
            ) : (
              <>
                <Pause className="mr-1.5 h-4 w-4" aria-hidden /> Pause
              </>
            )}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={prefs.autoRotate}
              onCheckedChange={(on) => {
                if (on) leftWhenStoppedRef.current = ROTATE_EVERY_MS; // a fresh minute when switched back on
                setPaused(false);
                update({ autoRotate: on });
              }}
              aria-label="Change the quote automatically every 60 seconds"
            />
            <span className="text-[var(--muted)]">Auto-rotate</span>
          </label>
          <Select
            className="w-full sm:ml-auto sm:w-64"
            value={prefs.category}
            aria-label="Quote category"
            options={CATEGORY_OPTIONS}
            onChange={(value) => {
              update({ category: value as RealityPrefs["category"] });
              swap(true);
            }}
          />
        </div>
      </div>
    </Card>
  );
}

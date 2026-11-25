"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Card, { CardHeader } from "@/components/ui/Card";
import { apiGet } from "@/lib/api";

type Point = {
  roundNumber: number;
  score: number | null;
  reviewers: number;
  rubric: Record<string, number | null>;
};

const DIMENSIONS = [
  { key: "communication", color: "#6366f1" },
  { key: "correctness", color: "#10b981" },
  { key: "depth", color: "#f59e0b" },
  { key: "confidence", color: "#ec4899" },
];
const SCORE_COLOR = "#94a3b8";

const MAX_RATING = 5;
const PLOT_H = 220;
const TOP = 18; // room for the value label above the tallest bar
const LEFT = 26;
const RIGHT = 8;
// below the bars: overall score bar, its number, the round label and the reviewer count
const SCORE_ROW = 64;
const BOTTOM = SCORE_ROW;
const MIN_SLOT = 84;
const MAX_SLOT = 320; // a single round should not stretch across the whole card // below this per round the chart scrolls sideways instead of squeezing
const BAR_GAP = 4;
const H = TOP + PLOT_H + BOTTOM;

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Tracks an element's width so the chart can use all the space the card gives it. */
function useWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

/**
 * A member's peer feedback per round. Skill ratings (1–5) are grouped bars, one per skill, sized to fill
 * the card; the overall score (0–100) sits under each round as its own bar, because the two scales differ
 * and sharing an axis would hide one of them. Works for the signed-in person or any other group member.
 */
export default function RubricTrendChart({
  groupId,
  userId,
  name,
}: {
  groupId: string;
  /** Whose results to show; defaults to the signed-in person. */
  userId?: string;
  /** Set when showing someone else, so the title says whose it is. */
  name?: string;
}) {
  const [loaded, setLoaded] = useState<{ key: string; points: Point[] } | null>(null);
  const [wrapRef, wrapWidth] = useWidth<HTMLDivElement>();
  const key = `${groupId}|${userId ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    const url = `/api/mock-interviews/trends?groupId=${groupId}${userId ? `&userId=${userId}` : ""}`;
    apiGet<{ points: Point[] }>(url, {
      onCached: (c) => !cancelled && setLoaded({ key, points: c.points }),
    })
      .then((d) => !cancelled && setLoaded({ key, points: d.points }))
      .catch(() => !cancelled && setLoaded({ key, points: [] }));
    return () => {
      cancelled = true;
    };
  }, [groupId, userId, key]);

  // Show nothing for the previous person while the next person's results load.
  const points = loaded && loaded.key === key ? loaded.points : null;
  if (points === null) return null;

  const n = Math.max(points.length, 1);
  const avail = Math.max(wrapWidth - LEFT - RIGHT, 0);
  const slotW = clamp(avail / n, MIN_SLOT, MAX_SLOT);
  const width = LEFT + RIGHT + Math.max(avail, slotW * n);
  const offset = Math.max(0, (avail - slotW * n) / 2); // centre the rounds when there are few
  // bars grow with the room available, but stay readable and never fill the whole slot
  const barW = clamp((slotW * 0.62 - BAR_GAP * (DIMENSIONS.length - 1)) / DIMENSIONS.length, 10, 52);
  const groupW = DIMENSIONS.length * barW + (DIMENSIONS.length - 1) * BAR_GAP;
  const y = (v: number) => TOP + PLOT_H - (v / MAX_RATING) * PLOT_H;
  const scoreTrackW = Math.min(slotW * 0.7, 160);

  const hasRubric = (p: Point) => DIMENSIONS.some((d) => p.rubric[d.key] != null);
  const owner = name ? `${name}'s` : "Your";

  return (
    <Card>
      <CardHeader
        title={`${owner} feedback trend`}
        subtitle={
          name
            ? "Average peer rating per round (1–5) with the overall score (0–100)."
            : "Average peer rating per round (1–5) with your overall score (0–100). Are you improving?"
        }
      />
      {points.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {name ? `${name} has no peer ratings yet.` : "Ratings from peers will chart here after your first mock."}
        </p>
      ) : (
        <>
          <div ref={wrapRef} className="w-full overflow-x-auto">
            <svg
              width={width}
              height={H}
              viewBox={`0 0 ${width} ${H}`}
              className="block max-w-none"
              role="img"
              aria-label={`${owner} peer ratings and overall scores for ${points.length} round${points.length === 1 ? "" : "s"}`}
            >
              {[0, 1, 2, 3, 4, 5].map((v) => (
                <g key={v}>
                  <line
                    x1={LEFT}
                    x2={width - RIGHT}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="currentColor"
                    opacity={v === 0 ? 0.3 : 0.1}
                  />
                  <text x={LEFT - 8} y={y(v) + 3} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.5}>
                    {v}
                  </text>
                </g>
              ))}
              {points.map((p, i) => {
                const cx = LEFT + offset + i * slotW + slotW / 2; // centre of this round's slot
                const gx = cx - groupW / 2;
                const rubric = hasRubric(p);
                const base = TOP + PLOT_H;
                return (
                  <g key={p.roundNumber}>
                    {rubric ? (
                      DIMENSIONS.map((d, di) => {
                        const v = p.rubric[d.key];
                        if (v == null) return null;
                        const bx = gx + di * (barW + BAR_GAP);
                        const by = y(v);
                        return (
                          <g key={d.key}>
                            <title>{`Round ${p.roundNumber} · ${d.key}: ${fmt(v)} / ${MAX_RATING}`}</title>
                            <rect x={bx} y={by} width={barW} height={y(0) - by} rx={3} fill={d.color} />
                            <text
                              x={bx + barW / 2}
                              y={by - 4}
                              fontSize={10}
                              textAnchor="middle"
                              fill="currentColor"
                              opacity={0.8}
                            >
                              {fmt(v)}
                            </text>
                          </g>
                        );
                      })
                    ) : (
                      <text x={cx} y={TOP + PLOT_H / 2} fontSize={11} textAnchor="middle" fill="currentColor" opacity={0.45}>
                        No skill ratings
                      </text>
                    )}

                    {/* overall score, 0–100 */}
                    {p.score != null ? (
                      <g>
                        <title>{`Round ${p.roundNumber} · overall score: ${fmt(p.score)} / 100`}</title>
                        <rect x={cx - scoreTrackW / 2} y={base + 10} width={scoreTrackW} height={6} rx={3} fill="currentColor" opacity={0.12} />
                        <rect
                          x={cx - scoreTrackW / 2}
                          y={base + 10}
                          width={(clamp(p.score, 0, 100) / 100) * scoreTrackW}
                          height={6}
                          rx={3}
                          fill={SCORE_COLOR}
                        />
                        <text x={cx} y={base + 29} fontSize={11} fontWeight={600} textAnchor="middle" fill="currentColor" opacity={0.85}>
                          {fmt(p.score)}
                          <tspan fontSize={9} fontWeight={400} opacity={0.6}>
                            {" "}
                            / 100
                          </tspan>
                        </text>
                      </g>
                    ) : (
                      <text x={cx} y={base + 29} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.45}>
                        No score
                      </text>
                    )}

                    <text x={cx} y={H - 17} fontSize={11} textAnchor="middle" fill="currentColor" opacity={0.75}>
                      R{p.roundNumber}
                    </text>
                    {p.reviewers > 0 && (
                      <text x={cx} y={H - 4} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.5}>
                        {p.reviewers} reviewer{p.reviewers === 1 ? "" : "s"}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {DIMENSIONS.map((d) => (
              <li key={d.key} className="flex items-center gap-1.5 capitalize">
                <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                {d.key}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: SCORE_COLOR }} />
              Overall score (0–100)
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}

"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import StudyHoursChart from "@/components/analytics/d3/StudyHoursChart";
import { formatDate } from "@/lib/utils";
import type { AnalyticsData } from "@/types";

/** Sum two per-day series that cover the same days. */
function combine(a: AnalyticsData["personal"]["activity"], b: AnalyticsData["group"]["activity"]) {
  return a.map((day, i) => ({ date: day.date, label: day.label, count: day.count + (b[i]?.count ?? 0) }));
}

/**
 * Trends over time: this week against last week, the last 14 days, how far each track is, and mock
 * scores. All of it comes from data the analytics API already computes.
 */
export default function AnalyticsTrends({ data }: { data: AnalyticsData }) {
  const days = combine(data.personal.activity, data.group.activity);
  const half = Math.floor(days.length / 2);
  const previous = days.slice(0, half).reduce((n, d) => n + d.count, 0);
  const current = days.slice(half).reduce((n, d) => n + d.count, 0);
  const delta = current - previous;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendTone = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-[var(--muted)]";

  const tracks = data.group.byTrack.filter((t) => t.total > 0);
  const mocks = data.mockInterviewScores;

  return (
    <section className="space-y-4" aria-label="Trends">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Trends</h2>
        <p className="text-sm text-[var(--muted)]">How your pace is changing.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="This week" subtitle="Questions solved, group and personal" />
          <p className="mt-3 text-4xl font-bold">{current}</p>
          <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${trendTone}`}>
            <TrendIcon className="h-4 w-4" aria-hidden />
            {delta === 0
              ? "Same as last week"
              : `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than last week (${previous})`}
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Last 14 days" subtitle="Questions solved each day" />
          <div className="mt-3 h-44">
            <StudyHoursChart
              data={days.map((d) => ({ label: d.label, value: d.count, date: d.date }))}
              valueSuffix="solved"
              ariaLabel={`Questions solved per day over the last ${days.length} days. This week ${current}, last week ${previous}.`}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {tracks.length > 0 && (
          <Card>
            <CardHeader title="Track progress" subtitle="Your completion on shared questions, by track" />
            <ul className="mt-3 space-y-3">
              {tracks.map((t) => (
                <li key={t.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{t.name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {t.done}/{t.total} · {t.percent}%
                    </span>
                  </div>
                  <ProgressBar value={t.percent} size="sm" />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {mocks.length > 0 && (
          <Card>
            <CardHeader title="Mock scores" subtitle="Your peer-scored mocks over time" />
            <div className="mt-3 h-44">
              <StudyHoursChart
                data={mocks.map((m) => ({ label: formatDate(m.date).slice(0, 6), value: m.score }))}
                valueSuffix="/ 100"
                ariaLabel={`Mock interview scores: ${mocks.map((m) => m.score).join(", ")}.`}
              />
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

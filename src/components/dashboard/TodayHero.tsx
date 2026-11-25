"use client";

import { CalendarClock, Flame, PartyPopper, Waves } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { normalizeQuestionStatus, splitQuestionFields } from "@/lib/utils";
import type { DashboardData } from "@/types";

/**
 * The first thing on the dashboard: how today is going and the one thing to do next.
 * Shows the daily goal ring, the streak, the interview countdown, and a welcome-back note after a break.
 */
export default function TodayHero({ data, firstName }: { data: DashboardData; firstName?: string }) {
  const { goal, solvedToday } = data.daily;
  const pct = Math.min(100, Math.round((solvedToday / Math.max(goal, 1)) * 100));
  const goalMet = solvedToday >= goal;

  const pending = [...data.todayQuestions.group, ...data.todayQuestions.personal].filter((q) => {
    const status = normalizeQuestionStatus(q.status);
    return status !== "done" && status !== "revised";
  });
  const next = pending[0];
  const remaining = Math.max(goal - solvedToday, 0);

  // "3 questions are waiting for you and your group solved 12 while you were away."
  const awayBits: string[] = [];
  if (data.away && data.away.overdue > 0) {
    awayBits.push(`${data.away.overdue} question${data.away.overdue === 1 ? " is" : "s are"} waiting for you`);
  }
  if (data.away && data.away.teamSolved > 0) {
    awayBits.push(`your group solved ${data.away.teamSolved} while you were away`);
  }
  const awayDetail = awayBits.length ? `${awayBits.join(" and ")}. ` : "";

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/12 via-transparent to-transparent" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-center">
            <ProgressRing value={pct} size={96} />
            <p className="mt-1 text-[11px] text-[var(--muted)]" aria-live="polite">
              {solvedToday}/{goal} today
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Today</p>
          <h2 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
            {goalMet
              ? "Daily goal reached"
              : solvedToday > 0
                ? `${remaining} more to hit today's goal`
                : firstName
                  ? `Let's get one done, ${firstName}`
                  : "Let's get one done"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {goalMet
              ? "Anything more today is a bonus. Your streak is safe."
              : next
                ? "Start with the question below and the rest follows."
                : "Nothing is scheduled for today. Add or schedule a question to keep your streak going."}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            {data.studyStreak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-orange-600">
                <Flame className="h-3.5 w-3.5" aria-hidden /> {data.studyStreak}-day streak
              </span>
            )}
            {data.countdown.interviewDate && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1"
                title="The group's interview date, set in Edit Group"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                {data.countdown.isPast
                  ? "Interview date has passed"
                  : data.countdown.days === 0
                    ? "Interview day"
                    : `${data.countdown.days} day${data.countdown.days === 1 ? "" : "s"} to the interview`}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {next ? (
              <Button href="/questions" size="sm">
                <span className="max-w-[18rem] truncate">Continue: {splitQuestionFields(next.content).title}</span>
              </Button>
            ) : (
              <Button href="/questions" size="sm" variant="outline">
                {goalMet ? (
                  <>
                    <PartyPopper className="mr-1.5 h-4 w-4" aria-hidden /> Review questions
                  </>
                ) : (
                  "Add a question"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {data.away && (
        <div className="relative mt-5 flex items-start gap-3 rounded-xl border border-brand/25 bg-brand/10 p-3.5 text-sm">
          <Waves className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p>
            <span className="font-semibold">Welcome back.</span> It&apos;s been {data.away.days} days since you last
            practised. {awayDetail}Pick one and ease back in.
          </p>
        </div>
      )}
    </Card>
  );
}

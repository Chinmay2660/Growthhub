"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { apiGet } from "@/lib/api";
import type { MomentumResponse } from "@/lib/group-momentum";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

function timeAgo(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/**
 * A compact "how is the group doing" strip for the dashboard: the weekly target, who has reached their
 * goal today, and the latest solves. Positive framing only; the full detail lives on the group page.
 */
export default function GroupPulse({ groupId }: { groupId: string }) {
  const [data, setData] = useState<MomentumResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    apiGet<MomentumResponse>(`/api/group-dynamics?groupId=${groupId}`, {
      onCached: (c) => !cancelled && setData(c),
    })
      .then((d) => !cancelled && (setData(d), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (failed && !data) return null;

  const link = (
    <Button href={`/groups/${groupId}`} variant="ghost" size="sm">
      View group
    </Button>
  );

  if (!data) {
    return (
      <Card aria-busy="true" aria-label="Loading group">
        <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </Card>
    );
  }

  const { team, members, feed } = data;
  const pct = team.goal ? Math.min(100, Math.round((team.doneWeek / team.goal) * 100)) : 0;
  const doneToday = members.filter((m) => m.goalMetToday).length;

  return (
    <Card>
      <CardHeader title="Your group" subtitle={data.headline.title} action={link} />
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-4">
          <ProgressRing value={pct} size={88} />
          <div>
            <p className="text-xl font-semibold leading-tight">
              {team.doneWeek}
              <span className="text-sm font-normal text-[var(--muted)]"> of {team.goal}</span>
            </p>
            <p className="text-xs text-[var(--muted)]">weekly target solved</p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--foreground)]">{team.totalDone}</span> solved in total
              {team.totalQuestions > 0 && <> · {team.totalQuestions} questions</>}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--foreground)]">
              {doneToday} of {members.length}
            </span>{" "}
            reached their goal today
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Members and today's progress">
            {members.map((m) => (
              <li key={m.userId}>
                <span
                  title={`${m.name}${m.isSelf ? " (you)" : ""} · today ${m.solvedToday}/${m.dailyGoal}`}
                  className={clsx(
                    "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                    m.goalMetToday
                      ? "bg-emerald-500/20 text-emerald-700 ring-2 ring-emerald-500 dark:text-emerald-300"
                      : "bg-[var(--surface-muted)] text-[var(--muted)]"
                  )}
                >
                  {initials(m.name)}
                  {m.goalMetToday && (
                    <Check className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 p-0.5 text-white" aria-label="Goal reached" />
                  )}
                  <span className="sr-only">
                    {m.name}: {m.solvedToday} of {m.dailyGoal} today
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {feed.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm" aria-label="Recent activity">
          {feed.slice(0, 3).map((f, i) => (
            <li key={`${f.userId}-${f.at}-${i}`} className="flex items-baseline gap-2">
              <p className="min-w-0 flex-1 truncate">
                <span className="font-medium text-[var(--foreground)]">{f.name}</span>{" "}
                <span className="font-normal text-[var(--muted)]">solved</span>{" "}
                <span className="font-normal text-[var(--foreground)]">{f.title}</span>
              </p>
              <time dateTime={f.at} className="shrink-0 text-xs text-[var(--muted)]">
                {timeAgo(f.at, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

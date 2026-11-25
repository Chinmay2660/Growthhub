"use client";

import { AlarmClock } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import QuestionScopeChip from "@/components/questions/QuestionScopeChip";
import { formatDate } from "@/lib/utils";
import type { DashboardData } from "@/types";

/** Questions that were scheduled before today and are still not solved, oldest first. */
export default function OverdueCard({ overdue }: { overdue: DashboardData["overdue"] }) {
  if (overdue.count === 0) return null;
  const more = overdue.count - overdue.items.length;

  return (
    <Card>
      <CardHeader
        title="Overdue"
        subtitle={`${overdue.count} question${overdue.count === 1 ? "" : "s"} scheduled earlier and not solved yet`}
        action={
          <Button href="/questions" variant="ghost" size="sm">
            Open questions
          </Button>
        }
      />
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {overdue.items.map((q) => (
          <li key={q._id} className="flex items-start gap-3 py-2.5 text-sm">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600" aria-hidden>
              <AlarmClock className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{q.title}</p>
              <p className="text-xs text-[var(--muted)]">
                {q.subjectName ? `${q.subjectName} · ` : ""}due {formatDate(q.practiceDate)}
              </p>
            </div>
            <QuestionScopeChip scope={q.scope} />
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-2 text-xs text-[var(--muted)]">and {more} more</p>}
    </Card>
  );
}

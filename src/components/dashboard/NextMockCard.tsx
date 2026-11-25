"use client";

import { CalendarClock } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import type { DashboardData } from "@/types";

/** The next scheduled group mock, or a prompt when none is set. */
export default function NextMockCard({
  nextMock,
  groupId,
}: {
  nextMock: DashboardData["nextMock"];
  groupId: string;
}) {
  return (
    <Card>
      <CardHeader title="Next mock" />
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand" aria-hidden>
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {nextMock ? (
            <>
              <p className="text-sm font-semibold">Round {nextMock.roundNumber}</p>
              <p className="text-xs text-[var(--muted)]">{formatDateTime(nextMock.date)}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">No mock scheduled</p>
              <p className="text-xs text-[var(--muted)]">An admin can set a date for the group.</p>
            </>
          )}
        </div>
      </div>
      <Button href={`/groups/${groupId}/mock-interviews`} variant="outline" size="sm" className="mt-4 w-full">
        Open mock interviews
      </Button>
    </Card>
  );
}

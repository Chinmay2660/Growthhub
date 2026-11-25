"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import StudyHoursChart from "@/components/analytics/d3/StudyHoursChart";
import GroupLeaderboardChart from "@/components/groups/GroupLeaderboardChart";
import type { GroupGamification } from "@/types";

export default function GroupGamificationPanel({
  gamification,
}: {
  gamification: GroupGamification;
}) {
  const board = gamification.leaderboard;
  const totalSolved = board.reduce((n, m) => n + m.totalPoints, 0);
  const bank = board[0] ? board[0].totalPoints + board[0].pending : 0;
  const possible = bank * board.length;
  const overallPct = possible > 0 ? Math.round((totalSolved / possible) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card padding="sm">
        <CardHeader title="Leaderboard" subtitle="Group questions solved" />
        {board.length > 0 && (
          <dl className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-muted)] p-3 text-center">
            <div>
              <dt className="text-xs text-[var(--muted)]">Group total</dt>
              <dd className="text-lg font-semibold tabular-nums">{totalSolved}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Of possible</dt>
              <dd className="text-lg font-semibold tabular-nums">{possible}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Complete</dt>
              <dd className="text-lg font-semibold tabular-nums">{overallPct}%</dd>
            </div>
          </dl>
        )}
        <GroupLeaderboardChart members={board} />
      </Card>

      <Card padding="sm">
        <CardHeader title="Solved this week" subtitle="Group questions solved per day" />
        <div className="h-52">
          <StudyHoursChart
            data={gamification.dailyPoints.map((d) => ({
              label: d.label,
              value: d.points,
              date: d.date,
            }))}
            color="var(--accent)"
            valueSuffix="solved"
          />
        </div>
      </Card>
    </div>
  );
}

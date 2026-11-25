"use client";

import type { MemberGamificationStat } from "@/types";

/**
 * Each bar shows how much of the group's question bank that person has solved, so bars are comparable
 * with each other and with 100%, not just with whoever is ahead. The rank number is deliberately plain.
 */
export default function GroupLeaderboardChart({ members }: { members: MemberGamificationStat[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No questions solved yet. Complete group questions to climb the board.</p>;
  }

  // Everyone has the same set of questions, so solved + not-yet-solved is the size of the bank.
  const bank = members[0].totalPoints + members[0].pending;

  return (
    <ol className="space-y-4">
      {members.map((member, index) => {
        const pct = bank > 0 ? Math.round((member.totalPoints / bank) * 100) : 0;
        return (
          <li key={member.userId}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-[var(--muted)]">
                  {index + 1}
                </span>
                <span className="truncate font-medium">{member.name}</span>
              </div>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-brand">{member.totalPoints}</span>
                <span className="text-[var(--muted)]"> of {bank}</span>
                <span className="ml-2 text-xs text-[var(--muted)]">{pct}%</span>
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={bank}
              aria-valuenow={member.totalPoints}
              aria-label={`${member.name}: ${member.totalPoints} of ${bank} questions solved`}
            >
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

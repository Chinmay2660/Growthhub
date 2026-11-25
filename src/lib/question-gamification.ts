import { addIstDays, istDateKey, normalizeQuestionStatus } from "@/lib/utils";
import type { QuestionStatus } from "@/types";

/**
 * Scoring is by questions solved: every solved question is worth the same, regardless of which
 * day it was solved relative to its due date. A member's points equal their solved count.
 */
export const POINTS_PER_SOLVED_QUESTION = 1;

export type QuestionGamificationInput = {
  _id: string;
  practiceDate?: Date | string;
  createdAt?: Date | string;
  status: QuestionStatus | string;
  lastPracticed?: Date | string | null;
  firstCompletedAt?: Date | string | null;
  /** Legacy: older rows stored a timing-based value here. It now only marks "was solved once". */
  pointsAwarded?: number | null;
};

/**
 * A question counts as solved when it is done/revised, or was solved before (a stored award
 * survives a later status change, so un-marking and re-marking can't be farmed for points).
 */
export function isQuestionSolved(q: {
  status: QuestionStatus | string;
  pointsAwarded?: number | null;
}): boolean {
  if (q.pointsAwarded != null) return true;
  const status = normalizeQuestionStatus(q.status);
  return status === "done" || status === "revised";
}

/** Award once, on the first transition to done (or revised); re-marking never re-scores. */
export function applyFirstDonePoints(
  _prevStatus: string,
  nextStatus: string,
  _practiceDate: Date | string,
  existing?: { pointsAwarded?: number | null; firstCompletedAt?: Date | string | null }
): { pointsAwarded?: number; firstCompletedAt?: Date; pointsEarnedNow?: number } {
  // Already solved before (including legacy rows that stored a timing-based value): no new point.
  if (existing?.pointsAwarded != null) {
    return {
      pointsAwarded: existing.pointsAwarded,
      firstCompletedAt: existing.firstCompletedAt ? new Date(existing.firstCompletedAt) : undefined,
    };
  }

  const next = normalizeQuestionStatus(nextStatus);
  // "revised" is a completed question too, so it earns the same one-time point as "done".
  if (next !== "done" && next !== "revised") return {};

  const completedAt = new Date();
  return {
    pointsAwarded: POINTS_PER_SOLVED_QUESTION,
    firstCompletedAt: existing?.firstCompletedAt ? new Date(existing.firstCompletedAt) : completedAt,
    pointsEarnedNow: POINTS_PER_SOLVED_QUESTION,
  };
}

export type MemberGamificationStat = {
  userId: string;
  name: string;
  /** Questions solved (1 point each). */
  totalPoints: number;
  /** Questions not solved yet. */
  pending: number;
  /** Questions solved per day over the recent window. */
  dailyPoints: { date: string; points: number }[];
};

export type GroupGamification = {
  leaderboard: MemberGamificationStat[];
  dailyPoints: { date: string; label: string; points: number }[];
};

export function buildMemberGamification(
  userId: string,
  name: string,
  questions: QuestionGamificationInput[],
  days = 7,
  now = new Date()
): MemberGamificationStat {
  let solved = 0;
  let pending = 0;
  const dailyMap = new Map<string, number>();

  for (let i = days - 1; i >= 0; i--) {
    dailyMap.set(istDateKey(addIstDays(now, -i)), 0);
  }

  for (const q of questions) {
    if (!isQuestionSolved(q)) {
      pending++;
      continue;
    }
    solved++;
    // The day a question was first solved, used only for the per-day chart.
    const solvedAt = q.firstCompletedAt ?? q.lastPracticed;
    if (solvedAt) {
      const key = istDateKey(new Date(solvedAt));
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + POINTS_PER_SOLVED_QUESTION);
    }
  }

  return {
    userId,
    name,
    totalPoints: solved * POINTS_PER_SOLVED_QUESTION,
    pending,
    dailyPoints: Array.from(dailyMap.entries()).map(([date, points]) => ({ date, points })),
  };
}

export function buildGroupGamification(
  members: MemberGamificationStat[],
  days = 7,
  now = new Date()
): GroupGamification {
  const dailyMap = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    dailyMap.set(istDateKey(addIstDays(now, -i)), 0);
  }

  for (const member of members) {
    for (const day of member.dailyPoints) {
      if (dailyMap.has(day.date)) {
        dailyMap.set(day.date, (dailyMap.get(day.date) ?? 0) + day.points);
      }
    }
  }

  const dailyPoints = Array.from(dailyMap.entries()).map(([date, points]) => ({
    date,
    label: new Date(`${date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
      weekday: "short",
      timeZone: "Asia/Kolkata",
    }),
    points,
  }));

  // Most questions solved first; ties keep a stable alphabetical order.
  const leaderboard = [...members].sort(
    (a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name)
  );

  return { leaderboard, dailyPoints };
}

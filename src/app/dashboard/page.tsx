"use client";

import { useDocumentTitle } from "@/lib/use-document-title";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, getErrorMessage } from "@/lib/api";
import { normalizeQuestionStatus } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import InspirationCard from "@/components/dashboard/InspirationCard";
import dynamic from "next/dynamic";

const NotesInbox = dynamic(() => import("@/components/groups/NotesInbox"), { ssr: false });
import TodayPlanCard from "@/components/dashboard/TodayPlanCard";
import TodayHero from "@/components/dashboard/TodayHero";
import RealityCheck from "@/components/dashboard/RealityCheck";
import OverdueCard from "@/components/dashboard/OverdueCard";
import GroupPulse from "@/components/dashboard/GroupPulse";
import NextMockCard from "@/components/dashboard/NextMockCard";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { DashboardSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import type { DashboardData, QuestionStatus } from "@/types";

export default function DashboardPage() {
  const { user, refreshUser } = useUser();
  useDocumentTitle("Dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pointBurst, setPointBurst] = useState<QuestionPointBurst | null>(null);

  const activeGroupId = user?.activeGroupId;

  const load = useCallback(async (silent = false) => {
    if (!user?._id) return;
    if (!activeGroupId) {
      setInitialLoad(false);
      setRefreshing(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setInitialLoad(true);
    try {
      const d = await apiGet<DashboardData>("/api/dashboard", {
        onCached: (c) => {
          setData(c);
          setInitialLoad(false);
        },
      });
      setData(d);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      if (message === "No active group") {
        await refreshUser();
        setData(null);
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, [user?._id, activeGroupId, refreshUser]);

  useEffect(() => { load(); }, [load]);

  const updateQuestionStatus = async (id: string, status: QuestionStatus) => {
    const normalized = normalizeQuestionStatus(status);
    if (!data) return;
    const current =
      data.todayQuestions.group.find((q) => String(q._id) === String(id)) ??
      data.todayQuestions.personal.find((q) => String(q._id) === String(id));
    if (!current) return;
    const previousStatus = normalizeQuestionStatus(current.status ?? "not_started");

    const updateList = (list: typeof data.todayQuestions.group) =>
      list.map((q) => (String(q._id) === String(id) ? { ...q, status: normalized } : q));
    setData({
      ...data,
      todayQuestions: {
        group: updateList(data.todayQuestions.group),
        personal: updateList(data.todayQuestions.personal),
      },
    });

    try {
      const updated = await apiPatch<{ status?: QuestionStatus; pointsEarnedNow?: number }>(
        `/api/practice-questions/${id}`,
        { status: normalized }
      );
      const savedStatus = normalizeQuestionStatus(updated.status ?? normalized);
      setData((prev) => {
        if (!prev) return prev;
        const updateList = (list: typeof prev.todayQuestions.group) =>
          list.map((q) => (String(q._id) === String(id) ? { ...q, status: savedStatus } : q));
        return {
          ...prev,
          todayQuestions: {
            group: updateList(prev.todayQuestions.group),
            personal: updateList(prev.todayQuestions.personal),
          },
        };
      });
      triggerQuestionPointsBurst(setPointBurst, id, updated.pointsEarnedNow);
      // The goal ring and streak come from the server, so refresh them quietly after a solve.
      if (updated.pointsEarnedNow) void load(true);
    } catch (err) {
      setData((prev) => {
        if (!prev) return prev;
        const updateList = (list: typeof prev.todayQuestions.group) =>
          list.map((q) => (String(q._id) === String(id) ? { ...q, status: previousStatus } : q));
        return {
          ...prev,
          todayQuestions: {
            group: updateList(prev.todayQuestions.group),
            personal: updateList(prev.todayQuestions.personal),
          },
        };
      });
      toast.error(getErrorMessage(err, "Failed to update question"));
    }
  };

  if (initialLoad && user?.activeGroupId) return <DashboardSkeleton />;
  if (user && !user.activeGroupId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${user.name?.split(" ")[0]}`}
          description="Join or create a group to unlock your dashboard."
        />
        <EmptyState
          title="No active group"
          description="Create a prep group or join one with an invite code to track progress together."
          action={
            <Button href="/groups">Browse Groups</Button>
          }
        />
      </div>
    );
  }
  if (error && !data) return <ErrorState message={error} onRetry={() => load()} />;
  if (!data) return null;

  return (
    <div className={refreshing ? "space-y-6 opacity-80 transition-opacity" : "space-y-6"}>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0]}`}
        description="Your day at a glance."
      />

      <TodayHero data={data} firstName={user?.name?.split(" ")[0]} />

      <RealityCheck
        targetCtcLpa={user?.targetCtcLpa}
        targetCompany={user?.targetCompany}
        targetRole={user?.targetRole}
      />

      <OverdueCard overdue={data.overdue} />

      <TodayPlanCard
        todayQuestions={data.todayQuestions}
        onStatusChange={updateQuestionStatus}
        pointBurst={pointBurst}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GroupPulse groupId={user!.activeGroupId!} />
        </div>
        <NextMockCard nextMock={data.nextMock} groupId={user!.activeGroupId!} />
      </div>

      <NotesInbox groupId={user!.activeGroupId!} compact />

      <InspirationCard
        studyStreak={data.studyStreak}
        daysToInterview={data.countdown.days}
        targetCtcLpa={user?.targetCtcLpa}
      />
    </div>
  );
}

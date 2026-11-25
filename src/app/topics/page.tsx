"use client";

import { useDocumentTitle } from "@/lib/use-document-title";
import { useEffect, useState, useCallback, Suspense } from "react";
import { Input } from "@/components/ui/Input";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import FormField from "@/components/ui/FormField";
import { ConfidenceBadge, PriorityBadge } from "@/components/ui/Badge";
import { TopicsPageSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import { TOPIC_STATUS_META, normalizeTopicStatus } from "@/lib/utils";
import toast from "react-hot-toast";
import type { ContentScope, Subject, TopicWithProgress } from "@/types";

function TopicsContent() {
  const { user } = useUser();
  useDocumentTitle("Topics");
  const searchParams = useSearchParams();
  const subjectFilter = searchParams.get("subjectId");
  const [tab, setTab] = useState<ContentScope>("group");
  const [topics, setTopics] = useState<TopicWithProgress[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");

  const load = useCallback(async () => {
    if (!user?.activeGroupId && tab === "group") {
      setLoading(false);
      setTopics([]);
      setSubjects([]);
      return;
    }
    setLoading(true);
    try {
      const subjectUrl =
        tab === "group"
          ? `/api/subjects?groupId=${user!.activeGroupId}&scope=group`
          : `/api/subjects?scope=personal`;
      let topicUrl = `/api/topics?groupId=${user!.activeGroupId}&scope=${tab}`;
      if (subjectFilter) topicUrl += `&subjectId=${subjectFilter}`;

      const [topicData, subjectData] = await Promise.all([
        apiGet<TopicWithProgress[]>(topicUrl, {
          onCached: (c) => {
            setTopics(c);
            setLoading(false);
          },
        }),
        apiGet<Subject[]>(subjectUrl, { onCached: setSubjects }),
      ]);
      setTopics(topicData);
      setSubjects(subjectData);
      setError("");
      const defaultSubject = subjectFilter || subjectData[0]?._id || "";
      setNewSubjectId((prev) => {
        if (prev && subjectData.some((s) => s._id === prev)) return prev;
        return defaultSubject;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }, [user, subjectFilter, tab]);

  useEffect(() => { load(); }, [load]);

  const createTopic = async () => {
    if (!newName.trim() || !newSubjectId || !user?.activeGroupId) return;
    try {
      await apiPost("/api/topics", {
        groupId: user.activeGroupId,
        subjectId: newSubjectId,
        name: newName,
      });
      toast.success("Topic created");
      setShowModal(false);
      setNewName("");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create topic"));
    }
  };

  const updateTopic = async (topicId: string, updates: Record<string, string>) => {
    try {
      await apiPatch(`/api/topics/${topicId}`, updates);
      toast.success("Topic updated");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update topic"));
    }
  };

  if (loading && topics.length === 0 && subjects.length === 0) return <TopicsPageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const grouped = topics.reduce<Record<string, TopicWithProgress[]>>((acc, t) => {
    const key = t.subjectName ?? "Other";
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Topics</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {tab === "group"
              ? "Shared topics under group tracks — used when adding group questions."
              : "Your private topics under personal tracks."}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} disabled={subjects.length === 0}>
          Add Topic
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["group", "personal"] as ContentScope[]).map((scope) => (
          <Chip
            key={scope}
            variant="brand"
            active={tab === scope}
            onClick={() => setTab(scope)}
            className="!px-4 !py-1.5 !text-sm"
          >
            {scope === "group" ? "Group Topics" : "My Topics"}
          </Chip>
        ))}
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title={tab === "group" ? "Add a group track first" : "Add a personal track first"}
          description="Create tracks before adding topics."
        />
      ) : topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          description="Add topics under each track, then pick them when logging questions."
          action={<Button onClick={() => setShowModal(true)}>Add Topic</Button>}
        />
      ) : (
        Object.entries(grouped).map(([subject, subjectTopics]) => (
          <div key={subject}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{subject}</h2>
            <div className="space-y-2">
              {subjectTopics.map((t) => {
                const status = normalizeTopicStatus(t.userStatus ?? t.status);
                const confidence = t.userConfidence ?? t.confidence;
                const meta = TOPIC_STATUS_META[status] ?? TOPIC_STATUS_META.not_started;
                return (
                  <Card key={t._id} padding="sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--foreground)]">{t.name}</span>
                          <PriorityBadge priority={t.priority} />
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                          <ConfidenceBadge confidence={confidence} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={status}
                          onChange={(v) => updateTopic(t._id, { status: v })}
                          aria-label="Topic status"
                          className="w-36"
                          options={Object.entries(TOPIC_STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))}
                        />
                        <Select
                          value={confidence}
                          onChange={(v) => updateTopic(t._id, { confidence: v })}
                          aria-label="Confidence"
                          className="w-28"
                          options={[
                            { value: "weak", label: "Weak" },
                            { value: "okay", label: "Okay" },
                            { value: "strong", label: "Strong" },
                          ]}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Topic">
        <div className="space-y-4">
          <FormField label="Track">
            <Select
              value={newSubjectId}
              onChange={setNewSubjectId}
              options={subjects.map((s) => ({ value: s._id, label: s.name }))}
            />
          </FormField>
          <FormField label="Topic name">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Topic name"
            />
          </FormField>
          <ModalFooter onCancel={() => setShowModal(false)}>
            <Button onClick={createTopic} disabled={!newName.trim() || !newSubjectId}>
              Add topic
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

export default function TopicsPage() {
  return (
    <Suspense fallback={<TopicsPageSkeleton />}>
      <TopicsContent />
    </Suspense>
  );
}

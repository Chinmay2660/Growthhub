"use client";

import { useRevalidate, markQuiet, takeQuiet } from "@/lib/use-revalidate";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useEffect, useState, useCallback, useMemo, useId } from "react";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPost, apiPatch, apiDelete, getErrorMessage } from "@/lib/api";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import MultiSelect from "@/components/ui/MultiSelect";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import QuestionFormModal from "@/components/questions/QuestionFormModal";
import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import MotivationBanner from "@/components/dashboard/MotivationBanner";
import {
  QuestionsPageSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/ui/StateViews";
import QuestionListView, { type QuestionListItem } from "@/components/questions/QuestionListView";
import {
  formatSubjectTrack,
  joinQuestionFields,
  splitQuestionFields,
  questionPracticeDay,
  normalizeQuestionStatus,
  DEFAULT_QUESTION_TABLE_SORT,
  toggleQuestionSort,
  type QuestionDatePeriod,
  type QuestionSortField,
  type QuestionSortDir,
} from "@/lib/utils";
import TablePagination from "@/components/ui/TablePagination";
import QuestionTableSearch from "@/components/questions/QuestionTableSearch";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import toast from "react-hot-toast";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import { canManageGroup } from "@/lib/group-roles";
import { SlidersHorizontal, X } from "lucide-react";
import { QUESTION_STATUS_ORDER, QUESTION_STATUS_META } from "@/lib/utils";
import type { ContentScope, GroupRole, PracticeQuestion, QuestionStatus, Subject } from "@/types";

type QuestionWithSubject = PracticeQuestion & { subjectName: string; trackLabel: string };

type PagedQuestions = {
  items: QuestionWithSubject[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 10;
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span id={labelId} className="w-20 shrink-0 text-sm font-medium text-[var(--muted)]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default function QuestionsPage() {
  const { user } = useUser();
  useDocumentTitle("Questions");
  const [questions, setQuestions] = useState<QuestionWithSubject[]>([]);
  const [pointBurst, setPointBurst] = useState<QuestionPointBurst | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const datePeriod: QuestionDatePeriod = "all"; // everything, newest first; narrow it with the date range in Filters
  const [sortBy, setSortBy] = useState<QuestionSortField>(DEFAULT_QUESTION_TABLE_SORT.sortBy);
  const [sortDir, setSortDir] = useState<QuestionSortDir>(DEFAULT_QUESTION_TABLE_SORT.sortDir);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionDescription, setQuestionDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [link, setLink] = useState("");
  const [practiceDate, setPracticeDate] = useState("");
  const [scope, setScope] = useState<ContentScope>("group");
  // The page is two tabs: shared questions from your groups, and your own personal ones.
  const [tab, setTab] = useState<ContentScope>("group");
  const [groups, setGroups] = useState<{ _id: string; name: string; myRole: GroupRole | null }[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [modalGroupId, setModalGroupId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<QuestionStatus[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const activeFilterCount =
    (statusFilter.length ? 1 : 0) +
    (subjectFilter.length ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);
  const [draft, setDraft] = useState<{
    status: QuestionStatus[];
    subject: string[];
    from: string;
    to: string;
  }>({ status: [], subject: [], from: "", to: "" });
  const openFilters = () => {
    setDraft({ status: statusFilter, subject: subjectFilter, from: dateFrom, to: dateTo });
    setShowFilters(true);
  };
  const applyFilters = () => {
    setStatusFilter(draft.status);
    setSubjectFilter(draft.subject);
    setDateFrom(draft.from);
    setDateTo(draft.to);
    setPage(1);
    setShowFilters(false);
  };
  const clearFilters = () => {
    setStatusFilter([]);
    setSubjectFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [groupsLoaded, setGroupsLoaded] = useState(false);

  const manageGroups = useMemo(() => groups.filter((g) => canManageGroup(g.myRole)), [groups]);
  const canAddGroupQuestions = manageGroups.length > 0;

  // Tracks the form can offer: for a shared question, those of the group it is going to; otherwise personal ones.
  const groupSubjects = useMemo(
    () => subjects.filter((s) => s.scope === "group" && (!modalGroupId || s.groupId === modalGroupId)),
    [subjects, modalGroupId]
  );
  const personalSubjects = useMemo(() => subjects.filter((s) => s.scope === "personal"), [subjects]);
  const modalSubjects = scope === "group" ? groupSubjects : personalSubjects;
  const trackOptions = editingId
    ? subjects.filter((s) => s.scope === scope && (scope === "personal" || s.groupId === modalGroupId))
    : modalSubjects;

  /** Which group a new shared question defaults to: the one being viewed, else your current group, else any you manage. */
  const defaultGroupId = useCallback(() => {
    if (groupFilter !== "all" && manageGroups.some((g) => g._id === groupFilter)) return groupFilter;
    return (manageGroups.find((g) => g._id === user?.activeGroupId) ?? manageGroups[0])?._id ?? "";
  }, [groupFilter, manageGroups, user?.activeGroupId]);

  // Your groups and every track (shared tracks of all your groups, plus your personal ones). Rarely changes.
  const loadMeta = useCallback(async () => {
    try {
      const list = await apiGet<{ _id: string; name: string; myRole: GroupRole | null }[]>("/api/groups", {
        onCached: (c) => setGroups(c.map((g) => ({ _id: g._id, name: g.name, myRole: g.myRole }))),
      });
      setGroups(list.map((g) => ({ _id: g._id, name: g.name, myRole: g.myRole })));
      const lists = await Promise.all(
        list.length
          ? list.map((g) => apiGet<Subject[]>(`/api/subjects?groupId=${g._id}&minimal=1`))
          : [apiGet<Subject[]>("/api/subjects?scope=personal&minimal=1")]
      );
      const unique = new Map<string, Subject>();
      lists.flat().forEach((sub) => unique.set(sub._id, sub));
      setSubjects(Array.from(unique.values()));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setGroupsLoaded(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!takeQuiet()) setLoading(true);
    try {
      const searchQ = debouncedSearch.trim()
        ? `&search=${encodeURIComponent(debouncedSearch.trim())}`
        : "";
      const groupQ = tab === "group" ? `&groupId=${groupFilter}` : "";
      const questionUrl = `/api/practice-questions?scope=${tab}${groupQ}${statusFilter.length ? `&status=${statusFilter.join(",")}` : ""}${subjectFilter.length ? `&subjectId=${subjectFilter.join(",")}` : ""}${dateFrom ? `&dateFrom=${dateFrom}` : ""}${dateTo ? `&dateTo=${dateTo}` : ""}&page=${page}&limit=${PAGE_SIZE}&period=${datePeriod}&sortBy=${sortBy}&sortDir=${sortDir}${searchQ}`;
      const questionData = await apiGet<PagedQuestions>(questionUrl, {
        onCached: (c) => {
          setQuestions(c.items);
          setTotal(c.total);
          setInitialLoad(false);
        },
      });
      setQuestions(questionData.items);
      setTotal(questionData.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [tab, groupFilter, page, datePeriod, sortBy, sortDir, debouncedSearch, statusFilter, subjectFilter, dateFrom, dateTo]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(); }, [load]);
  useRevalidate(() => {
    markQuiet();
    void load();
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // A group you are no longer in can't stay selected as the filter.
  useEffect(() => {
    if (groupFilter !== "all" && groupsLoaded && !groups.some((g) => g._id === groupFilter)) setGroupFilter("all");
  }, [groups, groupFilter, groupsLoaded]);

  useEffect(() => {
    if (!modalGroupId && manageGroups.length > 0) setModalGroupId(defaultGroupId());
  }, [modalGroupId, manageGroups, defaultGroupId]);

  useEffect(() => {
    const available = scope === "group" ? groupSubjects : personalSubjects;
    if (available.length > 0 && !available.some((s) => s._id === subjectId)) {
      setSubjectId(available[0]._id);
    }
  }, [scope, groupSubjects, personalSubjects, subjectId]);

  useEffect(() => {
    if (groupsLoaded && !canAddGroupQuestions && scope === "group") {
      setScope("personal");
    }
  }, [groupsLoaded, canAddGroupQuestions, scope]);

  const handleSort = (field: QuestionSortField) => {
    const next = toggleQuestionSort(field, sortBy, sortDir);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
    setPage(1);
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionTitle("");
    setQuestionDescription("");
    setLink("");
    setPracticeDate("");
    // A new question goes to the tab you are on (a personal one if you can't add shared questions).
    const nextScope: ContentScope = tab === "group" && canAddGroupQuestions ? "group" : "personal";
    const gid = defaultGroupId();
    setScope(nextScope);
    setModalGroupId(gid);
    setSubjectId(
      (nextScope === "group"
        ? subjects.find((s) => s.scope === "group" && s.groupId === gid)
        : subjects.find((s) => s.scope === "personal"))?._id ?? ""
    );
  };

  const openCreateModal = () => {
    resetForm();
    if (tab === "group" && !canAddGroupQuestions) setTab("personal");
    setShowModal(true);
  };

  const openEditModal = (q: QuestionListItem) => {
    const full = questions.find((item) => item._id === q._id);
    if (!full) return;
    setEditingId(full._id);
    const parts = splitQuestionFields(full.content);
    setQuestionTitle(parts.title);
    setQuestionDescription(parts.description);
    setLink(full.link ?? "");
    setPracticeDate(questionPracticeDay(full));
    setScope(full.scope);
    setModalGroupId(full.scope === "group" ? String(full.groupId ?? "") : defaultGroupId());
    setSubjectId(full.subjectId);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const saveQuestion = async () => {
    // Shared questions go to the chosen group. Personal ones still need a group on record, so use the current one.
    const targetGroupId = scope === "group" ? modalGroupId : (user?.activeGroupId ?? groups[0]?._id ?? "");
    if (!questionTitle.trim() || !subjectId || !targetGroupId) return;
    const payload = {
      title: questionTitle.trim(),
      description: questionDescription.trim(),
      link: link.trim() || undefined,
      subjectId,
      practiceDate: practiceDate.trim() ? practiceDate : null,
    };
    const mergedContent = joinQuestionFields(payload.title, payload.description);
    setSaving(true);
    try {
      if (editingId) {
        const updated = await apiPatch<QuestionWithSubject>(`/api/practice-questions/${editingId}`, payload);
        const subject = subjects.find((s) => s._id === subjectId);
        setQuestions((prev) =>
          prev.map((q) =>
            q._id === editingId
              ? {
                  ...q,
                  ...updated,
                  content: mergedContent,
                  link: payload.link,
                  subjectId,
                  practiceDate: practiceDate.trim() || undefined,
                  subjectName: subject?.name ?? q.subjectName,
                  trackLabel: subject ? formatSubjectTrack(subject) : q.trackLabel,
                }
              : q
          )
        );
        toast.success("Question updated");
      } else {
        await apiPost("/api/practice-questions", {
          groupId: targetGroupId,
          scope,
          ...payload,
        });
        toast.success("Question added");
        if (page !== 1) setPage(1);
        else load();
      }
      closeModal();
    } catch (err) {
      toast.error(getErrorMessage(err, editingId ? "Failed to update question" : "Failed to add question"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: QuestionStatus) => {
    const normalized = normalizeQuestionStatus(status);
    const current = questions.find((q) => String(q._id) === String(id));
    if (!current) return;
    const previousStatus = normalizeQuestionStatus(current.status ?? "not_started");

    setQuestions((prev) =>
      prev.map((q) => (String(q._id) === String(id) ? { ...q, status: normalized } : q))
    );

    try {
      const updated = await apiPatch<QuestionWithSubject & { pointsEarnedNow?: number }>(
        `/api/practice-questions/${id}`,
        { status: normalized }
      );
      setQuestions((prev) =>
        prev.map((q) =>
          String(q._id) === String(id)
            ? {
                ...q,
                status: normalizeQuestionStatus(updated.status ?? normalized),
              }
            : q
        )
      );
      triggerQuestionPointsBurst(setPointBurst, id, updated.pointsEarnedNow);
    } catch (err) {
      setQuestions((prev) =>
        prev.map((q) => (String(q._id) === String(id) ? { ...q, status: previousStatus } : q))
      );
      toast.error(getErrorMessage(err, "Failed to update question"));
    }
  };

  const deleteQuestion = async (id: string) => {
    setLoading(true);
    try {
      await apiDelete(`/api/practice-questions/${id}`);
      toast.success("Question deleted");
      const remainingOnPage = questions.length - 1;
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (remainingOnPage === 0 && page > 1 && page > newTotalPages) {
        setPage(newTotalPages);
      } else {
        load();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete question"));
      setLoading(false);
    }
  };

  if (groupsLoaded && groups.length === 0) {
    return (
      <EmptyState
        title="No group yet"
        description="Join or create a group to start tracking practice questions."
        action={
          <Button href="/groups">Browse Groups</Button>
        }
      />
    );
  }

  if (initialLoad && loading) {
    return <QuestionsPageSkeleton />;
  }
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void loadMeta();
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Questions</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {total} question{total === 1 ? "" : "s"} — track daily practice progress
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal}>
          Add Question
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["group", "personal"] as ContentScope[]).map((t) => (
            <Chip
              key={t}
              variant="brand"
              active={tab === t}
              onClick={() => {
                setTab(t);
                setPage(1);
                setSubjectFilter([]); // tracks differ between the two tabs
              }}
              className="!px-4 !py-1.5 !text-sm"
            >
              {t === "group" ? "Group" : "Personal"}
            </Chip>
          ))}
          {/* Only offered when there is something to choose between. */}
          {tab === "group" && groups.length > 1 && (
            <Select
              className="w-56"
              value={groupFilter}
              onChange={(g) => {
                setGroupFilter(g);
                setPage(1);
                setSubjectFilter([]);
              }}
              aria-label="Show questions from"
              options={[{ value: "all", label: "All groups" }, ...groups.map((g) => ({ value: g._id, label: g.name }))]}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
        <QuestionTableSearch
          value={searchInput}
          onChange={setSearchInput}
          className="max-w-md flex-1"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openFilters}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" aria-hidden /> Clear
            </Button>
          )}
        </div>
        </div>
      </div>

      {questions.length === 0 && !loading ? (
        <EmptyState
          title={
            debouncedSearch.trim()
              ? "No questions match your search"
              : datePeriod !== "all"
                ? "No matching questions"
                : "No questions yet"
          }
          description={
            debouncedSearch.trim()
              ? "Try a different title or track name."
              : datePeriod !== "all"
                ? "Try another period or add a question."
                : "Add practice questions to track your preparation."
          }
          action={
            debouncedSearch.trim() ? (
              <Button variant="outline" onClick={() => setSearchInput("")}>Clear search</Button>
            ) : (
              <Button onClick={openCreateModal}>Add Question</Button>
            )
          }
        />
      ) : (
        <>
          <QuestionListView
            questions={questions}
            onStatusChange={updateStatus}
            pointBurst={pointBurst}
            onEdit={openEditModal}
            onDelete={deleteQuestion}
            showGroup={tab === "group" && groups.length > 1}
            showActions
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            loading={loading}
            localSearch={searchInput}
          />

          <TablePagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            loading={loading}
            onPageChange={setPage}
          />
        </>
      )}

      <MotivationBanner />

      <Modal open={showFilters} onClose={() => setShowFilters(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <FilterRow label="Status">
            <MultiSelect
              placeholder="All statuses"
              options={QUESTION_STATUS_ORDER.map((st) => ({ value: st, label: QUESTION_STATUS_META[st].label }))}
              value={draft.status}
              onChange={(next) => setDraft((d) => ({ ...d, status: next as QuestionStatus[] }))}
            />
          </FilterRow>
          <FilterRow label="Track">
            <MultiSelect
              placeholder="All tracks"
              options={subjects
                .filter((sb) => sb.scope === tab && (tab === "personal" || groupFilter === "all" || sb.groupId === groupFilter))
                .map((sb) => ({ value: sb._id, label: sb.name }))}
              value={draft.subject}
              onChange={(next) => setDraft((d) => ({ ...d, subject: next }))}
            />
          </FilterRow>
          <FilterRow label="Date">
            <div className="grid w-full grid-cols-2 gap-2">
              <div className="text-xs text-[var(--muted)]">
                From
                <DatePicker
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
                  aria-label="From date"
                  clearable
                  className="mt-0.5 text-sm"
                />
              </div>
              <div className="text-xs text-[var(--muted)]">
                To
                <DatePicker
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
                  aria-label="To date"
                  clearable
                  className="mt-0.5 text-sm"
                />
              </div>
            </div>
          </FilterRow>
          <ModalFooter
            className="!mt-4"
            onCancel={() => setShowFilters(false)}
            start={
              <Button
                variant="outline"
                onClick={() => setDraft({ status: [], subject: [], from: "", to: "" })}
              >
                Reset
              </Button>
            }
          >
            <Button onClick={applyFilters}>Apply</Button>
          </ModalFooter>
        </div>
      </Modal>

      <QuestionFormModal
        open={showModal}
        onClose={closeModal}
        editing={Boolean(editingId)}
        values={{
          title: questionTitle,
          description: questionDescription,
          link,
          subjectId,
          practiceDate,
          scope,
        }}
        onChange={(patch) => {
          if (patch.title !== undefined) setQuestionTitle(patch.title);
          if (patch.description !== undefined) setQuestionDescription(patch.description);
          if (patch.link !== undefined) setLink(patch.link);
          if (patch.subjectId !== undefined) setSubjectId(patch.subjectId);
          if (patch.practiceDate !== undefined) setPracticeDate(patch.practiceDate);
          if (patch.scope !== undefined) setScope(patch.scope);
        }}
        tracks={trackOptions}
        canChooseScope={!editingId && canAddGroupQuestions}
        scopeHint={!editingId && !canAddGroupQuestions ? "Group questions require admin or co-admin." : undefined}
        saving={saving}
        onSave={saveQuestion}
        groupOptions={manageGroups.map((g) => ({ value: g._id, label: g.name }))}
        groupId={modalGroupId}
        onGroupChange={(g) => {
          setModalGroupId(g);
          setSubjectId(""); // tracks belong to a group: pick again from that group's tracks
        }}
        onCreateTrack={async (name) => {
          try {
            await apiPost("/api/subjects", {
              ...(scope === "group" ? { groupId: modalGroupId } : {}),
              name,
              scope,
            });
            toast.success("Track created");
            await loadMeta();
          } catch (err) {
            toast.error(getErrorMessage(err, "Couldn't create the track"));
          }
        }}
      />
    </div>
  );
}

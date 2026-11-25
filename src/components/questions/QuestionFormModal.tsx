"use client";

import Link from "next/link";
import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { Input, Textarea } from "@/components/ui/Input";
import { useState } from "react";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import { formatSubjectTrack } from "@/lib/utils";
import type { ContentScope } from "@/types";

export type QuestionFormValues = {
  title: string;
  description: string;
  link: string;
  subjectId: string;
  practiceDate: string;
  scope: ContentScope;
};

type TrackLike = { _id: string } & Parameters<typeof formatSubjectTrack>[0];

const SCOPE_LABEL: Record<ContentScope, string> = {
  group: "Group — shared with everyone",
  personal: "Personal — only you",
};

/**
 * The one add/edit-question form. The Questions tab and the group page both use it, so the fields,
 * their order, labels, buttons and validation are identical everywhere.
 */
export default function QuestionFormModal({
  open,
  onClose,
  editing,
  values,
  onChange,
  tracks,
  canChooseScope,
  scopeHint,
  saving,
  onSave,
  onCreateTrack,
  groupOptions,
  groupId,
  onGroupChange,
}: {
  open: boolean;
  onClose: () => void;
  editing: boolean;
  values: QuestionFormValues;
  onChange: (patch: Partial<QuestionFormValues>) => void;
  tracks: TrackLike[];
  /** Show the Visibility picker (create only, and only when group questions are allowed). */
  canChooseScope: boolean;
  scopeHint?: string;
  saving: boolean;
  onSave: () => void;
  /** Lets someone create the first track right here instead of leaving the form. */
  onCreateTrack?: (name: string) => Promise<void>;
  /** Groups a shared question can go to. The picker only appears when there is more than one. */
  groupOptions?: { value: string; label: string }[];
  groupId?: string;
  onGroupChange?: (groupId: string) => void;
}) {
  const [trackName, setTrackName] = useState("");
  const [creatingTrack, setCreatingTrack] = useState(false);

  const createTrack = async () => {
    if (!onCreateTrack || !trackName.trim()) return;
    setCreatingTrack(true);
    try {
      await onCreateTrack(trackName.trim());
      setTrackName("");
    } finally {
      setCreatingTrack(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Question" : "Add Question"} size="lg">
      <div className="space-y-5">
        <FormField label="Title">
          <Input
            type="text"
            value={values.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="TCP vs UDP"
            autoFocus
          />
        </FormField>
        <FormField label="Description">
          <Textarea
            value={values.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Explain connection-oriented vs connectionless delivery, use cases, and trade-offs."
            rows={3}
          />
        </FormField>

        {!editing && values.scope === "group" && groupOptions && groupOptions.length > 1 && (
          <FormField label="Group" hint="Everyone in this group will get the question.">
            <Select
              value={groupId ?? ""}
              onChange={(g) => onGroupChange?.(g)}
              aria-label="Group"
              options={groupOptions}
            />
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Track">
            {tracks.length === 0 ? (
              onCreateTrack ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted)]">No {values.scope} tracks yet. Name your first one:</p>
                  <div className="flex gap-2">
                    <Input
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void createTrack();
                        }
                      }}
                      placeholder="e.g. System Design"
                      aria-label="New track name"
                      maxLength={60}
                    />
                    <Button type="button" variant="outline" onClick={() => void createTrack()} loading={creatingTrack} disabled={!trackName.trim()}>
                      Create
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
                  No {values.scope} tracks yet.{" "}
                  <Link href="/subjects" className="text-brand hover:underline">
                    Create one
                  </Link>
                </p>
              )
            ) : (
              <Select
                value={values.subjectId}
                onChange={(subjectId) => onChange({ subjectId })}
                aria-label="Track"
                placeholder="Select a track"
                options={tracks.map((s) => ({ value: s._id, label: formatSubjectTrack(s) }))}
              />
            )}
          </FormField>
          <FormField label="Visibility" hint={scopeHint}>
            {canChooseScope ? (
              <Select
                value={values.scope}
                onChange={(scope) => onChange({ scope: scope as ContentScope })}
                aria-label="Visibility"
                options={[
                  { value: "group", label: SCOPE_LABEL.group },
                  { value: "personal", label: SCOPE_LABEL.personal },
                ]}
              />
            ) : (
              <div className="input flex items-center text-[var(--muted)]">{SCOPE_LABEL[values.scope]}</div>
            )}
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Practice date" hint="Leave empty to keep in All only until scheduled.">
            <DatePicker
              value={values.practiceDate}
              onChange={(practiceDate) => onChange({ practiceDate })}
              aria-label="Practice date"
              clearable
            />
          </FormField>
          <FormField label="Link (optional)">
            <Input
              type="url"
              value={values.link}
              onChange={(e) => onChange({ link: e.target.value })}
              placeholder="https://..."
            />
          </FormField>
        </div>

        {!editing && (
          <p className="text-xs text-[var(--muted)]">
            New questions start as <strong>Not Started</strong>.
          </p>
        )}
        <ModalFooter className="!mt-5" onCancel={onClose} cancelDisabled={saving}>
          <Button
            onClick={onSave}
            loading={saving}
            disabled={!values.title.trim() || !values.subjectId || tracks.length === 0}
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save question"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

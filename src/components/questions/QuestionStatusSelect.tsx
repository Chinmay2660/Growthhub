"use client";

import clsx from "clsx";
import Select from "@/components/ui/Select";
import {
  QUESTION_STATUS_META,
  QUESTION_STATUS_ORDER,
  normalizeQuestionStatus,
} from "@/lib/utils";
import type { QuestionStatus } from "@/types";

const OPTIONS = QUESTION_STATUS_ORDER.map((s) => ({ value: s, label: QUESTION_STATUS_META[s].label }));

export default function QuestionStatusSelect({
  value,
  onChange,
  className,
}: {
  value: QuestionStatus;
  onChange: (status: QuestionStatus) => void;
  className?: string;
}) {
  const status = normalizeQuestionStatus(value);
  return (
    <Select
      value={status}
      onChange={(v) => onChange(v as QuestionStatus)}
      onClick={(e) => e.stopPropagation()}
      options={OPTIONS}
      aria-label="Question status"
      className="inline-block"
      panelWidth={176}
      triggerClassName={clsx(
        "question-status-select inline-flex cursor-pointer items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        `qs-${status}`,
        className
      )}
    />
  );
}

"use client";

import clsx from "clsx";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import ModalFooter from "@/components/ui/ModalFooter";
import { APP_TIMEZONE, parseAppDateTime, toDateTimeLocalValue } from "@/lib/utils";

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

/** Start times in 15-minute slots across the day. */
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/** "value" is a datetime-local string in IST (YYYY-MM-DDTHH:mm). */
export default function MockDateModal({
  open,
  onClose,
  value,
  onChange,
  onSave,
  saving,
  title = "Schedule group mock",
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  saving: boolean;
  title?: string;
}) {
  const [now] = useState(() => Date.now());
  const [datePart = "", timePart = ""] = value.split("T");
  const setDate = (d: string) => onChange(`${d}T${timePart || "14:00"}`);
  // Keep an off-grid time (set before slots existed) selectable instead of silently changing it.
  const timeOptions = timePart && !TIME_SLOTS.includes(timePart) ? [timePart, ...TIME_SLOTS] : TIME_SLOTS;
  const setTime = (t: string) => onChange(`${datePart || toDateTimeLocalValue(new Date(now)).slice(0, 10)}T${t}`);

  const complete = datePart !== "" && timePart !== "";
  const parsed = complete ? parseAppDateTime(value) : null;
  const inPast = parsed ? parsed.getTime() < now : false;
  const preview = parsed
    ? {
        day: parsed.toLocaleDateString("en-IN", {
          timeZone: APP_TIMEZONE,
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        time: fmtTime(timePart),
        rel: (() => {
          const diff = Math.round((parsed.getTime() - now) / 86_400_000);
          if (diff === 0) return "today";
          if (diff === 1) return "tomorrow";
          if (diff > 1) return `in ${diff} days`;
          return "in the past";
        })(),
      }
    : null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (complete && !inPast) onSave();
        }}
      >
        <div
          className={clsx(
            "flex items-center gap-3 rounded-xl border p-3.5",
            preview ? "border-brand/30 bg-brand/10" : "border-dashed border-[var(--border)] bg-[var(--surface-muted)]"
          )}
          aria-live="polite"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <CalendarClock className="h-5 w-5" aria-hidden />
          </span>
          {preview ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{preview.day}</p>
              <p className="text-xs text-[var(--muted)]">
                {preview.time} IST · {preview.rel}
              </p>
              {inPast && <p className="mt-0.5 text-xs text-[var(--danger)]">Choose a time in the future.</p>}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Pick a date and time</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date">
              <DatePicker value={datePart} onChange={setDate} className="text-sm font-normal" />
            </FormField>
            <FormField label="Time (IST)">
              <Select
                value={timePart}
                onChange={setTime}
                placeholder="Select"
                className="text-sm font-normal"
                options={timeOptions.map((tm) => ({ value: tm, label: fmtTime(tm) }))}
              />
            </FormField>
          </div>
        </div>

        <ModalFooter className="!mt-5" onCancel={onClose} cancelDisabled={saving}>
          <Button type="submit" loading={saving} disabled={!complete || inPast}>
            {saving ? "Saving…" : "Save date"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

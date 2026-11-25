"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { CalendarClock, Zap } from "lucide-react";
import Modal from "@/components/ui/Modal";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import ModalFooter from "@/components/ui/ModalFooter";
import { APP_TIMEZONE, parseAppDateTime, toDateTimeLocalValue } from "@/lib/utils";

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

/** Quick "in N minutes" offsets, a 15-minute gap apart. */
/** Module-level so event handlers read the clock outside render. */
const readClock = () => Date.now();

const QUICK_OFFSETS = [15, 30, 45, 60];

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
  /** `instant` means start right now; the server uses its own clock. */
  onSave: (opts?: { instant?: boolean }) => void;
  saving: boolean;
  title?: string;
}) {
  const [now, setNow] = useState(readClock);
  const [mode, setMode] = useState<"now" | "later">("later");
  const [datePart = "", timePart = ""] = value.split("T");
  const todayIst = toDateTimeLocalValue(new Date(now)).slice(0, 10);

  // Re-read the clock whenever the dialog opens so "now" and the past check are current.
  useEffect(() => {
    if (open) {
      setNow(readClock());
      setMode("later");
    }
  }, [open]);

  const setDate = (d: string) => onChange(`${d}T${timePart || toDateTimeLocalValue(new Date(now)).slice(11)}`);
  const setTime = (t: string) => onChange(`${datePart || todayIst}T${t}`);
  const setInMinutes = (mins: number) => {
    const t = readClock();
    setNow(t);
    onChange(toDateTimeLocalValue(new Date(t + mins * 60_000)));
  };

  const complete = datePart !== "" && timePart !== "";
  const parsed = mode === "now" ? new Date(now) : complete ? parseAppDateTime(value) : null;
  // Same minute as "now" is fine, so a schedule for the current time is allowed.
  const inPast = mode === "later" && parsed ? parsed.getTime() < now - 60_000 : false;
  const preview = parsed
    ? {
        day: parsed.toLocaleDateString("en-IN", {
          timeZone: APP_TIMEZONE,
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        time: fmtTime(toDateTimeLocalValue(parsed).slice(11)),
        rel: (() => {
          const mins = Math.round((parsed.getTime() - now) / 60_000);
          if (mode === "now" || Math.abs(mins) < 1) return "starts now";
          if (mins > 0 && mins < 60) return `in ${mins} min`;
          const diff = Math.round((parsed.getTime() - now) / 86_400_000);
          if (mins >= 60 && diff === 0) return `in ${Math.round(mins / 60)} h`;
          if (diff === 1) return "tomorrow";
          if (diff > 1) return `in ${diff} days`;
          return "in the past";
        })(),
      }
    : null;
  const canSave = mode === "now" || (complete && !inPast);

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave(mode === "now" ? { instant: true } : undefined);
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
              {inPast && <p className="mt-0.5 text-xs text-[var(--danger)]">Choose the current time or later.</p>}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Pick a date and time</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5" role="tablist">
          {(
            [
              ["now", "Start now"],
              ["later", "Schedule"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={clsx(
                "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-all",
                mode === id
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-soft"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {id === "now" && <Zap className="h-3.5 w-3.5" aria-hidden />}
              {label}
            </button>
          ))}
        </div>

        {mode === "now" ? (
          <p className="text-sm text-[var(--muted)]">
            The mock starts immediately, so questions can be generated and peers can score right away.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_OFFSETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInMinutes(m)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                >
                  {m < 60 ? `In ${m} min` : "In 1 hour"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date">
                <DatePicker value={datePart} onChange={setDate} className="text-sm font-normal" />
              </FormField>
              <FormField label="Custom time (IST)">
                <input
                  type="time"
                  step={60}
                  value={timePart}
                  onChange={(e) => setTime(e.target.value)}
                  className="input text-sm font-normal"
                  aria-label="Custom time (IST)"
                />
              </FormField>
            </div>
          </div>
        )}

        <ModalFooter className="!mt-5" onCancel={onClose} cancelDisabled={saving}>
          <Button type="submit" loading={saving} disabled={!canSave}>
            {saving ? "Saving…" : mode === "now" ? "Start now" : "Save date"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

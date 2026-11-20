"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { apiPost, getErrorMessage } from "@/lib/api";

type Priority = "critical" | "high" | "medium" | "low";

/** Quick-capture and shortcut-help dialogs. Loaded on first open, not with the app shell. */
export default function CaptureDialogs({
  groupId,
  captureOpen,
  onCloseCapture,
  helpOpen,
  onCloseHelp,
  shortcuts,
}: {
  groupId: string;
  captureOpen: boolean;
  onCloseCapture: () => void;
  helpOpen: boolean;
  onCloseHelp: () => void;
  shortcuts: { key: string; label: string }[];
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/tasks", { groupId, title: title.trim(), priority });
      toast.success("Captured as a task");
      setTitle("");
      setPriority("medium");
      onCloseCapture();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }, [groupId, title, priority, onCloseCapture]);

  return (
    <>
      <Modal open={captureOpen} onClose={onCloseCapture} title="Quick capture" size="sm">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Revise OS scheduling, ask about CAP theorem…"
            className="input !text-sm"
            maxLength={200}
          />
          <div className="flex gap-1.5">
            {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium capitalize ${
                  priority === p ? "border-brand bg-brand/10 text-brand" : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Add task"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={helpOpen} onClose={onCloseHelp} title="Keyboard shortcuts" size="sm">
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span>Quick capture</span>
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">c</kbd>
          </li>
          {shortcuts.map((g) => (
            <li key={g.key} className="flex justify-between">
              <span>Go to {g.label}</span>
              <span>
                <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">g</kbd>{" "}
                <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">{g.key}</kbd>
              </span>
            </li>
          ))}
          <li className="flex justify-between">
            <span>This help</span>
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">?</kbd>
          </li>
        </ul>
      </Modal>
    </>
  );
}

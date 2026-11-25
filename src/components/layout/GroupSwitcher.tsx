"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Users } from "lucide-react";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, getErrorMessage } from "@/lib/api";
import Select from "@/components/ui/Select";

type GroupOption = { _id: string; name: string };

/**
 * Lets people who belong to several groups choose which one the dashboard, tasks, questions and
 * analytics follow. Renders nothing for a single group. Switching is online-only: the server
 * validates membership, and the cached per-group data is cleared by the write.
 */
export default function GroupSwitcher({ className }: { className?: string }) {
  const { user, updateUser } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [switching, setSwitching] = useState(false);
  const activeGroupId = user?.activeGroupId;
  const signedIn = Boolean(user?._id);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    apiGet<GroupOption[]>("/api/groups", { onCached: (c) => !cancelled && setGroups(c) })
      .then((g) => !cancelled && setGroups(g))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [signedIn, activeGroupId]);

  const onChange = useCallback(
    async (nextId: string) => {
      if (!nextId || nextId === activeGroupId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.error("Reconnect to switch groups");
        return;
      }
      setSwitching(true);
      try {
        const previousId = activeGroupId;
        await updateUser({ activeGroupId: nextId });
        // Group pages are addressed by id: follow the switch instead of leaving the old group open.
        if (previousId && pathname.startsWith(`/groups/${previousId}`)) {
          router.replace(pathname.replace(`/groups/${previousId}`, `/groups/${nextId}`));
        }
        toast.success(`Switched to ${groups.find((g) => g._id === nextId)?.name ?? "group"}`);
      } catch (err) {
        toast.error(getErrorMessage(err, "Could not switch group"));
      } finally {
        setSwitching(false);
      }
    },
    [activeGroupId, groups, pathname, router, updateUser]
  );

  if (groups.length < 2) return null; // still shown with no active group, so you can pick one

  return (
    <Select
      className={className}
      aria-label="Active group"
      value={activeGroupId ?? ""}
      placeholder="Choose a group"
      disabled={switching}
      onChange={(id) => void onChange(id)}
      icon={<Users className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />}
      options={groups.map((g) => ({ value: g._id, label: g.name }))}
    />
  );
}

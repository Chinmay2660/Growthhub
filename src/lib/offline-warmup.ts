import { apiGet } from "@/lib/api";

/**
 * Background pre-fetch so the screens people open most work offline without a prior visit.
 * apiGet writes every response into the Dexie cache; URLs here must match what the pages request.
 * Runs once per session while online and idle; failures are ignored (it's only a warm-up).
 */
const MAX_GROUPS = 5;

type GroupListItem = { _id: string };

const idle = (fn: () => void) =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 8000 }) : setTimeout(fn, 4000);

let warmedFor: string | null = null;

/** Returns the in-app routes worth caching as HTML, once the user's groups are known. */
export async function warmOfflineData(userId: string, activeGroupId?: string): Promise<string[]> {
  const key = `${userId}|${activeGroupId ?? ""}`;
  if (warmedFor === key || (typeof navigator !== "undefined" && !navigator.onLine)) return [];
  warmedFor = key;
  const routes: string[] = [];

  const quiet = async (url: string) => {
    try {
      return await apiGet(url);
    } catch {
      return undefined;
    }
  };

  await new Promise<void>((resolve) => idle(() => resolve()));

  const groups = (await quiet("/api/groups")) as GroupListItem[] | undefined;
  const ids = (Array.isArray(groups) ? groups.map((g) => g._id) : []).slice(0, MAX_GROUPS);
  if (activeGroupId && !ids.includes(activeGroupId)) ids.unshift(activeGroupId);

  // The active group's own screens first (these are the pages people actually open).
  if (activeGroupId) {
    const g = activeGroupId;
    await quiet("/api/dashboard");
    await quiet(`/api/subjects?groupId=${g}&scope=group&includeInactive=1`);
    await quiet(`/api/subjects?scope=personal&includeInactive=1`);
    await quiet(`/api/subjects?groupId=${g}&minimal=1`);
    await quiet(`/api/topics?groupId=${g}&scope=group`);
    await quiet("/api/analytics");
  }

  for (const id of ids) {
    routes.push(`/groups/${id}`, `/groups/${id}/mock-interviews`);
    await quiet(`/api/groups/${id}?include=subjects`);
    await quiet(`/api/groups/${id}?view=header`);
    await quiet(`/api/group-notes?groupId=${id}`);
    await quiet(`/api/group-dynamics?groupId=${id}`);
    await quiet(`/api/mock-interviews/schedule?groupId=${id}`);
    await quiet(`/api/mock-interviews/trends?groupId=${id}`);
  }
  return routes;
}

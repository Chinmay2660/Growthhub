import { apiGet } from "@/lib/api";
import { DEFAULT_QUESTION_TABLE_SORT } from "@/lib/utils";

/**
 * Background pre-fetch so the screens people open most work offline without a prior visit.
 * apiGet writes every response into the Dexie cache; URLs here must match what the pages request.
 * Runs once per session while online and idle; failures are ignored (it's only a warm-up).
 */
const MAX_GROUPS = 5;

type GroupListItem = { _id: string };

const idle = (fn: () => void) =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 800);

const QUESTIONS_PAGE_SIZE = 10; // keep in step with PAGE_SIZE on the Questions page

/** The data URLs a group screen requests when it opens. */
function groupScreenUrls(id: string): string[] {
  return [
    `/api/groups/${id}?include=subjects`,
    `/api/groups/${id}?view=header`,
    `/api/group-notes?groupId=${id}`,
    `/api/group-dynamics?groupId=${id}`,
    `/api/mock-interviews/schedule?groupId=${id}`,
    `/api/mock-interviews/trends?groupId=${id}`,
  ];
}

/** The data URLs a top-level screen requests when it opens (must match the page's own URLs exactly). */
function screenUrls(path: string, activeGroupId?: string): string[] {
  const g = activeGroupId;
  const sort = `sortBy=${DEFAULT_QUESTION_TABLE_SORT.sortBy}&sortDir=${DEFAULT_QUESTION_TABLE_SORT.sortDir}`;
  switch (path) {
    case "/dashboard":
      return ["/api/dashboard", "/api/groups"];
    case "/questions":
      return [
        "/api/groups",
        `/api/practice-questions?scope=group&groupId=all&page=1&limit=${QUESTIONS_PAGE_SIZE}&period=all&${sort}`,
        `/api/practice-questions?scope=personal&page=1&limit=${QUESTIONS_PAGE_SIZE}&period=all&${sort}`,
        "/api/subjects?scope=personal&minimal=1",
        ...(g ? [`/api/subjects?groupId=${g}&minimal=1`] : []),
      ];
    case "/subjects":
      return [
        "/api/subjects?scope=personal&includeInactive=1",
        ...(g ? [`/api/subjects?groupId=${g}&scope=group&includeInactive=1`] : []),
      ];
    case "/topics":
      return g ? [`/api/topics?groupId=${g}&scope=group`] : [];
    case "/analytics":
      return ["/api/analytics"];
    case "/groups":
      return ["/api/groups"];
    default:
      return [];
  }
}

const recentlyPrefetched = new Map<string, number>();

/**
 * Called when someone hovers, focuses or touches a nav link: starts the next screen's data requests
 * now, so by the time the page mounts its cached-first load already has an answer. Throttled per route.
 */
export function prefetchRoute(href: string, activeGroupId?: string): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const group = href.match(/^\/groups\/([a-f0-9]{24})$/)?.[1];
  const urls = group ? groupScreenUrls(group) : screenUrls(href, activeGroupId);
  const last = recentlyPrefetched.get(href) ?? 0;
  if (!urls.length || Date.now() - last < 10_000) return;
  recentlyPrefetched.set(href, Date.now());
  for (const u of urls) void apiGet(u).catch(() => {});
}

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
  const all = (urls: string[]) => Promise.all(urls.map(quiet));

  const groups = (await quiet("/api/groups")) as GroupListItem[] | undefined;
  const ids = (Array.isArray(groups) ? groups.map((g) => g._id) : []).slice(0, MAX_GROUPS);
  if (activeGroupId && !ids.includes(activeGroupId)) ids.unshift(activeGroupId);

  // The main screens first, all at once (they used to go one request after another).
  await all([
    ...screenUrls("/dashboard", activeGroupId),
    ...screenUrls("/questions", activeGroupId),
    ...screenUrls("/subjects", activeGroupId),
    ...screenUrls("/topics", activeGroupId),
    ...screenUrls("/analytics", activeGroupId),
  ]);

  for (const id of ids) {
    routes.push(`/groups/${id}`, `/groups/${id}/mock-interviews`);
    await all(groupScreenUrls(id));
  }
  return routes;
}

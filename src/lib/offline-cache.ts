/** Drop cached pages and static files (logout). Safe to call when no worker exists. */
export async function clearOfflineCaches(): Promise<void> {
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("gh-")).map((n) => caches.delete(n)));
    }
  } catch {
    /* best-effort */
  }
}

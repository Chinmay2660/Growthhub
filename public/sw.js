/* GrowthHub service worker: offline app shell.
 *
 * Rules (keep it boring, a stale worker is worse than none):
 *  - /api/* and anything non-GET is NEVER handled here: the network (or the Dexie layer) owns data.
 *  - /_next/static/* (content-hashed, immutable): cache-first.
 *  - Page navigations: network-first with a timeout, falling back to the last cached copy.
 *  - Only plain 200 same-origin responses are cached (never redirects such as the login bounce).
 *  - Bump VERSION to invalidate everything; old caches are deleted on activate.
 */
const VERSION = "v3";
const STATIC_CACHE = `gh-static-${VERSION}`;
const PAGE_CACHE = `gh-pages-${VERSION}`;
const RUNTIME_CACHE = `gh-runtime-${VERSION}`; // icons, images, fonts and other small same-origin files
const MAX_RUNTIME_ENTRIES = 120;
// Request kinds served stale-while-revalidate (everything else is left to the browser).
const RUNTIME_DESTINATIONS = new Set(["image", "font", "manifest"]);
const NAV_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 250;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafaf9;color:#292524}main{max-width:22rem;padding:1.5rem;text-align:center}button{margin-top:1rem;padding:.5rem 1rem;border-radius:.5rem;border:0;background:#4f46e5;color:#fff;font-size:1rem}@media(prefers-color-scheme:dark){body{background:#1c1917;color:#e7e5e4}}</style></head><body><main><h1>You're offline</h1><p>This page hasn't been saved for offline use yet. Open it once while online and it will be available next time.</p><button onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("gh-") && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

function cacheable(response) {
  return response && response.status === 200 && response.type === "basic" && !response.redirected;
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) {
    cache.put(request, response.clone()).then(() => trim(STATIC_CACHE, MAX_STATIC_ENTRIES));
  }
  return response;
}

/**
 * A cached page is useless offline without the scripts and styles it loads. Read the page's HTML
 * for its hashed /_next/static/* files and store them, so any page we saved also boots offline.
 */
async function cacheAssetsOf(html) {
  const found = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || []);
  if (!found.size) return;
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...found].map(async (path) => {
      try {
        if (await cache.match(path)) return;
        const res = await fetch(path);
        if (cacheable(res)) await cache.put(path, res);
      } catch {
        /* offline or missing: it will be cached when the page actually loads it */
      }
    })
  );
  await trim(STATIC_CACHE, MAX_STATIC_ENTRIES);
}

async function networkFirstPage(event) {
  const request = event.request;
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);
  const key = url.origin + url.pathname; // ignore query strings so ?x=1 variants share one shell
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (cacheable(response)) {
      const copy = response.clone();
      event.waitUntil(
        cache
          .put(key, response.clone())
          .then(() => copy.text())
          .then(cacheAssetsOf)
          .catch(() => {})
      );
    }
    return response;
  } catch {
    const hit = await cache.match(key);
    if (hit) return hit;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

/**
 * Stale-while-revalidate: answer from the cache immediately and refresh it in the background, so
 * icons/images/fonts are instant and offline-safe yet never stay stale for long. Never resolves to
 * undefined (respondWith needs a Response): offline with nothing saved is a network error.
 */
async function staleWhileRevalidate(event) {
  const request = event.request;
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (cacheable(response)) {
        await cache.put(request, response.clone());
        await trim(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // RSC/data fetches for client navigations are left to the network; if they fail Next falls back
  // to a full page load, which the navigation handler below can serve from cache.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event));
    return;
  }
  // Icons, images (incl. Next's optimised /_next/image), fonts and the manifest.
  if (RUNTIME_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "PRECACHE" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        for (const path of data.urls) {
          try {
            const url = new URL(path, self.location.origin);
            if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) continue;
            const response = await fetch(url.pathname, { credentials: "include", headers: { Accept: "text/html" } });
            if (cacheable(response)) {
              const html = await response.clone().text();
              await cache.put(url.origin + url.pathname, response);
              await cacheAssetsOf(html);
            }
          } catch {
            /* offline or failed: skip, it will be cached when visited */
          }
        }
      })()
    );
  }
  if (data.type === "CLEAR") {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith("gh-")).map((n) => caches.delete(n))))
    );
  }
});

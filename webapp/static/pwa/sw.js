// Increment this when you want to force-refresh cached assets (hard cache bust).
const CACHE_VERSION = "v13";
const CACHE = `fitts-${CACHE_VERSION}`;

// Handle messages from pages (e.g., update banner -> request immediate activation).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Precache only the "app shell" assets (UI). Keep this list small and stable:
// if one asset fails to cache during install, the SW installation fails.
const PRECACHE = [
  "/", // Main page (served by Flask template)
  "/static/css/style.css",

  // Main entry point
  "/static/javascript/main.js",

  // Core modules
  "/static/javascript/core/constants.js",
  "/static/javascript/core/device.js",
  "/static/javascript/core/dom.js",
  "/static/javascript/core/geometry.js",
  "/static/javascript/core/helpers.js",
  "/static/javascript/core/server.js",
  "/static/javascript/core/state.js",
  "/static/javascript/core/storage.js",
  "/static/javascript/core/ui.js",

  // Experiment modules
  "/static/javascript/modules/calibration.js",
  "/static/javascript/modules/experiment.js",
  "/static/javascript/modules/fingerTouchability.js",
  "/static/javascript/modules/protocol.js",
  "/static/javascript/modules/sessionDesign.js",
  "/static/javascript/modules/trialPairEngine.js",
  "/static/javascript/modules/trialParameters.js",

  // Target modules
  "/static/javascript/targets/Target.js",
  "/static/javascript/targets/TargetDebugOverlay.js",
  "/static/javascript/targets/TargetFactory.js",
  "/static/javascript/targets/TouchArea.js",
  "/static/javascript/modules/monteCarlo.js",
  // Debug module
  "/static/javascript/debug/debug.js",

  // PWA entry (served by Flask route)
  "/manifest.webmanifest",

  // Icons
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
];

// URL prefixes that should NEVER be cached by the service worker.
const BYPASS_PREFIXES = [
  "/save_results",
  "/check_ids",
  "/sessions/",
  "/export/",
  "/dashboard",
  "/routes",
];

// Static file extensions that are safe to cache (stale-while-revalidate).
const STATIC_EXT = [
  ".js", ".css", ".png",
  ".jpg", ".jpeg", ".svg",
  ".webp", ".ico", ".json", ".webmanifest"
];

// Optional helper to notify open pages (currently unused, kept for future UX).
async function broadcast(type, payload = {}) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type, ...payload });
}

self.addEventListener("install", (event) => {
  // Activate the new SW ASAP (note: pages still need a reload to use it).
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove old caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));

      // Take control of currently open pages.
      await self.clients.claim();
    })()
  );
});

function shouldBypass(url) {
  const path = url.pathname;
  return BYPASS_PREFIXES.some((p) => path === p || path.startsWith(p));
}

function isStaticAsset(url) {
  const path = url.pathname.toLowerCase();
  return STATIC_EXT.some((ext) => path.endsWith(ext));
}

// Fetch strategy:
// - HTML/navigation: network-first (keeps the Flask template fresh)
// - Static assets: stale-while-revalidate (fast load + background updates)
// - Everything else: bypass (network)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never cache admin/export/api endpoints.
  if (shouldBypass(url)) return;

  const accept = req.headers.get("accept") || "";
  const isNav = req.mode === "navigate" || accept.includes("text/html");

  // Navigation (HTML): try network first, fall back to cached root.
  if (isNav) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);

          // Optionally cache the latest HTML (not mandatory).
          const cache = await caches.open(CACHE);
          cache.put("/", fresh.clone());

          return fresh;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: serve cache immediately when available, update cache in background.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);

        const fetchPromise = (async () => {
          try {
            const fresh = await fetch(req);
            // Cache only successful, same-origin responses.
            if (fresh && fresh.ok && fresh.type === "basic") {
              await cache.put(req, fresh.clone());
            }
            return fresh;
          } catch {
            return null;
          }
        })();

        if (cached) {
          fetchPromise.catch(() => {});
          return cached;
        }

        const fresh = await fetchPromise;
        return fresh || Response.error();
      })()
    );
    return;
  }

  // Default: network (no caching).
});
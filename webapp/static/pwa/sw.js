/**
 * Service Worker for the Fitts Display Lab PWA.
 *
 * Organigram reference:
 * - PWA Layer
 *   → Service Worker
 *   → App Shell Cache
 *   → Offline / Fast Reload Support
 *
 * Responsibility:
 * Provides caching behavior for the frontend application shell.
 *
 * Cached content:
 * - main Flask entry page "/"
 * - frontend CSS
 * - frontend JavaScript modules
 * - target modules
 * - PWA manifest
 * - application icons
 *
 * Not cached:
 * - backend Python files
 * - database files
 * - exported CSV files
 * - dashboard/API responses
 * - documentation files
 */

const CACHE_VERSION = "v24";
const CACHE = `fitts-${CACHE_VERSION}`;

/**
 * URLs required for the frontend app shell.
 *
 * Important:
 * Keep only files that are actually served to the browser.
 * Do not add Python, database, documentation or generated export files here.
 *
 * If one file in this list is missing, cache.addAll() fails and the service
 * worker will not install.
 */
const PRECACHE = [
  /**
   * Main application entry.
   * Served by Flask from templates/index.html.
   */
  "/",

  /**
   * Stylesheet.
   */
  "/static/css/style.css",

  /**
   * PWA manifest.
   * Served by the Flask route /manifest.webmanifest.
   */
  "/manifest.webmanifest",

  /**
   * Icons used by the manifest and possibly by the browser UI.
   */
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/icon.png",

  /**
   * Main JavaScript entry point.
   */
  "/static/javascript/main.js",

  /**
   * Core modules.
   */
  "/static/javascript/core/adminSettings.js",
  "/static/javascript/core/constants.js",
  "/static/javascript/core/device.js",
  "/static/javascript/core/distributions.js",
  "/static/javascript/core/dom.js",
  "/static/javascript/core/geometry.js",
  "/static/javascript/core/helpers.js",
  "/static/javascript/core/server.js",
  "/static/javascript/core/state.js",
  "/static/javascript/core/storage.js",
  "/static/javascript/core/ui.js",

  /**
   * Core storage submodules.
   */
  "/static/javascript/core/storage/calibrationStorage.js",
  "/static/javascript/core/storage/deviceSignature.js",
  "/static/javascript/core/storage/protocolStorage.js",
  "/static/javascript/core/storage/touchabilityStorage.js",

  /**
   * Core utility submodules.
   */
  "/static/javascript/core/utils/csv_export.js",
  "/static/javascript/core/utils/fitts_equations.js",
  "/static/javascript/core/utils/fullscreen.js",
  "/static/javascript/core/utils/inputParsing.js",
  "/static/javascript/core/utils/math.js",
  "/static/javascript/core/utils/placement.js",
  "/static/javascript/core/utils/time.js",
  "/static/javascript/core/utils/units.js",
  "/static/javascript/core/utils/viewport.js",

  /**
   * Debug module.
   */
  "/static/javascript/debug/debug.js",

  /**
   * Main feature modules.
   */
  "/static/javascript/modules/adminSettingsUI.js",
  "/static/javascript/modules/calibration.js",
  "/static/javascript/modules/calibrationHandlers.js",
  "/static/javascript/modules/commentHandlers.js",
  "/static/javascript/modules/experiment.js",
  "/static/javascript/modules/experimentConstraints.js",
  "/static/javascript/modules/exportHandlers.js",
  "/static/javascript/modules/fingerTouchability.js",
  "/static/javascript/modules/idHints.js",
  "/static/javascript/modules/monteCarlo.js",
  "/static/javascript/modules/monteCarloSummaryView.js",
  "/static/javascript/modules/parameterSampling.js",
  "/static/javascript/modules/protocol.js",
  "/static/javascript/modules/protocolDesignHandlers.js",
  "/static/javascript/modules/protocolListController.js",
  "/static/javascript/modules/protocolManager.js",
  "/static/javascript/modules/runHandlers.js",
  "/static/javascript/modules/sessionDesign.js",
  "/static/javascript/modules/touchabilityHandlers.js",
  "/static/javascript/modules/touchabilityRuntime.js",
  "/static/javascript/modules/trialPairEngine.js",
  "/static/javascript/modules/trialParameters.js",

  /**
   * Calibration submodules.
   */
  "/static/javascript/modules/calibration/calibrationGestures.js",
  "/static/javascript/modules/calibration/calibrationMath.js",

  /**
   * Experiment submodules.
   */
  "/static/javascript/modules/experiment/experimentConditions.js",
  "/static/javascript/modules/experiment/experimentExport.js",
  "/static/javascript/modules/experiment/experimentResultRows.js",
  "/static/javascript/modules/experiment/experimentRuntime.js",
  "/static/javascript/modules/experiment/experimentSummary.js",
  "/static/javascript/modules/experiment/experimentTargets.js",
  "/static/javascript/modules/experiment/experimentTrialContext.js",
  "/static/javascript/modules/experiment/experimentTrialPlacement.js",
  "/static/javascript/modules/experiment/experimentTrialPreparation.js",
  "/static/javascript/modules/experiment/experimentTrials.js",

  /**
   * Monte Carlo submodules.
   */
  "/static/javascript/modules/monteCarlo/monteCarloConstants.js",
  "/static/javascript/modules/monteCarlo/monteCarloCounts.js",
  "/static/javascript/modules/monteCarlo/monteCarloDiagnostics.js",
  "/static/javascript/modules/monteCarlo/monteCarloEngine.js",
  "/static/javascript/modules/monteCarlo/monteCarloHistogram.js",
  "/static/javascript/modules/monteCarlo/monteCarloPreviewRows.js",
  "/static/javascript/modules/monteCarlo/monteCarloProfiles.js",
  "/static/javascript/modules/monteCarlo/monteCarloSampling.js",
  "/static/javascript/modules/monteCarlo/monteCarloStats.js",

  /**
   * Session design submodules.
   */
  "/static/javascript/modules/sessionDesign/sessionBlockState.js",
  "/static/javascript/modules/sessionDesign/sessionBlockTemplate.js",
  "/static/javascript/modules/sessionDesign/sessionWarnings.js",

  /**
   * Target modules.
   */
  "/static/javascript/targets/Target.js",
  "/static/javascript/targets/TargetDebugOverlay.js",
  "/static/javascript/targets/TargetFactory.js",
  "/static/javascript/targets/TouchArea.js",
];

/**
 * URL prefixes that should never be cached.
 *
 * These routes are dynamic and must always use the network.
 */
const BYPASS_PREFIXES = [
  "/api/",
  "/save_results",
  "/check_ids",
  "/sessions/",
  "/export/",
  "/dashboard",
  "/montecarlo",
  "/routes",
];

/**
 * Static file types that can be cached after first network request.
 *
 * Files in PRECACHE are cached during installation.
 * Other static files can still be cached later with stale-while-revalidate.
 */
const STATIC_EXT = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".ico",
  ".json",
  ".webmanifest",
];

/**
 * Handle messages from pages.
 *
 * Supported message:
 * - SKIP_WAITING: immediately activates the waiting service worker.
 */
self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/**
 * Notify all open pages.
 *
 * Currently unused, but useful later for update banners or reload prompts.
 */
async function broadcast(type, payload = {}) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage({
      type,
      ...payload,
    });
  }
}

/**
 * Install event.
 *
 * Caches the app shell files.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
    })()
  );
});

/**
 * Activate event.
 *
 * Removes old cache versions and takes control of open pages.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) =>
          key !== CACHE
            ? caches.delete(key)
            : null
        )
      );

      await self.clients.claim();
    })()
  );
});

/**
 * Check whether a URL must bypass the service worker cache.
 */
function shouldBypass(url) {
  const path = url.pathname;

  return BYPASS_PREFIXES.some((prefix) =>
    path === prefix ||
    path.startsWith(prefix)
  );
}

/**
 * Check whether a URL points to a static frontend asset.
 */
function isStaticAsset(url) {
  const path = url.pathname.toLowerCase();

  return STATIC_EXT.some((ext) =>
    path.endsWith(ext)
  );
}

/**
 * Fetch strategy:
 *
 * - Navigation / HTML:
 *   Network-first, fallback to cached "/".
 *
 * - Static frontend assets:
 *   Stale-while-revalidate.
 *
 * - API, dashboard, export and dynamic routes:
 *   Network only.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (shouldBypass(url)) return;

  const accept = req.headers.get("accept") || "";

  const isNavigation =
    req.mode === "navigate" ||
    accept.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);

          const cache = await caches.open(CACHE);
          await cache.put("/", fresh.clone());

          return fresh;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })()
    );

    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);

        const fetchPromise = (async () => {
          try {
            const fresh = await fetch(req);

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

  /**
   * Default:
   * Let the browser use the normal network request.
   */
});
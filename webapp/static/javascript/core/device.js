/**
 * Collects contextual device and environment information.
 */
export function getDeviceContext() {
  const nav = navigator;

  // ------------------------------------------------------------
  // User agent & platform
  // ------------------------------------------------------------

  // Raw user agent string (stored for reproducibility)
  const ua = nav.userAgent || "";

  // Simple heuristic to flag mobile user agents
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  // ------------------------------------------------------------
  // Screen & viewport metrics
  // ------------------------------------------------------------

  // Physical screen resolution (CSS pixels)
  const screenW = window.screen?.width ?? null;
  const screenH = window.screen?.height ?? null;

  // Current viewport size (important for Fitts scaling)
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Device pixel ratio (CSS px → device px scaling factor)
  const dpr = window.devicePixelRatio || 1;

  // ------------------------------------------------------------
  // Input capabilities (HCI-relevant)
  // ------------------------------------------------------------

  // Touch support detection (multi-signal approach)
  const maxTouchPoints = nav.maxTouchPoints ?? 0;
  const touchSupport = maxTouchPoints > 0 || ("ontouchstart" in window);

  // Pointer precision & hover capability
  const coarsePointer =
    window.matchMedia?.("(pointer: coarse)")?.matches ?? null;

  const finePointer =
    window.matchMedia?.("(pointer: fine)")?.matches ?? null;

  const hoverCapable =
    window.matchMedia?.("(hover: hover)")?.matches ?? null;

  // ------------------------------------------------------------
  // Performance-related indicators (approximate only)
  // ------------------------------------------------------------

  // Number of logical CPU cores (may be masked by browser)
  const hardwareConcurrency = nav.hardwareConcurrency ?? null;

  // Estimated device memory in GB (not supported everywhere)
  const deviceMemoryGB = nav.deviceMemory ?? null;

  // ------------------------------------------------------------
  // Accessibility & user preferences
  // ------------------------------------------------------------

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? null;

  // ------------------------------------------------------------
  // Locale & environment
  // ------------------------------------------------------------

  const language = nav.language ?? null;

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;

  // ------------------------------------------------------------
  // Return normalized device context object
  // ------------------------------------------------------------

  return {
    // Identification
    ua,
    platform: nav.platform ?? null, // legacy but still informative
    mobile_ua: isMobileUA,

    // Display
    screen_w: screenW,
    screen_h: screenH,
    viewport_w: viewportW,
    viewport_h: viewportH,
    dpr,

    // Input
    touch_support: touchSupport,
    max_touch_points: maxTouchPoints,
    pointer_coarse: coarsePointer,
    pointer_fine: finePointer,
    hover_capable: hoverCapable,

    // Performance signals
    hardware_concurrency: hardwareConcurrency,
    device_memory_gb: deviceMemoryGB,

    // Accessibility
    prefers_reduced_motion: prefersReducedMotion,

    // Locale
    language,
    timezone,
  };
}
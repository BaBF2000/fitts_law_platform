/**
 * ============================================================
 * Viewport Utilities
 * ============================================================
 *
 * Organigram:
 * Main Window
 * ├── Experiment Runtime
 * ├── Trial Generation
 * ├── Target Placement
 * └── Monte Carlo Analysis
 *
 * Purpose:
 * Provides the current playable viewport dimensions.
 *
 * All viewport-dependent calculations must go through
 * this module.
 * ============================================================
 */

export function getViewportSize() {
  const width =
    document.documentElement?.clientWidth ||
    window.visualViewport?.width ||
    window.innerWidth;

  const height =
    document.documentElement?.clientHeight ||
    window.visualViewport?.height ||
    window.innerHeight;

  return {
    width,
    height,
    minSide: Math.min(width, height),
  };
}
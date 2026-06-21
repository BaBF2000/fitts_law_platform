/**
 * Viewport utilities.
 *
 * Organigram reference:
 * - Core Utilities
 *   → Viewport Utilities
 * - Experiment Engine
 *   → Target Placement
 * - Monte Carlo Simulation
 *   → Viewport Constraints
 *
 * Responsibility:
 * Provides the current playable viewport dimensions used by placement,
 * relative-unit conversion and Monte Carlo validation.
 *
 * Important:
 * All viewport-dependent calculations should use this module instead of
 * directly reading window.innerWidth or window.innerHeight.
 */

/**
 * Return the current viewport dimensions.
 *
 * Returns:
 *   Object containing:
 *     - width: current viewport width in CSS pixels
 *     - height: current viewport height in CSS pixels
 *     - minSide: smaller of width and height
 *
 * Side effects:
 *   None. This function only reads browser viewport properties.
 *
 * Behavior:
 *   Uses documentElement.clientWidth/clientHeight first, then falls back to
 *   visualViewport and finally window.innerWidth/window.innerHeight.
 *
 * Related usage:
 *   minSide is used by relative unit conversion, where relative values are
 *   interpreted as fractions of the smaller viewport side.
 */
export function getViewportSize() {
  // Prefer documentElement dimensions because they usually represent the layout
  // viewport used by CSS positioning.
  const width =
    document.documentElement?.clientWidth ||
    window.visualViewport?.width ||
    window.innerWidth;

  // Fall back to visualViewport or window dimensions if documentElement values
  // are unavailable.
  const height =
    document.documentElement?.clientHeight ||
    window.visualViewport?.height ||
    window.innerHeight;

  return {
    width,
    height,
    // minSide is used for relative units so generated distances and target sizes
    // remain usable across different aspect ratios.
    minSide: Math.min(width, height),
  };
}
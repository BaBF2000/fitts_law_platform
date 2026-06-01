import { getViewportSize } from "./viewport.js";

/**
 * ============================================================
 * Unit Conversion Utilities
 * ============================================================
 *
 * Organigram:
 * Main Window
 * └── Experiment Runtime
 *     ├── Trial Parameter Resolution
 *     ├── Trial Generation
 *     └── Monte Carlo Analysis
 *
 * Purpose:
 * Conversion between:
 * - relative units
 * - px
 * - mm
 *
 * Every unit conversion should pass through this file.
 * ============================================================
 */

export function convertToPxAndMm(value, unitMode, mmPerPx) {
  const { minSide } = getViewportSize();

  if (!Number.isFinite(value) || value < 0) {
    return { px: NaN, mm: NaN, mode: "invalid" };
  }

  if (unitMode === "px") {
    return {
      px: value,
      mm: mmPerPx ? value * mmPerPx : NaN,
      mode: "px",
    };
  }

  if (unitMode === "mm") {
    if (!mmPerPx) {
      return { px: NaN, mm: NaN, mode: "mm_no_calibration" };
    }

    return {
      px: value / mmPerPx,
      mm: value,
      mode: "mm",
    };
  }

  const px = value * minSide;

  return {
    px,
    mm: mmPerPx ? px * mmPerPx : NaN,
    mode: "relative",
  };
}
import { getViewportSize } from "./viewport.js";

/**
 * Unit conversion helpers.
 *
 * Organigram reference:
 * - Core Utilities
 *   → Unit Conversion
 * - Experiment Engine
 *   → Trial Parameter Resolution
 * - Monte Carlo Simulation
 *   → Parameter Generator
 *
 * Responsibility:
 * Converts protocol values between relative units, pixels and millimeters.
 *
 * Supported unit modes:
 * - "relative": value is interpreted relative to the shortest viewport side
 * - "px": value is interpreted as CSS pixels
 * - "mm": value is interpreted as millimeters and requires calibration
 *
 * Important:
 * All experiment and Monte Carlo unit conversions should pass through this
 * module to keep runtime behavior consistent.
 */

/**
 * Convert a numeric value to pixels and millimeters.
 *
 * Args:
 *   value: Numeric input value from protocol or runtime configuration.
 *   unitMode: Unit mode. Supported values are "relative", "px" and "mm".
 *   mmPerPx: Calibration factor in millimeters per CSS pixel.
 *
 * Returns:
 *   Object with:
 *     - px: value converted to CSS pixels, or NaN if conversion is impossible
 *     - mm: value converted to millimeters, or NaN if no calibration exists
 *     - mode: conversion mode or error marker
 *
 * Side effects:
 *   Reads the current viewport size through getViewportSize().
 *
 * Behavior:
 *   - "px": keeps the pixel value and derives mm if calibration exists.
 *   - "mm": requires mmPerPx to derive pixels.
 *   - any other mode falls back to "relative".
 *
 * Notes:
 *   Relative values are multiplied by the shortest viewport side.
 */
export function convertToPxAndMm(value, unitMode, mmPerPx) {
  // Relative units are scaled using the shortest viewport side so that values
  // remain usable across different display aspect ratios.
  const { minSide } = getViewportSize();

  // Negative or non-numeric protocol values cannot be converted reliably
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
    // Millimeter input requires a valid calibration factor to convert to pixels
    if (!mmPerPx) {
      return { px: NaN, mm: NaN, mode: "mm_no_calibration" };
    }

    return {
      px: value / mmPerPx,
      mm: value,
      mode: "mm",
    };
  }

  // Default/fallback mode: interpret the value as a relative fraction of the
  // shortest viewport side
  // Unknown unit modes intentionally fall back to relative units to keep older
  // or malformed protocols usable.
  const px = value * minSide;

  return {
    px,
    mm: mmPerPx ? px * mmPerPx : NaN,
    mode: "relative",
  };
}
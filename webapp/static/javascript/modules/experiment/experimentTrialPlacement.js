/**
 * Experiment trial placement helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Target Placement
 *
 * Responsibility:
 * Computes the next target center position for one trial.
 *
 * Important:
 * This module only decides where the next target should appear.
 * It does not create target objects, render DOM elements or validate hits.
 *
 * Related modules:
 * - experiment.js calls computeNextTargetPosition() during trial preparation.
 * - experimentTargets.js provides shape classification helpers.
 * - core/helpers.js provides placeTarget() for standard 2D target placement.
 */

import {
  placeTarget,
} from "../../core/helpers.js";

import {
  isHorizontalBand,
  isVerticalBand,
} from "./experimentTargets.js";

/**
 * Compute the next target center position for the current trial.
 *
 * Args:
 *   trialShape: Concrete runtime target shape for this trial.
 *   prev: Previous target center position object with x and y.
 *   Apx: Planned amplitude in CSS pixels.
 *   minApx: Minimum safe amplitude in CSS pixels.
 *   Wpx: Target width or band thickness in CSS pixels.
 *   safeRadiusPx: Conservative radius of the next target.
 *   prevRadiusPx: Conservative radius of the previous target.
 *   viewportW: Current viewport width in CSS pixels.
 *   viewportH: Current viewport height in CSS pixels.
 *
 * Returns:
 *   Object containing:
 *   - x: next target center x position
 *   - y: next target center y position
 *   - placed: placement success flag or diagnostic indicator
 *
 * Side effects:
 *   Uses Math.random() when multiple valid placement candidates exist.
 *
 * Behavior:
 *   - Horizontal 1D bands move vertically.
 *   - Vertical 1D bands move horizontally.
 *   - Standard 2D targets are delegated to placeTarget().
 *
 * Important:
 *   If Apx is invalid, minApx is used as a fallback amplitude.
 */
export function computeNextTargetPosition({
  trialShape,
  prev,
  Apx,
  minApx,
  Wpx,
  safeRadiusPx,
  prevRadiusPx,
  viewportW,
  viewportH,
}) {
  // Use the requested amplitude when valid; otherwise fall back to the minimum
  // safe amplitude required by the constraint system.
  const effectiveApx =
    Number.isFinite(Apx)
      ? Apx
      : minApx;

  /**
   * Horizontal 1D band placement.
   *
   * A horizontal band spans horizontally, so the relevant movement dimension is
   * vertical. The x coordinate stays centered and the y coordinate is moved up
   * or down by the effective amplitude.
   */
  if (isHorizontalBand(trialShape)) {
    const marginY =
      Math.max(12, Wpx / 2 + 6);

    const minY = marginY;
    const maxY = viewportH - marginY;

    // Candidate positions at the requested distance above or below the previous
    // band center. Only candidates that remain inside the viewport are kept.
    const candidates = [
      prev.y - effectiveApx,
      prev.y + effectiveApx,
    ].filter((y) => y >= minY && y <= maxY);

    // Prefer a valid amplitude-preserving candidate. If none exists, fall back
    // to the farther viewport boundary to maximize visible separation.
    const y =
      candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.abs(prev.y - minY) > Math.abs(prev.y - maxY)
          ? minY
          : maxY;

    return {
      x: viewportW / 2,
      y,
      placed: candidates.length > 0,
    };
  }

  /**
   * Vertical 1D band placement.
   *
   * A vertical band spans vertically, so the relevant movement dimension is
   * horizontal. The y coordinate stays centered and the x coordinate is moved
   * left or right by the effective amplitude.
   */
  if (isVerticalBand(trialShape)) {
    const marginX =
      Math.max(12, Wpx / 2 + 6);

    const minX = marginX;
    const maxX = viewportW - marginX;

    // Candidate positions at the requested distance left or right of the
    // previous band center. Only viewport-safe candidates are kept.
    const candidates = [
      prev.x - effectiveApx,
      prev.x + effectiveApx,
    ].filter((x) => x >= minX && x <= maxX);

    // Prefer a valid amplitude-preserving candidate. If none exists, fall back
    // to the farther viewport boundary to maximize visible separation.
    const x =
      candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : Math.abs(prev.x - minX) > Math.abs(prev.x - maxX)
          ? minX
          : maxX;

    return {
      x,
      y: viewportH / 2,
      placed: candidates.length > 0,
    };
  }

  // Standard 2D target placement is delegated to the general placement helper.
  return placeTarget(
    prev.x,
    prev.y,
    effectiveApx,
    safeRadiusPx,
    prevRadiusPx
  );
}
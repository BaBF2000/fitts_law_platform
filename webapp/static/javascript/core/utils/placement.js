/**
 * Target placement utilities.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Target Placement
 * - Core Utilities
 *   → Placement Helpers
 *
 * Responsibility:
 * Places the next target inside the playable viewport while trying to preserve
 * the requested movement amplitude and avoid geometric overlap with the
 * previous target.
 *
 * Strategy:
 * - compute safe placement bounds
 * - try random radial positions at the requested/effective distance
 * - fall back to best random candidate if radial placement fails
 * - use a safe clamped fallback as last resort
 *
 * Important:
 * This module only computes coordinates. It does not create DOM elements and
 * does not decide target shape or trial parameters.
 */

import { clamp, uniform01 } from "./math.js";
import { getViewportSize } from "./viewport.js";

/**
 * Compute safe target-center bounds inside the current viewport.
 *
 * Args:
 *   radiusPx: Radius of the target to be placed.
 *
 * Returns:
 *   Object with minX, maxX, minY and maxY bounds for the target center.
 *
 * Side effects:
 *   Reads the current viewport size through getViewportSize().
 *
 * Notes:
 *   The margin keeps the full target visible and adds a small safety distance
 *   from the viewport edges.
 */
function getPlacementBounds(radiusPx) {
  const { width: vw, height: vh } = getViewportSize();
  const margin = Math.max(12, radiusPx + 8);

  return {
    minX: margin,
    maxX: vw - margin,
    minY: margin,
    maxY: vh - margin,
  };
}

/**
 * Check whether a candidate target center lies inside placement bounds.
 *
 * Args:
 *   x: Candidate x-coordinate.
 *   y: Candidate y-coordinate.
 *   bounds: Placement bounds from getPlacementBounds().
 *
 * Returns:
 *   true if the point is inside the allowed placement area.
 *
 * Side effects:
 *   None.
 */
function isInsidePlacementBounds(x, y, bounds) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
}

/**
 * Check whether a candidate target avoids overlap with the previous target.
 *
 * Args:
 *   x: Candidate x-coordinate.
 *   y: Candidate y-coordinate.
 *   prevX: Previous target center x-coordinate.
 *   prevY: Previous target center y-coordinate.
 *   minDistance: Minimum allowed center-to-center distance.
 *
 * Returns:
 *   true if the candidate is at least minDistance away from the previous target.
 *
 * Side effects:
 *   None.
 */
function hasNoOverlap(x, y, prevX, prevY, minDistance) {
  return Math.hypot(x - prevX, y - prevY) >= minDistance;
}

/**
 * Try to place the next target on a circle around the previous target.
 *
 * Args:
 *   Object containing previous target coordinates, requested/effective
 *   distance, placement bounds and minimum overlap distance.
 *
 * Returns:
 *   Candidate object { x, y, placed } if successful, otherwise null.
 *
 * Side effects:
 *   Uses random angular sampling through uniform01().
 *
 * Behavior:
 *   Samples multiple random angles and accepts the first candidate that stays
 *   inside the viewport bounds and avoids overlap.
 */
function tryRadialPlacement({
  prevX,
  prevY,
  distancePx,
  bounds,
  minDistance,
  requestedDpx,
}) {
  for (let tries = 0; tries < 120; tries++) {
    const theta = uniform01() * Math.PI * 2;
    const x = prevX + Math.cos(theta) * distancePx;
    const y = prevY + Math.sin(theta) * distancePx;

    if (
      isInsidePlacementBounds(x, y, bounds) &&
      hasNoOverlap(x, y, prevX, prevY, minDistance)
    ) {
      return {
        x,
        y,
        placed:
          distancePx === requestedDpx
            ? "radial_exact_no_overlap"
            : "radial_adjusted_no_overlap",
      };
    }
  }

  return null;
}

function tryRandomBestPlacement({
  prevX,
  prevY,
  distancePx,
  bounds,
  minDistance,
}) {
  let best = null;
  let bestErr = Infinity;

  for (let tries = 0; tries < 300; tries++) {
    const x =
      bounds.minX +
      uniform01() * Math.max(0, bounds.maxX - bounds.minX);

    const y =
      bounds.minY +
      uniform01() * Math.max(0, bounds.maxY - bounds.minY);

    if (!hasNoOverlap(x, y, prevX, prevY, minDistance)) {
      continue;
    }

    const err =
      Math.abs(Math.hypot(x - prevX, y - prevY) - distancePx);

    if (err < bestErr) {
      bestErr = err;
      best = { x, y };
    }
  }

  return best
    ? {
        ...best,
        placed: "random_best_no_overlap",
      }
    : null;
}

/**
 * Place the next target relative to the previous target center.
 *
 * Args:
 *   prevX: Previous target center x-coordinate.
 *   prevY: Previous target center y-coordinate.
 *   Dpx: Requested movement amplitude in pixels.
 *   newRadiusPx: Radius of the new target in pixels.
 *   prevRadiusPx: Radius of the previous target in pixels. Defaults to
 *     newRadiusPx.
 *
 * Returns:
 *   Object with:
 *     - x: placed target center x-coordinate
 *     - y: placed target center y-coordinate
 *     - placed: placement diagnostic string
 *
 * Side effects:
 *   Reads viewport size and uses random sampling.
 *
 * Behavior:
 *   The requested distance may be increased to avoid geometric overlap between
 *   the previous and next target. If exact radial placement fails, the function
 *   tries a best random candidate and finally falls back to clamping the
 *   previous center into the allowed bounds.
 *
 * Placement diagnostics:
 *   - "radial_exact_no_overlap": requested distance was preserved
 *   - "radial_adjusted_no_overlap": distance was increased to avoid overlap
 *   - "random_best_no_overlap": approximate random fallback was used
 *   - "safe_fallback_overlap_possible": last-resort fallback, overlap possible
 */
export function placeTarget(
  prevX,
  prevY,
  Dpx,
  newRadiusPx,
  prevRadiusPx = newRadiusPx
) {
  // Normalize radius values so invalid or negative values cannot break placement.
  const safeNewRadius = Number.isFinite(newRadiusPx)
    ? Math.max(0, newRadiusPx)
    : 0;

  const safePrevRadius = Number.isFinite(prevRadiusPx)
    ? Math.max(0, prevRadiusPx)
    : safeNewRadius;

  const bounds = getPlacementBounds(safeNewRadius);
  
  // Minimum center-to-center distance required to keep both target areas separated.
  const minDistance = safePrevRadius + safeNewRadius + 10;
  const requestedDpx = Number.isFinite(Dpx) ? Dpx : 0;
  // If the requested amplitude is too small to avoid overlap, increase it to the
  // minimum non-overlapping distance.
  const effectiveDpx = Math.max(requestedDpx, minDistance);

  const radial = tryRadialPlacement({
    prevX,
    prevY,
    distancePx: effectiveDpx,
    bounds,
    minDistance,
    requestedDpx,
  });

  if (radial) return radial;

  const randomBest = tryRandomBestPlacement({
    prevX,
    prevY,
    distancePx: effectiveDpx,
    bounds,
    minDistance,
  });

  if (randomBest) return randomBest;

  // Last resort: keep the target center inside the playable area even if overlap
  // cannot be avoided. The diagnostic string makes this visible in result data.
  return {
    x: clamp(prevX, bounds.minX, bounds.maxX),
    y: clamp(prevY, bounds.minY, bounds.maxY),
    placed: "safe_fallback_overlap_possible",
  };
}
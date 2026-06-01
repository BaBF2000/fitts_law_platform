/**
 * Target placement utilities.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Target Placement
 *
 * Responsibility:
 * Places the next target inside the playable viewport while trying to preserve
 * the requested movement amplitude and avoid geometric overlap.
 */

import { clamp, uniform01 } from "./math.js";
import { getViewportSize } from "./viewport.js";

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

function isInsidePlacementBounds(x, y, bounds) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
}

function hasNoOverlap(x, y, prevX, prevY, minDistance) {
  return Math.hypot(x - prevX, y - prevY) >= minDistance;
}

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
 * Place the next target at distance Dpx from the previous target center.
 */
export function placeTarget(
  prevX,
  prevY,
  Dpx,
  newRadiusPx,
  prevRadiusPx = newRadiusPx
) {
  const safeNewRadius = Number.isFinite(newRadiusPx)
    ? Math.max(0, newRadiusPx)
    : 0;

  const safePrevRadius = Number.isFinite(prevRadiusPx)
    ? Math.max(0, prevRadiusPx)
    : safeNewRadius;

  const bounds = getPlacementBounds(safeNewRadius);

  const minDistance = safePrevRadius + safeNewRadius + 10;
  const requestedDpx = Number.isFinite(Dpx) ? Dpx : 0;
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

  return {
    x: clamp(prevX, bounds.minX, bounds.maxX),
    y: clamp(prevY, bounds.minY, bounds.maxY),
    placed: "safe_fallback_overlap_possible",
  };
}
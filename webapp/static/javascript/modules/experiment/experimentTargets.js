/**
 * Experiment target helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Target Selection
 *
 * Responsibility:
 * Handles target-shape selection and simple target geometry helpers.
 */

export const SHUFFLE_SHAPE_POOL = [
  "circle",
  "square",
  "triangle",
  "pentagon",
  "hexagon",
  "octagon",
  "diamond",
];

export function pickTrialShape(trial) {
  const shape = trial?.shape ?? "circle";

  if (shape === "shuffle") {
    return SHUFFLE_SHAPE_POOL[
      Math.floor(Math.random() * SHUFFLE_SHAPE_POOL.length)
    ];
  }

  return shape;
}

export function deriveSessionTargetMode(items) {
  if (!items?.length) return "unknown";

  const shapes = new Set(
    items.map((x) => x.shape ?? "circle")
  );

  if (shapes.size === 1 && [...shapes][0] === "shuffle") {
    return "shuffle";
  }

  if (shapes.size === 1) {
    return "fixed";
  }

  return "mixed";
}

export function getSafeTargetRadiusPx(shape, sizePx) {
  if (!Number.isFinite(sizePx) || sizePx <= 0) {
    return 0;
  }

  if (shape === "circle") {
    return sizePx / 2;
  }

  return (sizePx * Math.SQRT2) / 2;
}

export function isHorizontalBand(shape) {
  return shape === "band1d_h";
}

export function isVerticalBand(shape) {
  return shape === "band1d_v";
}

export function isBand1D(shape) {
  return isHorizontalBand(shape) || isVerticalBand(shape);
}
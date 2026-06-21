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
 *
 * Important:
 * This module does not create DOM target elements and does not validate hits.
 * It only provides helper logic for shape selection and safe geometry estimates.
 *
 * Related modules:
 * - experiment.js uses these helpers during runtime trial preparation.
 * - TargetFactory.js creates the actual target objects.
 * - Target.js handles shape-specific rendering and hit validation.
 */

/**
 * Pool of target shapes used when a trial requests "shuffle" mode.
 *
 * Important:
 * 1D band targets are intentionally not included here because their geometry
 * and movement interpretation differ from standard 2D targets.
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

/**
 * Pick the concrete target shape for one trial.
 *
 * Args:
 *   trial: Trial object containing an optional shape field.
 *
 * Returns:
 *   Concrete target shape string.
 *
 * Side effects:
 *   Uses Math.random() when the trial shape is "shuffle".
 *
 * Behavior:
 *   - Missing shape defaults to "circle".
 *   - "shuffle" randomly selects one shape from SHUFFLE_SHAPE_POOL.
 *   - Any other shape is returned unchanged.
 *
 * Purpose:
 *   Converts the protocol-level shape setting into the actual runtime shape
 *   used for the current trial.
 */
export function pickTrialShape(trial) {
  const shape = trial?.shape ?? "circle";

  if (shape === "shuffle") {
    return SHUFFLE_SHAPE_POOL[
      Math.floor(Math.random() * SHUFFLE_SHAPE_POOL.length)
    ];
  }

  return shape;
}

/**
 * Derive the overall target-shape mode of a session or protocol.
 *
 * Args:
 *   items: Array of blocks or trials containing optional shape fields.
 *
 * Returns:
 *   Session target mode:
 *   - "unknown" when no items exist
 *   - "shuffle" when all items explicitly use shuffle mode
 *   - "fixed" when all items use the same non-shuffle shape
 *   - "mixed" when multiple shapes are present
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Stores a compact description of the session design for metadata, exports
 *   and later interpretation.
 */
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

/**
 * Estimate a conservative safe radius for viewport placement.
 *
 * Args:
 *   shape: Target shape identifier.
 *   sizePx: Target size in CSS pixels.
 *
 * Returns:
 *   Safe radius in CSS pixels.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - Circles use size / 2.
 *   - Other shapes use half of the bounding-box diagonal.
 *   - Invalid sizes return 0.
 *
 * Important:
 *   This is a conservative placement helper. It helps keep targets inside the
 *   viewport and avoid overlap, but it is not the same as hit validation.
 */
export function getSafeTargetRadiusPx(shape, sizePx) {
  if (!Number.isFinite(sizePx) || sizePx <= 0) {
    return 0;
  }

  if (shape === "circle") {
    return sizePx / 2;
  }

  return (sizePx * Math.SQRT2) / 2;
}

/**
 * Check whether a shape is a horizontal 1D band.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true if the shape is "band1d_h", otherwise false.
 *
 * Side effects:
 *   None.
 */
export function isHorizontalBand(shape) {
  return shape === "band1d_h";
}

/**
 * Check whether a shape is a vertical 1D band.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true if the shape is "band1d_v", otherwise false.
 *
 * Side effects:
 *   None.
 */
export function isVerticalBand(shape) {
  return shape === "band1d_v";
}

/**
 * Check whether a shape is any 1D band target.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true for horizontal or vertical 1D bands, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Provides a shared helper for modules that need to branch between standard
 *   2D targets and 1D band targets.
 */
export function isBand1D(shape) {
  return isHorizontalBand(shape) || isVerticalBand(shape);
}
/**
 * Target factory.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Target Factory
 *
 * Responsibility:
 * Creates runtime Target objects from resolved trial parameters.
 *
 * The factory guarantees:
 * - valid target dimensions
 * - shape-specific sizing rules
 * - viewport-safe placement
 * - correct touchability settings
 *
 * Important:
 * This module does not decide:
 * - trial parameters
 * - target positions
 * - experiment constraints
 *
 * It only converts a target definition into a valid Target instance.
 *
 * Extension guide:
 * - To add a new shape:
 *     1. Extend Target.js geometry support.
 *     2. Add shape-specific sizing rules in applyShapeRules().
 *     3. Add rendering support in Target.render().
 *
 * - To change viewport placement rules:
 *     edit applyViewportClamping().
 */

import { Target } from "./Target.js";

import {
  clamp,
  getViewportSize,
} from "../core/helpers.js";

import {
  DEFAULT_TOUCH_DIAMETER_PX,
  DEFAULT_REQUIRED_OVERLAP,
  VIEWPORT_TARGET_MARGIN_PX,
} from "../core/constants.js";

/* -------------------------------------------------------------------------- */
/* Shape helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Check whether a shape is a horizontal 1D band.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true if the shape represents a horizontal band, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Horizontal bands span the full viewport width and are centered on the
 *   x-axis by the factory.
 */
function isHorizontalBand(shape) {
  return shape === "band1d_h";
}

/**
 * Check whether a shape is a vertical 1D band.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true if the shape represents a vertical band, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Vertical bands span the full viewport height and are centered on the
 *   y-axis by the factory.
 */
function isVerticalBand(shape) {
  return shape === "band1d_v";
}

/**
 * Apply shape-specific sizing and centering rules.
 *
 * Args:
 *   shape: Target shape identifier.
 *   x: Requested target center x-coordinate in CSS pixels.
 *   y: Requested target center y-coordinate in CSS pixels.
 *   widthPx: Requested target width in CSS pixels.
 *   heightPx: Requested target height in CSS pixels.
 *   viewport: Current viewport object with width and height.
 *
 * Returns:
 *   Object containing normalized x, y, widthPx and heightPx values.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - Horizontal bands span the full viewport width and are centered
 *     horizontally.
 *   - Vertical bands span the full viewport height and are centered vertically.
 *   - Other shapes keep the requested center and dimensions.
 *
 * Related usage:
 *   Called by TargetFactory.create() before constructing the Target instance.
 */
function applyShapeRules({
  shape,
  x,
  y,
  widthPx,
  heightPx,
  viewport,
}) {
  if (isHorizontalBand(shape)) {
    return {
      x: viewport.width / 2,
      y,
      widthPx: viewport.width,
      heightPx,
    };
  }

  if (isVerticalBand(shape)) {
    return {
      x,
      y: viewport.height / 2,
      widthPx,
      heightPx: viewport.height,
    };
  }

  return {
    x,
    y,
    widthPx,
    heightPx,
  };
}

/* -------------------------------------------------------------------------- */
/* Viewport safety                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Clamp a target position so its bounding box stays inside the viewport.
 *
 * Args:
 *   target: Target instance to be clamped.
 *   viewport: Current viewport object with width and height.
 *
 * Returns:
 *   The same Target instance after its x/y coordinates were adjusted if needed.
 *
 * Side effects:
 *   Mutates target.x and/or target.y.
 *
 * Behavior:
 *   - Standard targets are clamped so their full bounding box remains visible.
 *   - Horizontal bands stay centered on the x-axis.
 *   - Vertical bands stay centered on the y-axis.
 *
 * Important:
 *   This function only adjusts placement safety. It does not change trial
 *   parameters, shape type or target size.
 */
function applyViewportClamping(target, viewport) {
  const margin = VIEWPORT_TARGET_MARGIN_PX;

  // Minimum and maximum allowed center coordinates for keeping the target fully
  // visible inside the viewport.
  const minX =
    target.widthPx / 2 + margin;

  const maxX =
    viewport.width - target.widthPx / 2 - margin;

  const minY =
    target.heightPx / 2 + margin;

  const maxY =
    viewport.height - target.heightPx / 2 - margin;

  // Horizontal bands intentionally span the full width and must remain centered.
  if (isHorizontalBand(target.shape)) {
    target.x = viewport.width / 2;
  } else {
    target.x = clamp(target.x, minX, maxX);
  }

  // Vertical bands intentionally span the full height and must remain centered.
  if (isVerticalBand(target.shape)) {
    target.y = viewport.height / 2;
  } else {
    target.y = clamp(target.y, minY, maxY);
  }

  return target;
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Factory for creating validated, viewport-safe Target instances.
 *
 * Responsibility:
 * Converts resolved trial-level target data into a Target object that can be
 * rendered and used during hit validation.
 *
 * Important:
 * This class does not resolve A/W/ID values and does not choose target
 * positions. Those decisions are handled before the factory is called.
 */
export class TargetFactory {
  /**
   * Create a viewport-safe Target instance.
   *
   * Args:
   *   shape: Target shape identifier. Defaults to "circle".
   *   x: Requested target center x-coordinate in CSS pixels.
   *   y: Requested target center y-coordinate in CSS pixels.
   *   sizePx: Requested base target size in CSS pixels.
   *   touchDiameterPx: Finger/touch contact diameter used for hit validation.
   *     Defaults to DEFAULT_TOUCH_DIAMETER_PX.
   *   requiredOverlap: Required overlap ratio between touch area and target.
   *     Defaults to DEFAULT_REQUIRED_OVERLAP.
   *
   * Returns:
   *   Target instance with valid size, shape-specific dimensions and viewport-
   *   safe coordinates.
   *
   * Side effects:
   *   Reads the current viewport size through getViewportSize().
   *
   * Behavior:
   *   - Invalid or non-positive sizePx falls back to DEFAULT_TOUCH_DIAMETER_PX.
   *   - Shape-specific sizing rules are applied before Target construction.
   *   - The created Target is clamped to remain visible inside the viewport.
   *
   * Related modules:
   *   - Target.js defines geometry, rendering and hit validation behavior.
   *   - core/constants.js provides default touch and overlap values.
   */
  static create({
    shape = "circle",
    x,
    y,
    sizePx,
    touchDiameterPx = DEFAULT_TOUCH_DIAMETER_PX,
    requiredOverlap = DEFAULT_REQUIRED_OVERLAP,
  }) {
    // Read the current playable viewport at creation time.
    const viewport = getViewportSize();

    // Normalize target size so the factory never creates zero-sized or invalid
    // targets. The default touch diameter is used as a conservative fallback.
    const safeSize =
      Number.isFinite(sizePx) && sizePx > 0
        ? sizePx
        : DEFAULT_TOUCH_DIAMETER_PX;

    // Apply special sizing rules for 1D band targets before constructing the
    // actual Target instance.
    const shaped =
      applyShapeRules({
        shape,
        x,
        y,
        widthPx: safeSize,
        heightPx: safeSize,
        viewport,
      });

    // Create the runtime target object with normalized geometry and validation
    // settings.
    const target = new Target({
      shape,

      x: shaped.x,
      y: shaped.y,

      widthPx: shaped.widthPx,
      heightPx: shaped.heightPx,

      touchDiameterPx,
      requiredOverlap,
    });

    // Keep the final target fully visible inside the current viewport.
    return applyViewportClamping(
      target,
      viewport
    );
  }
}
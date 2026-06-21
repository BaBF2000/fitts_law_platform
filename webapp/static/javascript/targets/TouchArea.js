/**
 * Touch Area Model
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Input Processing
 *   → Touch Model
 *   → Touch Validation
 *
 * Responsibility:
 * Represents the physical finger contact area used during:
 * - overlap estimation
 * - hit validation
 * - export of touch geometry
 *
 * Design decision:
 * Real finger contacts are device-dependent and irregular.
 * For reproducibility, the application models every touch as a circle.
 *
 * Extension guide:
 * If future work requires:
 * - elliptical touches
 * - pressure-dependent touches
 * - stylus contacts
 *
 * this is the only module that should be modified.
 */

import { DEFAULT_TOUCH_DIAMETER_PX } from "../core/constants.js";

/*
 * --------------------------------------------------------------------------
 * Helper functions
 * --------------------------------------------------------------------------
 */

/**
 * Normalize a raw touch diameter value.
 *
 * Args:
 *   value: Raw diameter value in CSS pixels.
 *
 * Returns:
 *   Positive finite diameter in pixels. If the input is invalid, zero or
 *   negative, DEFAULT_TOUCH_DIAMETER_PX is returned instead.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Ensures that every TouchArea instance always has a valid circular diameter.
 */
function normalizeDiameter(value) {
  const diameter = Number(value);

  return Number.isFinite(diameter) && diameter > 0
    ? diameter
    : DEFAULT_TOUCH_DIAMETER_PX;
}

/**
 * Check whether a point lies inside or on a circle.
 *
 * Args:
 *   px: Point x-coordinate in CSS pixels.
 *   py: Point y-coordinate in CSS pixels.
 *   cx: Circle center x-coordinate in CSS pixels.
 *   cy: Circle center y-coordinate in CSS pixels.
 *   radius: Circle radius in CSS pixels.
 *
 * Returns:
 *   true if the point lies inside or on the circle boundary, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   The squared-distance comparison avoids an unnecessary square root.
 */
function pointInsideCircle(px, py, cx, cy, radius) {
  const dx = px - cx;
  const dy = py - cy;

  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Compute the area of a circle.
 *
 * Args:
 *   radius: Circle radius in CSS pixels.
 *
 * Returns:
 *   Circle area in square pixels.
 *
 * Side effects:
 *   None.
 */
function circleArea(radius) {
  return Math.PI * radius * radius;
}

/*
 * --------------------------------------------------------------------------
 * TouchArea
 * --------------------------------------------------------------------------
 */

/**
 * Circular model of a physical touch contact.
 *
 * Coordinates and dimensions are expressed in viewport CSS pixels.
 *
 * Responsibility:
 * Stores touch center position and diameter, provides derived geometry values,
 * supports point containment checks and serializes touch geometry for export.
 */
export class TouchArea {
  /**
   * Create one circular touch area.
   *
   * Args:
   *   x: Touch center x-coordinate in viewport CSS pixels.
   *   y: Touch center y-coordinate in viewport CSS pixels.
   *   diameterPx: Touch diameter in CSS pixels. Invalid values fall back to
   *     DEFAULT_TOUCH_DIAMETER_PX.
   *
   * Side effects:
   *   None.
   */
  constructor({
    x,
    y,
    diameterPx = DEFAULT_TOUCH_DIAMETER_PX,
  }) {
    // Store the touch center as numeric values.
    this.x = Number(x);
    this.y = Number(y);

    // Ensure that the touch diameter is always valid and positive.
    this.diameterPx =
      normalizeDiameter(diameterPx);
  }

  /* ------------------------------------------------------------------------ */
  /* Derived geometry                                                         */
  /* ------------------------------------------------------------------------ */

  /**
   * Touch radius in CSS pixels.
   *
   * Returns:
   *   Half of the normalized touch diameter.
   *
   * Side effects:
   *   None.
   */
  get radiusPx() {
    return this.diameterPx / 2;
  }

  /**
   * Touch area in square CSS pixels.
   *
   * Returns:
   *   Area of the circular touch model.
   *
   * Side effects:
   *   None.
   */
  get areaPx2() {
    return circleArea(this.radiusPx);
  }

  /* ------------------------------------------------------------------------ */
  /* Geometry queries                                                         */
  /* ------------------------------------------------------------------------ */

  /**
   * Test whether a point lies inside the touch area.
   *
   * Args:
   *   px: Point x-coordinate in CSS pixels.
   *   py: Point y-coordinate in CSS pixels.
   *
   * Returns:
   *   true if the point lies inside or on the touch circle, otherwise false.
   *
   * Side effects:
   *   None.
   *
   * Related usage:
   *   Used during hit validation and overlap estimation.
   */
  containsPoint(px, py) {
    return pointInsideCircle(
      px,
      py,
      this.x,
      this.y,
      this.radiusPx
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Export helpers                                                           */
  /* ------------------------------------------------------------------------ */

  /**
   * Serialize touch geometry for CSV and database export.
   *
   * Returns:
   *   Object containing touch center, diameter, radius and area in pixel units.
   *
   * Side effects:
   *   None.
   *
   * Related usage:
   *   The returned fields are merged into result rows before local CSV export
   *   or backend persistence.
   */
  toJSON() {
    return {
      touch_x: this.x,
      touch_y: this.y,
      touch_diameter_px: this.diameterPx,
      touch_radius_px: this.radiusPx,
      touch_area_px2: this.areaPx2,
    };
  }
}
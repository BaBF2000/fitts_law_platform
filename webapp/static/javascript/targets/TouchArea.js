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

function normalizeDiameter(value) {
  const diameter = Number(value);

  return Number.isFinite(diameter) && diameter > 0
    ? diameter
    : DEFAULT_TOUCH_DIAMETER_PX;
}

function pointInsideCircle(px, py, cx, cy, radius) {
  const dx = px - cx;
  const dy = py - cy;

  return dx * dx + dy * dy <= radius * radius;
}

function circleArea(radius) {
  return Math.PI * radius * radius;
}

/*
* -------------------------------------------------------------------------- 
* TouchArea                                                                  
* -------------------------------------------------------------------------- */

export class TouchArea {
  /**
   * Create one circular touch area.
   *
   * Coordinates are viewport CSS pixels.
   */
  constructor({
    x,
    y,
    diameterPx = DEFAULT_TOUCH_DIAMETER_PX,
  }) {
    this.x = Number(x);
    this.y = Number(y);

    this.diameterPx =
      normalizeDiameter(diameterPx);
  }

  /* ------------------------------------------------------------------------ */
  /* Derived geometry                                                         */
  /* ------------------------------------------------------------------------ */

  /**
   * Touch radius in CSS pixels.
   */
  get radiusPx() {
    return this.diameterPx / 2;
  }

  /**
   * Touch area in px².
   */
  get areaPx2() {
    return circleArea(this.radiusPx);
  }

  /* ------------------------------------------------------------------------ */
  /* Geometry queries                                                         */
  /* ------------------------------------------------------------------------ */

  /**
   * Test whether a point lies inside the touch area.
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
  /* Export Export helpers                                                    */
  /* ------------------------------------------------------------------------ */

  /**
   * Serialize touch geometry for CSV and database export.
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
import { DEFAULT_TOUCH_DIAMETER_PX } from "../core/constants.js";

export class TouchArea {
  /**
   * Represents the circular contact area of a finger/touch input.
   * /**
   * Important:
   * The touch area is modeled as a circle for overlap estimation.
   * Real finger contacts are more complex and device-dependent,
   * but the circular approximation provides a stable and reproducible model.
   *
   *
   * x/y are the center of the touch area in viewport CSS pixels.
   */
  constructor({ x, y, diameterPx = DEFAULT_TOUCH_DIAMETER_PX }) {
    this.x = Number(x);
    this.y = Number(y);

    this.diameterPx =
      Number.isFinite(Number(diameterPx)) && Number(diameterPx) > 0
        ? Number(diameterPx)
        : DEFAULT_TOUCH_DIAMETER_PX;
  }

  /**
   * Radius of the circular touch area in CSS pixels.
   */
  get radiusPx() {
    return this.diameterPx / 2;
  }

  /**
   * Area of the circular touch contact in px².
   */
  get areaPx2() {
    return Math.PI * this.radiusPx * this.radiusPx;
  }

  /**
   * Test whether a point lies inside the circular touch area.
   */
  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;

    return dx * dx + dy * dy <= this.radiusPx * this.radiusPx;
  }

  /**
   * Serialize touch geometry for CSV/database export.
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
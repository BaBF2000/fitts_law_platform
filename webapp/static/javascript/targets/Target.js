/**
 * Generic target model.
 *
 * Stores the target geometry, renders it into the DOM, validates touch overlap,
 * and computes the target width along the movement axis.
 *
 * The class is shape-aware:
 * - circle
 * - square / rectangular bands
 * - regular polygon-like CSS shapes
 *
 * Important:
 * widthPx may be increased internally to satisfy minimum visibility and
 * touchability constraints.
 */

import {
  DEFAULT_REQUIRED_OVERLAP,
  DEFAULT_TOUCH_DIAMETER_PX,
  OVERLAP_SAMPLE_STEP_PX,
} from "../core/constants.js";

import { getMinTargetSizePx } from "../modules/experimentConstraints.js";

import {
  pointInRect,
  pointInCircle,
  pointInPolygon,
  polygonFromPercentRect,
  clamp01,
  normalizeVector,
  lineCircleIntersections,
  lineRectIntersections,
  linePolygonIntersections,
  intersectionWidthFromHits,
} from "../core/geometry.js";

export class Target {
  constructor({
    shape = "circle",
    x = 0,
    y = 0,
    widthPx = 60,
    heightPx = null,
    touchDiameterPx = DEFAULT_TOUCH_DIAMETER_PX,
    requiredOverlap = DEFAULT_REQUIRED_OVERLAP,
  }) {
    this.shape = shape;
    this.x = Number(x);
    this.y = Number(y);

    this.touchDiameterPx = Number(touchDiameterPx) || DEFAULT_TOUCH_DIAMETER_PX;
    this.requiredOverlap = clamp01(requiredOverlap);

    const minSizePx = getMinTargetSizePx({
      touchDiameterPx: this.touchDiameterPx,
    });

    this.widthPx = Math.max(Number(widthPx) || minSizePx, minSizePx);
    this.heightPx = Math.max(Number(heightPx ?? widthPx) || minSizePx, minSizePx);
  }

  get left() {
    return this.x - this.widthPx / 2;
  }

  get top() {
    return this.y - this.heightPx / 2;
  }

  get rect() {
    return {
      left: this.left,
      top: this.top,
      width: this.widthPx,
      height: this.heightPx,
    };
  }

  getPolygonPercentVertices() {
    const polygons = {
      triangle: [[50, 0], [0, 100], [100, 100]],
      pentagon: [[50, 0], [95, 35], [78, 100], [22, 100], [5, 35]],
      hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
      octagon: [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]],
      diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
    };

    return polygons[this.shape] ?? null;
  }

  containsPoint(px, py) {
    const rect = this.rect;

    if (!pointInRect(px, py, rect)) return false;

    if (this.shape === "circle") {
      return pointInCircle(px, py, {
        cx: this.x,
        cy: this.y,
        r: Math.min(this.widthPx, this.heightPx) / 2,
      });
    }

    if (
      this.shape === "square" ||
      this.shape === "band1d_h" ||
      this.shape === "band1d_v"
    ) {
      return true;
    }

    const polygonPct = this.getPolygonPercentVertices();

    if (polygonPct) {
      const verts = polygonFromPercentRect(rect, polygonPct);
      return pointInPolygon(px, py, verts);
    }

    return true;
  }

  estimateOverlapWithTouch(touchArea, stepPx = OVERLAP_SAMPLE_STEP_PX) {
    const r = touchArea.radiusPx;

    let total = 0;
    let inside = 0;

    for (let dx = -r; dx <= r; dx += stepPx) {
      for (let dy = -r; dy <= r; dy += stepPx) {
        const px = touchArea.x + dx;
        const py = touchArea.y + dy;

        if (!touchArea.containsPoint(px, py)) continue;

        total += 1;

        if (this.containsPoint(px, py)) {
          inside += 1;
        }
      }
    }

    if (total === 0) return 0;

    return inside / total;
  }

  validateTouch(touchArea) {
    const measuredOverlap = this.estimateOverlapWithTouch(touchArea);
    const valid = measuredOverlap >= this.requiredOverlap;

    return {
      valid,
      measuredOverlap,
      requiredOverlap: this.requiredOverlap,
    };
  }

  render(element) {
    if (!element) return;
  
    if (element.id !== "target") {
      element.classList.add("dynamicTarget");
    }
  
    element.classList.remove(
      "shape-triangle",
      "shape-pentagon",
      "shape-hexagon",
      "shape-octagon",
      "shape-diamond",
      "shape-band1d_h",
      "shape-band1d_v"
    );
  
    if (this.shape === "circle") {
      element.style.borderRadius = "999px";
    } else if (this.shape === "square") {
      element.style.borderRadius = "12px";
    } else if (this.shape === "band1d_h" || this.shape === "band1d_v") {
      element.style.borderRadius = "12px";
      element.classList.add(`shape-${this.shape}`);
    } else {
      element.style.borderRadius = "0";
      element.classList.add(`shape-${this.shape}`);
    }
  
    element.style.width = `${this.widthPx}px`;
    element.style.height = `${this.heightPx}px`;
    element.style.left = `${this.x}px`;
    element.style.top = `${this.y}px`;
    element.style.display = "block";
  }

  getHitGeometryJSON() {
    const rect = this.rect;

    if (this.shape === "circle") {
      return {
        type: "circle",
        cx: this.x,
        cy: this.y,
        r: Math.min(this.widthPx, this.heightPx) / 2,
      };
    }

    const polygonPct = this.getPolygonPercentVertices();

    if (polygonPct) {
      return {
        type: "polygon",
        verts: polygonFromPercentRect(rect, polygonPct),
      };
    }

    return {
      type: "rect",
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  getWidthOnMovementAxis(fromX, fromY, toX, toY) {
    const dir = normalizeVector(toX - fromX, toY - fromY);
  
    if (!dir) {
      return {
        widthPx: NaN,
        c: null,
        d: null,
        axis_from_x: fromX,
        axis_from_y: fromY,
        axis_to_x: toX,
        axis_to_y: toY,
      };
    }
  
    const linePoint = { x: fromX, y: fromY };
    let hits = [];
  
    if (this.shape === "circle") {
      hits = lineCircleIntersections(linePoint, dir, {
        cx: this.x,
        cy: this.y,
        r: Math.min(this.widthPx, this.heightPx) / 2,
      });
    } else if (
      this.shape === "square" ||
      this.shape === "band1d_h" ||
      this.shape === "band1d_v"
    ) {
      hits = lineRectIntersections(linePoint, dir, this.rect);
    } else {
      const polygonPct = this.getPolygonPercentVertices();
  
      if (polygonPct) {
        const verts = polygonFromPercentRect(this.rect, polygonPct);
        hits = linePolygonIntersections(linePoint, dir, verts);
      } else {
        hits = lineRectIntersections(linePoint, dir, this.rect);
      }
    }
  
    const widthPx = intersectionWidthFromHits(hits);
  
    return {
      widthPx,
      c: hits[0] ?? null,
      d: hits[hits.length - 1] ?? null,
      axis_from_x: fromX,
      axis_from_y: fromY,
      axis_to_x: toX,
      axis_to_y: toY,
    };
  }

  toResultJSON() {
    return {
      target_shape: this.shape,
      target_x: this.x,
      target_y: this.y,
      target_width_px: this.widthPx,
      target_height_px: this.heightPx,
      required_overlap: this.requiredOverlap,
      target_hit_geom_json: JSON.stringify(this.getHitGeometryJSON()),
    };
  }
}
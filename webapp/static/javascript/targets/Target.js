/**
 * Generic target model.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Target Factory
 *   → Target Geometry
 *   → Touch Validation
 *   → Effective Width Calculation
 *
 * Responsibility:
 * This class represents one target during the experiment.
 *
 * It handles:
 * - geometric target description
 * - DOM rendering
 * - point-in-target checks
 * - touch-overlap validation
 * - hit geometry export
 * - effective target width on the movement axis
 *
 * Important:
 * This file does not create target positions.
 * Target placement is handled by the experiment engine.
 *
 * Extension guide:
 * To add a new target shape:
 * 1. Add polygon vertices in POLYGON_PERCENT_VERTICES if it is polygon-like.
 * 2. Add CSS support in style.css if the shape needs clip-path rendering.
 * 3. Update containsPoint() if the shape needs custom hit testing.
 * 4. Update getWidthOnMovementAxis() if the shape needs custom axis geometry.
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

/* -------------------------------------------------------------------------- */
/* Shape definitions                                                           */
/* -------------------------------------------------------------------------- */

const POLYGON_PERCENT_VERTICES = {
  triangle: [
    [50, 0],
    [0, 100],
    [100, 100],
  ],

  pentagon: [
    [50, 0],
    [95, 35],
    [78, 100],
    [22, 100],
    [5, 35],
  ],

  hexagon: [
    [25, 0],
    [75, 0],
    [100, 50],
    [75, 100],
    [25, 100],
    [0, 50],
  ],

  octagon: [
    [30, 0],
    [70, 0],
    [100, 30],
    [100, 70],
    [70, 100],
    [30, 100],
    [0, 70],
    [0, 30],
  ],

  diamond: [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ],
};

const CSS_SHAPE_CLASSES = [
  "shape-triangle",
  "shape-pentagon",
  "shape-hexagon",
  "shape-octagon",
  "shape-diamond",
  "shape-band1d_h",
  "shape-band1d_v",
];

function isCircle(shape) {
  return shape === "circle";
}

function isRectLike(shape) {
  return (
    shape === "square" ||
    shape === "band1d_h" ||
    shape === "band1d_v"
  );
}

function getPolygonPercentVertices(shape) {
  return POLYGON_PERCENT_VERTICES[shape] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

function buildCircleGeometry(target) {
  return {
    type: "circle",
    cx: target.x,
    cy: target.y,
    r: Math.min(target.widthPx, target.heightPx) / 2,
  };
}

function buildRectGeometry(target) {
  return {
    type: "rect",
    left: target.rect.left,
    top: target.rect.top,
    width: target.rect.width,
    height: target.rect.height,
  };
}

function buildPolygonGeometry(target) {
  const polygonPct =
    getPolygonPercentVertices(target.shape);

  if (!polygonPct) return null;

  return {
    type: "polygon",
    verts: polygonFromPercentRect(
      target.rect,
      polygonPct
    ),
  };
}

function getShapeClass(shape) {
  return `shape-${shape}`;
}

/* -------------------------------------------------------------------------- */
/* Target class                                                               */
/* -------------------------------------------------------------------------- */

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

    this.touchDiameterPx =
      Number(touchDiameterPx) ||
      DEFAULT_TOUCH_DIAMETER_PX;

    this.requiredOverlap =
      clamp01(requiredOverlap);

    const minSizePx =
      getMinTargetSizePx({
        touchDiameterPx: this.touchDiameterPx,
      });

    this.widthPx =
      Math.max(
        Number(widthPx) || minSizePx,
        minSizePx
      );

    this.heightPx =
      Math.max(
        Number(heightPx ?? widthPx) || minSizePx,
        minSizePx
      );
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
    return getPolygonPercentVertices(this.shape);
  }

  /* ------------------------------------------------------------------------ */
  /* Hit testing                                                              */
  /* ------------------------------------------------------------------------ */

  containsPoint(px, py) {
    const rect = this.rect;

    if (!pointInRect(px, py, rect)) {
      return false;
    }

    if (isCircle(this.shape)) {
      return pointInCircle(px, py, {
        cx: this.x,
        cy: this.y,
        r: Math.min(this.widthPx, this.heightPx) / 2,
      });
    }

    if (isRectLike(this.shape)) {
      return true;
    }

    const polygonPct =
      this.getPolygonPercentVertices();

    if (polygonPct) {
      const verts =
        polygonFromPercentRect(rect, polygonPct);

      return pointInPolygon(px, py, verts);
    }

    return true;
  }

  /**
   * Estimate how much of a circular touch area overlaps this target.
   *
   * The estimation uses point sampling. This is fast enough for runtime
   * validation and independent of the concrete target shape.
   */
  estimateOverlapWithTouch(
    touchArea,
    stepPx = OVERLAP_SAMPLE_STEP_PX
  ) {
    const r = touchArea.radiusPx;

    let total = 0;
    let inside = 0;

    for (let dx = -r; dx <= r; dx += stepPx) {
      for (let dy = -r; dy <= r; dy += stepPx) {
        const px = touchArea.x + dx;
        const py = touchArea.y + dy;

        if (!touchArea.containsPoint(px, py)) {
          continue;
        }

        total += 1;

        if (this.containsPoint(px, py)) {
          inside += 1;
        }
      }
    }

    return total === 0
      ? 0
      : inside / total;
  }

  validateTouch(touchArea) {
    const measuredOverlap =
      this.estimateOverlapWithTouch(touchArea);

    return {
      valid: measuredOverlap >= this.requiredOverlap,
      measuredOverlap,
      requiredOverlap: this.requiredOverlap,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* DOM rendering                                                            */
  /* ------------------------------------------------------------------------ */

  render(element) {
    if (!element) return;

    if (element.id !== "target") {
      element.classList.add("dynamicTarget");
    }

    element.classList.remove(...CSS_SHAPE_CLASSES);

    if (isCircle(this.shape)) {
      element.style.borderRadius = "999px";
    } else if (this.shape === "square") {
      element.style.borderRadius = "12px";
    } else if (isRectLike(this.shape)) {
      element.style.borderRadius = "12px";
      element.classList.add(getShapeClass(this.shape));
    } else {
      element.style.borderRadius = "0";
      element.classList.add(getShapeClass(this.shape));
    }

    element.style.width = `${this.widthPx}px`;
    element.style.height = `${this.heightPx}px`;
    element.style.left = `${this.x}px`;
    element.style.top = `${this.y}px`;
    element.style.display = "block";
  }

  /* ------------------------------------------------------------------------ */
  /* Export geometry                                                          */
  /* ------------------------------------------------------------------------ */

  getHitGeometryJSON() {
    if (isCircle(this.shape)) {
      return buildCircleGeometry(this);
    }

    const polygon =
      buildPolygonGeometry(this);

    if (polygon) {
      return polygon;
    }

    return buildRectGeometry(this);
  }

  /* ------------------------------------------------------------------------ */
  /* Effective width on movement axis                                         */
  /* ------------------------------------------------------------------------ */

  getWidthOnMovementAxis(fromX, fromY, toX, toY) {
    const dir =
      normalizeVector(toX - fromX, toY - fromY);

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

    const linePoint = {
      x: fromX,
      y: fromY,
    };

    let hits = [];

    if (isCircle(this.shape)) {
      hits = lineCircleIntersections(
        linePoint,
        dir,
        {
          cx: this.x,
          cy: this.y,
          r: Math.min(this.widthPx, this.heightPx) / 2,
        }
      );
    } else if (isRectLike(this.shape)) {
      hits =
        lineRectIntersections(
          linePoint,
          dir,
          this.rect
        );
    } else {
      const polygonPct =
        this.getPolygonPercentVertices();

      if (polygonPct) {
        const verts =
          polygonFromPercentRect(
            this.rect,
            polygonPct
          );

        hits =
          linePolygonIntersections(
            linePoint,
            dir,
            verts
          );
      } else {
        hits =
          lineRectIntersections(
            linePoint,
            dir,
            this.rect
          );
      }
    }

    return {
      widthPx: intersectionWidthFromHits(hits),
      c: hits[0] ?? null,
      d: hits[hits.length - 1] ?? null,
      axis_from_x: fromX,
      axis_from_y: fromY,
      axis_to_x: toX,
      axis_to_y: toY,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Result export                                                            */
  /* ------------------------------------------------------------------------ */

  toResultJSON() {
    return {
      target_shape: this.shape,
      target_x: this.x,
      target_y: this.y,
      target_width_px: this.widthPx,
      target_height_px: this.heightPx,
      required_overlap: this.requiredOverlap,
      target_hit_geom_json:
        JSON.stringify(this.getHitGeometryJSON()),
    };
  }
}
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
/* Shape definitions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Polygon-like target shapes expressed as percentages of the target rectangle.
 *
 * Coordinates are defined in a 100 × 100 local coordinate system:
 * - x = 0 means left edge of the target rectangle
 * - x = 100 means right edge
 * - y = 0 means top edge
 * - y = 100 means bottom edge
 *
 * These percentage vertices are converted to absolute pixel coordinates by
 * polygonFromPercentRect().
 */
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

/**
 * CSS classes that represent non-default target shapes.
 *
 * These classes are removed before each render() call so that a reused DOM
 * element does not keep the previous target shape.
 */
const CSS_SHAPE_CLASSES = [
  "shape-triangle",
  "shape-pentagon",
  "shape-hexagon",
  "shape-octagon",
  "shape-diamond",
  "shape-band1d_h",
  "shape-band1d_v",
];

/**
 * Check whether a target shape is a circle.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true if the shape is "circle", otherwise false.
 *
 * Side effects:
 *   None.
 */
function isCircle(shape) {
  return shape === "circle";
}

/**
 * Check whether a target shape can be treated as a rectangle.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true for square targets and 1D band targets, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   1D bands are geometrically rectangular for hit testing and effective-width
 *   calculations, even though their size is adjusted by TargetFactory.
 */
function isRectLike(shape) {
  return (
    shape === "square" ||
    shape === "band1d_h" ||
    shape === "band1d_v"
  );
}

/**
 * Return percentage-based polygon vertices for a polygon-like target shape.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   Array of percentage vertices, or null if the shape is not polygon-like.
 *
 * Side effects:
 *   None.
 */
function getPolygonPercentVertices(shape) {
  return POLYGON_PERCENT_VERTICES[shape] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Build a serializable circle geometry description for a target.
 *
 * Args:
 *   target: Target instance.
 *
 * Returns:
 *   Object describing a circle with type, center and radius.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used by getHitGeometryJSON() for result export.
 */
function buildCircleGeometry(target) {
  return {
    type: "circle",
    cx: target.x,
    cy: target.y,
    r: Math.min(target.widthPx, target.heightPx) / 2,
  };
}

/**
 * Build a serializable rectangle geometry description for a target.
 *
 * Args:
 *   target: Target instance.
 *
 * Returns:
 *   Object describing a rectangle with type, left, top, width and height.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used as export geometry for square, band and fallback target shapes.
 */
function buildRectGeometry(target) {
  return {
    type: "rect",
    left: target.rect.left,
    top: target.rect.top,
    width: target.rect.width,
    height: target.rect.height,
  };
}

/**
 * Build a serializable polygon geometry description for a target.
 *
 * Args:
 *   target: Target instance.
 *
 * Returns:
 *   Object with type="polygon" and absolute pixel vertices, or null if the
 *   target shape has no polygon definition.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used for polygon-like target export and hit geometry inspection.
 */
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

/**
 * Build the CSS class name for a target shape.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   CSS class name such as "shape-triangle" or "shape-band1d_h".
 *
 * Side effects:
 *   None.
 */
function getShapeClass(shape) {
  return `shape-${shape}`;
}

/* -------------------------------------------------------------------------- */
/* Target class                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Runtime representation of one experiment target.
 *
 * Responsibility:
 * Stores target shape, position, dimensions, touch validation parameters and
 * provides geometry, rendering, hit-testing and export methods.
 *
 * Important:
 * Target positions are expected to be resolved before construction, usually by
 * the experiment engine and TargetFactory.
 */
export class Target {
  /**
   * Create one target instance.
   *
   * Args:
   *   shape: Target shape identifier. Defaults to "circle".
   *   x: Target center x-coordinate in viewport CSS pixels.
   *   y: Target center y-coordinate in viewport CSS pixels.
   *   widthPx: Target width in CSS pixels.
   *   heightPx: Target height in CSS pixels. Defaults to widthPx.
   *   touchDiameterPx: Touch/finger diameter used to derive minimum target size.
   *   requiredOverlap: Required overlap ratio between touch area and target.
   *
   * Side effects:
   *   None.
   *
   * Behavior:
   *   - Coordinates are converted to numbers.
   *   - requiredOverlap is clamped to [0, 1].
   *   - Target width/height are never smaller than getMinTargetSizePx().
   */
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

    // Store target center coordinates as numeric values.
    this.x = Number(x);
    this.y = Number(y);

    // Normalize the touch diameter used for size constraints and validation.
    this.touchDiameterPx =
      Number(touchDiameterPx) ||
      DEFAULT_TOUCH_DIAMETER_PX;

    // Required overlap is always constrained to the valid ratio range.
    this.requiredOverlap =
      clamp01(requiredOverlap);

    // Compute the minimum target size from the current touch model and
    // experiment constraints.
    const minSizePx =
      getMinTargetSizePx({
        touchDiameterPx: this.touchDiameterPx,
      });

    // Width and height are normalized independently, but both respect the same
    // minimum size to preserve touchability.
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

  /**
   * Left edge of the target bounding box.
   *
   * Returns:
   *   x-coordinate of the left edge in CSS pixels.
   *
   * Side effects:
   *   None.
   */
  get left() {
    return this.x - this.widthPx / 2;
  }

  /**
   * Top edge of the target bounding box.
   *
   * Returns:
   *   y-coordinate of the top edge in CSS pixels.
   *
   * Side effects:
   *   None.
   */
  get top() {
    return this.y - this.heightPx / 2;
  }

  /**
   * Axis-aligned bounding rectangle of the target.
   *
   * Returns:
   *   Object with left, top, width and height in CSS pixels.
   *
   * Side effects:
   *   None.
   *
   * Related usage:
   *   Used for rectangle hit testing, polygon conversion and export geometry.
   */
  get rect() {
    return {
      left: this.left,
      top: this.top,
      width: this.widthPx,
      height: this.heightPx,
    };
  }

  /**
   * Return percentage vertices for this target's polygon shape.
   *
   * Returns:
   *   Polygon vertices in percentage coordinates, or null if this target is not
   *   polygon-like.
   *
   * Side effects:
   *   None.
   */
  getPolygonPercentVertices() {
    return getPolygonPercentVertices(this.shape);
  }

  /* ------------------------------------------------------------------------ */
  /* Hit testing                                                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Check whether a point lies inside the target.
   *
   * Args:
   *   px: Point x-coordinate in CSS pixels.
   *   py: Point y-coordinate in CSS pixels.
   *
   * Returns:
   *   true if the point lies inside the target geometry, otherwise false.
   *
   * Side effects:
   *   None.
   *
   * Behavior:
   *   - First checks the bounding rectangle as a fast rejection test.
   *   - Circles use circle hit testing.
   *   - Square and 1D band shapes use rectangle hit testing.
   *   - Polygon-like shapes use polygon hit testing.
   *   - Unknown shapes fall back to the bounding rectangle.
   */
  containsPoint(px, py) {
    const rect = this.rect;

    // Fast rejection: if the point is outside the bounding box, it cannot be
    // inside any supported target shape.
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

    // Fallback for unknown shapes: the bounding rectangle is treated as the hit
    // area so the target remains usable.
    return true;
  }

  /**
   * Estimate how much of a circular touch area overlaps this target.
   *
   * Args:
   *   touchArea: TouchArea instance representing the finger contact circle.
   *   stepPx: Sampling step in CSS pixels. Defaults to OVERLAP_SAMPLE_STEP_PX.
   *
   * Returns:
   *   Estimated overlap ratio in the range [0, 1].
   *
   * Side effects:
   *   None.
   *
   * Behavior:
   *   The touch circle is sampled on a regular grid. Points outside the touch
   *   circle are ignored. The ratio of sampled touch points that also lie inside
   *   the target is returned.
   *
   * Notes:
   *   This is an approximation. Smaller step sizes increase precision but also
   *   increase runtime cost.
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

        // Only sample points that are actually part of the circular touch area.
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

  /**
   * Validate whether a touch area satisfies the required overlap.
   *
   * Args:
   *   touchArea: TouchArea instance to validate against this target.
   *
   * Returns:
   *   Object containing:
   *   - valid: true if measured overlap is sufficient
   *   - measuredOverlap: estimated overlap ratio
   *   - requiredOverlap: configured overlap threshold
   *
   * Side effects:
   *   None.
   *
   * Related usage:
   *   Used during runtime hit validation.
   */
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

  /**
   * Render this target into an existing DOM element.
   *
   * Args:
   *   element: DOM element used to display the target.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Mutates the DOM element's classes and inline styles.
   *
   * Behavior:
   *   - Adds a dynamicTarget class for non-primary target elements.
   *   - Removes previous shape classes before applying the current shape.
   *   - Applies border radius and CSS shape class depending on target shape.
   *   - Sets width, height, left, top and display style.
   *
   * Important:
   *   The CSS positioning assumes that left/top refer to the target center.
   *   The corresponding stylesheet must therefore use a centering transform
   *   such as translate(-50%, -50%).
   */
  render(element) {
    if (!element) return;

    if (element.id !== "target") {
      element.classList.add("dynamicTarget");
    }

    // Remove all previously applied shape classes before rendering this target.
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

  /**
   * Build a serializable geometry description of this target.
   *
   * Returns:
   *   Geometry object describing the target as a circle, polygon or rectangle.
   *
   * Side effects:
   *   None.
   *
   * Behavior:
   *   - Circle targets export circle geometry.
   *   - Polygon-like targets export absolute polygon vertices.
   *   - Square, band and unknown shapes export rectangle geometry.
   *
   * Related usage:
   *   The returned object is serialized into target_hit_geom_json.
   */
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

  /**
   * Compute the target width along the movement axis.
   *
   * Args:
   *   fromX: Movement start x-coordinate in CSS pixels.
   *   fromY: Movement start y-coordinate in CSS pixels.
   *   toX: Movement end x-coordinate in CSS pixels.
   *   toY: Movement end y-coordinate in CSS pixels.
   *
   * Returns:
   *   Object containing:
   *   - widthPx: geometric target width along the movement axis, or NaN
   *   - c: first intersection point on the target boundary, or null
   *   - d: last intersection point on the target boundary, or null
   *   - axis_from_x / axis_from_y: movement axis start point
   *   - axis_to_x / axis_to_y: movement axis end point
   *
   * Side effects:
   *   None.
   *
   * Behavior:
   *   The movement direction is normalized and used as an infinite line.
   *   The function intersects this line with the target boundary and measures
   *   the distance between the first and last intersection.
   *
   * Notes:
   *   If the movement axis is invalid or has zero length, widthPx is NaN.
   */
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
        // Fallback for unknown shapes: use the bounding rectangle.
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

  /**
   * Serialize target information for result rows.
   *
   * Returns:
   *   Object containing target shape, position, dimensions, overlap threshold
   *   and serialized hit geometry.
   *
   * Side effects:
   *   None.
   *
   * Related usage:
   *   The returned fields are merged into trial result rows before local CSV
   *   export and backend persistence.
   */
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
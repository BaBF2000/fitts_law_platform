/**
 * Geometry helpers.
 *
 * Organigram reference:
 * - Core Utilities
 *   → Geometry Engine
 * - Target System
 *   → Hit Testing
 *   → Effective Width Calculation
 *
 * Responsibility:
 * Provides pure geometry functions used by the target system.
 *
 * This module is intentionally DOM-free:
 * it only works with numeric points, rectangles, circles and polygons.
 *
 * Used for:
 * - point-in-shape tests
 * - touch overlap estimation
 * - target width on the movement axis
 * - debug geometry calculations
 *
 * Extension guide:
 * - To add a new target shape: add reusable geometry helpers here only
 *   if the shape requires new mathematical operations.
 * - Shape-specific decisions should stay in targets/Target.js.
 */

// Numeric tolerance used to treat nearly parallel lines as parallel and to
// avoid unstable floating-point comparisons.
const EPSILON = 1e-9;

// Distance threshold used to merge duplicate polygon intersection points,
// especially when a line crosses exactly through a polygon vertex.
const DUPLICATE_HIT_EPSILON = 0.001;

/**
 * Check whether a point lies inside an axis-aligned rectangle.
 *
 * Args:
 *   px: Point x-coordinate.
 *   py: Point y-coordinate.
 *   rect: Rectangle object with left, top, width and height.
 *
 * Returns:
 *   true if the point lies inside or on the rectangle boundary.
 *
 * Side effects:
 *   None.
 */
export function pointInRect(px, py, rect) {
  return (
    px >= rect.left &&
    px <= rect.left + rect.width &&
    py >= rect.top &&
    py <= rect.top + rect.height
  );
}

/**
 * Check whether a point lies inside a circle.
 *
 * Args:
 *   px: Point x-coordinate.
 *   py: Point y-coordinate.
 *   circle: Circle object with cx, cy and r.
 *
 * Returns:
 *   true if the point lies inside or on the circle boundary.
 *
 * Side effects:
 *   None.
 */
export function pointInCircle(px, py, circle) {
  const dx = px - circle.cx;
  const dy = py - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/**
 * Check whether a point lies inside a polygon using the ray-casting algorithm.
 *
 * Args:
 *   px: Point x-coordinate.
 *   py: Point y-coordinate.
 *   verts: Polygon vertices as [[x1, y1], [x2, y2], ...].
 *
 * Returns:
 *   true if the point is classified as inside the polygon.
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   Boundary behavior depends on the ray-casting edge cases and should be
 *   interpreted consistently with the target hit-testing logic.
 */
export function pointInPolygon(px, py, verts) {
  let inside = false;

  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i][0];
    const yi = verts[i][1];
    const xj = verts[j][0];
    const yj = verts[j][1];

    const intersect =
      ((yi > py) !== (yj > py)) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Convert polygon vertices expressed as percentages of a rectangle
 * into absolute pixel coordinates.
 */
export function polygonFromPercentRect(rect, percentVerts) {
  return percentVerts.map(([x, y]) => [
    rect.left + (x / 100) * rect.width,
    rect.top + (y / 100) * rect.height,
  ]);
}

/**
 * Clamp a numeric value to the [0, 1] interval.
 */
export function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v)));
}

/**
 * Normalize a 2D vector.
 *
 * Args:
 *   dx: Vector x-component.
 *   dy: Vector y-component.
 *
 * Returns:
 *   Object { x, y } with unit length, or null when the vector length is zero
 *   or invalid.
 *
 * Side effects:
 *   None.
 */
export function normalizeVector(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len <= 0) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * Compute the Euclidean distance between two points.
 */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Compute intersections between an infinite line and a circle.
 *
 * Args:
 *   point: One point on the line as { x, y }.
 *   dir: Line direction vector as { x, y }. It may be normalized or
 *     non-normalized.
 *   circle: Circle object with cx, cy and r.
 *
 * Returns:
 *   Array with zero, one or two intersection points. Each returned point also
 *   contains parameter t along the line direction.
 *
 * Side effects:
 *   None.
 *
 * Important:
 *   The line is treated as infinite. This function does not restrict
 *   intersections to a finite segment.
 */
export function lineCircleIntersections(point, dir, circle) {
  const fx = point.x - circle.cx;
  const fy = point.y - circle.cy;

  const a = dir.x * dir.x + dir.y * dir.y;
  if (a < EPSILON) return [];
  const b = 2 * (fx * dir.x + fy * dir.y);
  const c = fx * fx + fy * fy - circle.r * circle.r;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  return [
    { x: point.x + t1 * dir.x, y: point.y + t1 * dir.y, t: t1 },
    { x: point.x + t2 * dir.x, y: point.y + t2 * dir.y, t: t2 },
  ];
}

/**
 * Compute the intersection between an infinite line and a finite segment.
 *
 * Args:
 *   linePoint: One point on the infinite line as { x, y }.
 *   lineDir: Direction vector of the infinite line as { x, y }.
 *   a: Segment start point as { x, y }.
 *   b: Segment end point as { x, y }.
 *
 * Returns:
 *   Intersection point with parameter t along the infinite line, or null if the
 *   line and segment are parallel or if the intersection lies outside the
 *   segment.
 *
 * Side effects:
 *   None.
 */
export function lineSegmentIntersection(linePoint, lineDir, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;

  const det = lineDir.x * (-vy) - lineDir.y * (-vx);
  if (Math.abs(det) < EPSILON) return null;

  const dx = a.x - linePoint.x;
  const dy = a.y - linePoint.y;

  const t = (dx * (-vy) - dy * (-vx)) / det;
  const u = (lineDir.x * dy - lineDir.y * dx) / det;

  if (u < -EPSILON || u > 1 + EPSILON) return null;

  return {
    x: linePoint.x + t * lineDir.x,
    y: linePoint.y + t * lineDir.y,
    t,
  };
}

/**
 * Compute all intersections between an infinite line and a polygon boundary.
 *
 * Args:
 *   linePoint: One point on the infinite line as { x, y }.
 *   lineDir: Direction vector of the infinite line as { x, y }.
 *   verts: Polygon vertices as [[x1, y1], [x2, y2], ...].
 *
 * Returns:
 *   Array of intersection points sorted by their t parameter along the line.
 *
 * Side effects:
 *   None.
 *
 * Notes:
 *   Duplicate hits are removed to avoid double-counting polygon vertices when
 *   the line passes exactly through a corner.
 */
export function linePolygonIntersections(linePoint, lineDir, verts) {
  const hits = [];

  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length;

    const hit = lineSegmentIntersection(
      linePoint,
      lineDir,
      { x: verts[i][0], y: verts[i][1] },
      { x: verts[j][0], y: verts[j][1] }
    );

    if (hit) {
      const duplicate = hits.some(
        (h) => Math.hypot(h.x - hit.x, h.y - hit.y) < DUPLICATE_HIT_EPSILON
      );

      if (!duplicate) hits.push(hit);
    }
  }

  return hits.sort((a, b) => a.t - b.t);
}

/**
 * Compute intersections between an infinite line and a rectangle boundary.
 */
export function lineRectIntersections(linePoint, lineDir, rect) {
  const verts = [
    [rect.left, rect.top],
    [rect.left + rect.width, rect.top],
    [rect.left + rect.width, rect.top + rect.height],
    [rect.left, rect.top + rect.height],
  ];

  return linePolygonIntersections(linePoint, lineDir, verts);
}

/**
 * Compute the geometric width between the first and last intersection point.
 *
 * Args:
 *   hits: Sorted line/shape intersection points, usually returned by one of
 *   the line*Intersections() helpers.
 *
 * Returns:
 *   Distance between the first and last hit, or NaN if fewer than two hits are
 *   available.
 *
 * Side effects:
 *   None.
 *
 * Related usage:
 *   Used to estimate target width along the movement axis for effective Fitts
 *   parameter calculations.
 */
export function intersectionWidthFromHits(hits) {
  if (!hits || hits.length < 2) return NaN;

  const first = hits[0];
  const last = hits[hits.length - 1];

  return Math.hypot(last.x - first.x, last.y - first.y);
}
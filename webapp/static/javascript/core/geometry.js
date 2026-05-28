/**
 * Check whether a point lies inside an axis-aligned rectangle.
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
 */
export function pointInCircle(px, py, circle) {
  const dx = px - circle.cx;
  const dy = py - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/**
 * Check whether a point lies inside a polygon using the ray-casting algorithm.
 *
 * verts format:
 * [
 *   [x1, y1],
 *   [x2, y2],
 *   ...
 * ]
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
 * Returns null when the vector length is invalid or zero.
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
 * Compute the intersections between an infinite line and a circle.
 *
 * line:
 * - point: one point on the line
 * - dir: normalized or non-normalized direction vector
 *
 * Returns zero, one, or two intersection points.
 */
export function lineCircleIntersections(point, dir, circle) {
  const fx = point.x - circle.cx;
  const fy = point.y - circle.cy;

  const a = dir.x * dir.x + dir.y * dir.y;
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
 * Returns null when the line and segment are parallel or when the
 * intersection lies outside the segment.
 */
export function lineSegmentIntersection(linePoint, lineDir, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;

  const det = lineDir.x * (-vy) - lineDir.y * (-vx);
  if (Math.abs(det) < 1e-9) return null;

  const dx = a.x - linePoint.x;
  const dy = a.y - linePoint.y;

  const t = (dx * (-vy) - dy * (-vx)) / det;
  const u = (lineDir.x * dy - lineDir.y * dx) / det;

  if (u < -1e-9 || u > 1 + 1e-9) return null;

  return {
    x: linePoint.x + t * lineDir.x,
    y: linePoint.y + t * lineDir.y,
    t,
  };
}

/**
 * Compute all intersections between an infinite line and a polygon boundary.
 *
 * Duplicate hits are removed to avoid double-counting polygon vertices.
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
        (h) => Math.hypot(h.x - hit.x, h.y - hit.y) < 0.001
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
 * This is useful for estimating the target width along the movement axis.
 */
export function intersectionWidthFromHits(hits) {
  if (!hits || hits.length < 2) return NaN;

  const first = hits[0];
  const last = hits[hits.length - 1];

  return Math.hypot(last.x - first.x, last.y - first.y);
}
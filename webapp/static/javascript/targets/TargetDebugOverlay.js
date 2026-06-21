/**
 * Target debug overlay.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Target Debugging
 *   → Geometry Visualization
 *
 * Responsibility:
 * Draws an SVG overlay for inspecting target geometry during development.
 *
 * It visualizes:
 * - planned movement axis A-B
 * - planned target width C-D
 * - effective target width E-F
 * - optional touch area T
 *
 * Important:
 * This module is only used when targetDebug=1 is active.
 * It must not affect experiment measurements.
 *
 * Extension guide:
 * - To add a new debug primitive: add a draw* helper.
 * - To change ABCD visualization: edit drawABCD().
 */

import {
  getViewportSize,
} from "../core/helpers.js";

/**
 * Create an SVG element in the correct XML namespace.
 *
 * Args:
 *   tag: SVG tag name, for example "svg", "line", "circle" or "text".
 *
 * Returns:
 *   Newly created SVGElement.
 *
 * Side effects:
 *   None. The element is created but not inserted into the DOM.
 *
 * Purpose:
 *   SVG elements must be created with createElementNS(), not with
 *   document.createElement().
 */
function createSvgElement(tag) {
  return document.createElementNS(
    "http://www.w3.org/2000/svg",
    tag
  );
}

/**
 * Development overlay for visualizing target geometry.
 *
 * Responsibility:
 * Creates and updates an SVG overlay above the experiment UI. The overlay is
 * used only for debugging geometry and must not influence target placement,
 * hit validation or timing measurements.
 */
export class TargetDebugOverlay {
  /**
   * Create an empty debug overlay controller.
   *
   * Side effects:
   *   None. The SVG element is created lazily by ensureSvg().
   */
  constructor() {
    // Lazily created SVG overlay element.
    this.svg = null;
  }

  /**
   * Ensure that the SVG overlay exists.
   *
   * Returns:
   *   SVG overlay element.
   *
   * Side effects:
   *   May create an SVG element, style it, append it to document.body and update
   *   its viewport size.
   *
   * Behavior:
   *   If the overlay already exists, only its viewport size is refreshed.
   */
  ensureSvg() {
    if (this.svg) {
      this.updateViewportSize();
      return this.svg;
    }

    const svg = createSvgElement("svg");

    svg.id = "targetDebugOverlay";

    // Fixed fullscreen overlay. pointer-events:none ensures that the debug
    // visualization never blocks experiment interaction.
    svg.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "pointer-events:none",
      "z-index:999999",
      "display:none",
    ].join(";");

    document.body.appendChild(svg);

    this.svg = svg;
    this.updateViewportSize();

    return svg;
  }

  /**
   * Synchronize the SVG overlay size with the current viewport.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Updates SVG width, height, viewBox and CSS dimensions.
   *
   * Related usage:
   *   Called before drawing to keep debug coordinates aligned with viewport
   *   CSS pixel coordinates.
   */
  updateViewportSize() {
    if (!this.svg) return;

    const {
      width,
      height,
    } = getViewportSize();

    // Use the same coordinate system as the experiment viewport.
    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    this.svg.style.width = `${width}px`;
    this.svg.style.height = `${height}px`;
  }

  /**
   * Remove all debug drawings and hide the overlay.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Clears SVG contents and hides the overlay if it exists.
   */
  clear() {
    if (!this.svg) return;

    this.svg.innerHTML = "";
    this.svg.style.display = "none";
  }

  /**
   * Draw a line segment on the debug overlay.
   *
   * Args:
   *   x1: Start x-coordinate in CSS pixels.
   *   y1: Start y-coordinate in CSS pixels.
   *   x2: End x-coordinate in CSS pixels.
   *   y2: End y-coordinate in CSS pixels.
   *   stroke: SVG stroke color.
   *   width: SVG stroke width in pixels.
   *   dash: Optional stroke-dasharray string.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Ensures the SVG overlay exists and appends a line element.
   */
  drawLine({
    x1,
    y1,
    x2,
    y2,
    stroke = "lime",
    width = 2,
    dash = "",
  }) {
    const svg = this.ensureSvg();
    const line = createSvgElement("line");

    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", String(width));

    if (dash) {
      line.setAttribute("stroke-dasharray", dash);
    }

    svg.appendChild(line);
  }

  /**
   * Draw a labeled point on the debug overlay.
   *
   * Args:
   *   x: Point x-coordinate in CSS pixels.
   *   y: Point y-coordinate in CSS pixels.
   *   label: Text label shown next to the point.
   *   fill: Point and label color.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Ensures the SVG overlay exists and appends a circle and text element.
   */
  drawPoint({
    x,
    y,
    label,
    fill = "white",
  }) {
    const svg = this.ensureSvg();

    const circle = createSvgElement("circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "5");
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", "black");
    circle.setAttribute("stroke-width", "2");

    const text = createSvgElement("text");
    text.setAttribute("x", String(x + 8));
    text.setAttribute("y", String(y - 8));
    text.setAttribute("fill", fill);
    text.setAttribute("font-size", "14");
    text.setAttribute("font-weight", "700");
    text.textContent = label;

    svg.appendChild(circle);
    svg.appendChild(text);
  }

  /**
   * Draw readable debug text on the overlay.
   *
   * Args:
   *   x: Text x-coordinate in CSS pixels.
   *   y: Text y-coordinate in CSS pixels.
   *   text: Text content to display.
   *   fill: Text fill color.
   *   size: Font size in pixels.
   *   weight: Font weight.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Ensures the SVG overlay exists and appends a text element.
   *
   * Notes:
   *   A black stroke is used behind the text to keep labels readable on top of
   *   different target/background colors.
   */
  drawText({
    x,
    y,
    text,
    fill = "yellow",
    size = 14,
    weight = 700,
  }) {
    const svg = this.ensureSvg();
    const el = createSvgElement("text");

    el.setAttribute("x", String(x));
    el.setAttribute("y", String(y));
    el.setAttribute("fill", fill);
    el.setAttribute("font-size", String(size));
    el.setAttribute("font-weight", String(weight));
    el.setAttribute("paint-order", "stroke");
    el.setAttribute("stroke", "black");
    el.setAttribute("stroke-width", "3");
    el.setAttribute("stroke-linejoin", "round");
    el.textContent = text;

    svg.appendChild(el);
  }

  /**
   * Draw a circular touch area on the debug overlay.
   *
   * Args:
   *   x: Touch center x-coordinate in CSS pixels.
   *   y: Touch center y-coordinate in CSS pixels.
   *   radius: Touch radius in CSS pixels.
   *   fill: SVG fill color.
   *   stroke: SVG stroke color.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Ensures the SVG overlay exists and appends a circle element.
   *
   * Related usage:
   *   Used to visualize the circular TouchArea model during validation
   *   debugging.
   */
  drawTouchArea({
    x,
    y,
    radius,
    fill = "rgba(0,150,255,0.20)",
    stroke = "cyan",
  }) {
    const svg = this.ensureSvg();
    const circle = createSvgElement("circle");

    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", stroke);
    circle.setAttribute("stroke-width", "3");

    svg.appendChild(circle);
  }

  /**
   * Draw the planned movement axis A-B.
   *
   * Args:
   *   a: Start point of the movement axis as { x, y }.
   *   b: End point of the movement axis as { x, y }.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Draws a dashed line, point labels A/B and the measured amplitude text.
   *
   * Behavior:
   *   If either point is missing, nothing is drawn.
   */
  drawMovementAxis(a, b) {
    if (!a || !b) return;

    const Apx =
      Math.hypot(b.x - a.x, b.y - a.y);

    this.drawLine({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: "lime",
      width: 2,
      dash: "8 6",
    });

    this.drawPoint({
      x: a.x,
      y: a.y,
      label: "A",
      fill: "lime",
    });

    this.drawPoint({
      x: b.x,
      y: b.y,
      label: "B",
      fill: "lime",
    });

    this.drawText({
      x: (a.x + b.x) / 2 + 10,
      y: (a.y + b.y) / 2 - 10,
      text: `A = ${Apx.toFixed(1)} px`,
      fill: "lime",
    });
  }

  /**
   * Draw a target-width segment on the debug overlay.
   *
   * Args:
   *   c: Start point of the width segment as { x, y }.
   *   d: End point of the width segment as { x, y }.
   *   labelStart: Label for the start point.
   *   labelEnd: Label for the end point.
   *   text: Prefix used for the width label.
   *   stroke: Segment line color.
   *   fill: Point and text color.
   *   dash: Optional stroke-dasharray string.
   *   textOffsetY: Vertical offset for the width label.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Draws a line, two labeled points and a width text label.
   *
   * Behavior:
   *   If either endpoint is missing, nothing is drawn.
   */
  drawWidthSegment({
    c,
    d,
    labelStart,
    labelEnd,
    text,
    stroke,
    fill,
    dash = "",
    textOffsetY = 18,
  }) {
    if (!c || !d) return;

    const widthPx =
      Math.hypot(d.x - c.x, d.y - c.y);

    this.drawLine({
      x1: c.x,
      y1: c.y,
      x2: d.x,
      y2: d.y,
      stroke,
      width: 4,
      dash,
    });

    this.drawPoint({
      x: c.x,
      y: c.y,
      label: labelStart,
      fill,
    });

    this.drawPoint({
      x: d.x,
      y: d.y,
      label: labelEnd,
      fill,
    });

    this.drawText({
      x: (c.x + d.x) / 2 + 10,
      y: (c.y + d.y) / 2 + textOffsetY,
      text: `${text} = ${widthPx.toFixed(1)} px`,
      fill,
    });
  }

  /**
   * Draw touch-area debug information.
   *
   * Args:
   *   touchArea: TouchArea instance, or null if no touch should be visualized.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Draws the circular touch area, center point T and touch diameter label.
   *
   * Behavior:
   *   If touchArea is missing, nothing is drawn.
   */
  drawTouchDebug(touchArea) {
    if (!touchArea) return;

    this.drawTouchArea({
      x: touchArea.x,
      y: touchArea.y,
      radius: touchArea.radiusPx,
    });

    this.drawPoint({
      x: touchArea.x,
      y: touchArea.y,
      label: "T",
      fill: "cyan",
    });

    this.drawText({
      x: touchArea.x + touchArea.radiusPx + 8,
      y: touchArea.y + 4,
      text: `touch Ø = ${touchArea.diameterPx.toFixed(1)} px`,
      fill: "cyan",
    });
  }

  /**
   * Draw the complete ABCD/EF target geometry debug visualization.
   *
   * Args:
   *   a: Planned movement start point A.
   *   b: Planned movement end point B.
   *   c: Planned target-width start point C.
   *   d: Planned target-width end point D.
   *   effectiveC: Optional effective-width start point E.
   *   effectiveD: Optional effective-width end point F.
   *   touchArea: Optional TouchArea instance to visualize as T.
   *
   * Returns:
   *   undefined.
   *
   * Side effects:
   *   Creates or updates the SVG overlay, clears previous drawings, shows the
   *   overlay and appends all requested debug primitives.
   *
   * Visual convention:
   *   - A-B: planned movement axis
   *   - C-D: planned target width on the movement axis
   *   - E-F: effective target width on the movement axis
   *   - T: circular touch area
   *
   * Important:
   *   This function is for debugging only and must not affect runtime
   *   measurements or validation logic.
   */
  drawABCD({
    a,
    b,
    c,
    d,
    effectiveC = null,
    effectiveD = null,
    touchArea = null,
  }) {
    const svg = this.ensureSvg();

    // Replace previous debug drawings with the current trial geometry.
    svg.innerHTML = "";
    svg.style.display = "block";

    this.drawMovementAxis(a, b);

    this.drawWidthSegment({
      c,
      d,
      labelStart: "C",
      labelEnd: "D",
      text: "W_axis",
      stroke: "red",
      fill: "red",
      textOffsetY: 18,
    });

    this.drawWidthSegment({
      c: effectiveC,
      d: effectiveD,
      labelStart: "E",
      labelEnd: "F",
      text: "W_eff",
      stroke: "cyan",
      fill: "cyan",
      dash: "4 4",
      textOffsetY: 34,
    });

    this.drawTouchDebug(touchArea);
  }
}
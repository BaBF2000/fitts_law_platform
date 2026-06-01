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

function createSvgElement(tag) {
  return document.createElementNS(
    "http://www.w3.org/2000/svg",
    tag
  );
}

export class TargetDebugOverlay {
  constructor() {
    this.svg = null;
  }

  ensureSvg() {
    if (this.svg) {
      this.updateViewportSize();
      return this.svg;
    }

    const svg = createSvgElement("svg");

    svg.id = "targetDebugOverlay";

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

  updateViewportSize() {
    if (!this.svg) return;

    const {
      width,
      height,
    } = getViewportSize();

    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    this.svg.style.width = `${width}px`;
    this.svg.style.height = `${height}px`;
  }

  clear() {
    if (!this.svg) return;

    this.svg.innerHTML = "";
    this.svg.style.display = "none";
  }

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
export class TargetDebugOverlay {
  constructor() {
    this.svg = null;
  }

  /**
   * Return current viewport size.
   *
   * documentElement dimensions are generally more stable than
   * 100vw/100vh on mobile browsers after orientation changes.
   */
  getViewportSize() {
    return {
      width:
        document.documentElement?.clientWidth ||
        window.visualViewport?.width ||
        window.innerWidth,

      height:
        document.documentElement?.clientHeight ||
        window.visualViewport?.height ||
        window.innerHeight,
    };
  }

  /**
   * Create the SVG overlay once and reuse it.
   */
  ensureSvg() {
    if (this.svg) {
      this.updateViewportSize();
      return this.svg;
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

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

  /**
   * Synchronize SVG dimensions with the current viewport.
   */
  updateViewportSize() {
    if (!this.svg) return;

    const { width, height } = this.getViewportSize();

    this.svg.setAttribute("width", String(width));
    this.svg.setAttribute("height", String(height));
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    this.svg.style.width = `${width}px`;
    this.svg.style.height = `${height}px`;
  }

  /**
   * Remove all debug drawings.
   */
  clear() {
    if (!this.svg) return;

    this.svg.innerHTML = "";
    this.svg.style.display = "none";
  }

  /**
   * Draw a line segment.
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

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

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
   * Draw a labeled point.
   */
  drawPoint({ x, y, label, fill = "white" }) {
    const svg = this.ensureSvg();

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "5");
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", "black");
    circle.setAttribute("stroke-width", "2");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

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
   * Draw plain debug text.
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

    const el = document.createElementNS("http://www.w3.org/2000/svg", "text");

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
   * Draw a touch area circle.
   */
  drawTouchArea({
    x,
    y,
    radius,
    fill = "rgba(0,150,255,0.20)",
    stroke = "cyan",
  }) {
    const svg = this.ensureSvg();

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", stroke);
    circle.setAttribute("stroke-width", "3");

    svg.appendChild(circle);
  }

  /**
   * Draw:
   * - AB movement axis
   * - CD target width on the movement axis
   * - optional touch area
   */
  drawABCD({ a, b, c, d, effectiveC = null, effectiveD = null, touchArea = null, }) {
    const svg = this.ensureSvg();

    svg.innerHTML = "";
    svg.style.display = "block";

    // Planned movement axis AB.
    if (a && b) {
      const Apx = Math.hypot(b.x - a.x, b.y - a.y);

      this.drawLine({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: "lime",
        width: 2,
        dash: "8 6",
      });

      this.drawPoint({ x: a.x, y: a.y, label: "A", fill: "lime" });
      this.drawPoint({ x: b.x, y: b.y, label: "B", fill: "lime" });

      this.drawText({
        x: (a.x + b.x) / 2 + 10,
        y: (a.y + b.y) / 2 - 10,
        text: `A = ${Apx.toFixed(1)} px`,
        fill: "lime",
      });
    }

    // Target width segment CD on the movement axis.
    if (c && d) {
      const WaxisPx = Math.hypot(d.x - c.x, d.y - c.y);

      this.drawLine({
        x1: c.x,
        y1: c.y,
        x2: d.x,
        y2: d.y,
        stroke: "red",
        width: 4,
      });

      this.drawPoint({ x: c.x, y: c.y, label: "C", fill: "red" });
      this.drawPoint({ x: d.x, y: d.y, label: "D", fill: "red" });

      this.drawText({
        x: (c.x + d.x) / 2 + 10,
        y: (c.y + d.y) / 2 + 18,
        text: `W_axis = ${WaxisPx.toFixed(1)} px`,
        fill: "yellow",
      });
    }
    
    // Effective target width segment based on the real touch point.
    if (effectiveC && effectiveD) {
      const WeffectivePx = Math.hypot(
        effectiveD.x - effectiveC.x,
        effectiveD.y - effectiveC.y
      );
    
      this.drawLine({
        x1: effectiveC.x,
        y1: effectiveC.y,
        x2: effectiveD.x,
        y2: effectiveD.y,
        stroke: "cyan",
        width: 4,
        dash: "4 4",
      });
    
      this.drawPoint({
        x: effectiveC.x,
        y: effectiveC.y,
        label: "E",
        fill: "cyan",
      });
    
      this.drawPoint({
        x: effectiveD.x,
        y: effectiveD.y,
        label: "F",
        fill: "cyan",
      });
    
      this.drawText({
        x: (effectiveC.x + effectiveD.x) / 2 + 10,
        y: (effectiveC.y + effectiveD.y) / 2 + 34,
        text: `W_eff = ${WeffectivePx.toFixed(1)} px`,
        fill: "cyan",
      });
    }

    // Optional touch area overlay.
    if (touchArea) {
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
  }
}
import { Target } from "./Target.js";
import { clamp, getViewportSize } from "../core/helpers.js";
import {
  DEFAULT_TOUCH_DIAMETER_PX,
  DEFAULT_REQUIRED_OVERLAP,
} from "../core/constants.js";

export class TargetFactory {
  /**
   * Create a Target object with safe dimensions and viewport clamping
   *
   * Coordinates x/y represent the target center
   */
  static create({
    shape = "circle",
    x,
    y,
    sizePx,
    touchDiameterPx = DEFAULT_TOUCH_DIAMETER_PX,
    requiredOverlap = DEFAULT_REQUIRED_OVERLAP,
  }) {
    const { width: viewportW, height: viewportH } = getViewportSize();

    const safeSize = Number.isFinite(sizePx) && sizePx > 0 ? sizePx : 40;

    let widthPx = safeSize;
    let heightPx = safeSize;

    // Horizontal 1D band spans the playable viewport width
    if (shape === "band1d_h") {
      widthPx = viewportW;
      heightPx = safeSize;
      x = viewportW / 2;
    }

    // Vertical 1D band spans the playable viewport height
    if (shape === "band1d_v") {
      widthPx = safeSize;
      heightPx = viewportH;
      y = viewportH / 2;
    }

    const target = new Target({
      shape,
      x,
      y,
      widthPx,
      heightPx,
      touchDiameterPx,
      requiredOverlap,
    });

    // Keep the full target bounding box inside the playable viewport
    const margin = 10;
    
    const minX = target.widthPx / 2 + margin;
    const maxX = viewportW - target.widthPx / 2 - margin;
    
    const minY = target.heightPx / 2 + margin;
    const maxY = viewportH - target.heightPx / 2 - margin;
    
    // Full-width horizontal bands stay centered horizontally
    if (shape === "band1d_h") {
      target.x = viewportW / 2;
    } else {
      target.x = clamp(target.x, minX, maxX);
    }
    
    // Full-height vertical bands stay centered vertically
    if (shape === "band1d_v") {
      target.y = viewportH / 2;
    } else {
      target.y = clamp(target.y, minY, maxY);
    }
    console.log("TargetFactory", {
      shape,
      sizePx,
      widthPx: target.widthPx,
      heightPx: target.heightPx,
      x: target.x,
      y: target.y,
    });
    return target;
  }
}
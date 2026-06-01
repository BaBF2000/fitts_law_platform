/**
 * Target factory.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Target Factory
 *
 * Responsibility:
 * Creates runtime Target objects from resolved trial parameters.
 *
 * The factory guarantees:
 * - valid target dimensions
 * - shape-specific sizing rules
 * - viewport-safe placement
 * - correct touchability settings
 *
 * Important:
 * This module does not decide:
 * - trial parameters
 * - target positions
 * - experiment constraints
 *
 * It only converts a target definition into a valid Target instance.
 *
 * Extension guide:
 * - To add a new shape:
 *     1. Extend Target.js geometry support.
 *     2. Add shape-specific sizing rules in applyShapeRules().
 *     3. Add rendering support in Target.render().
 *
 * - To change viewport placement rules:
 *     edit applyViewportClamping().
 */

import { Target } from "./Target.js";

import {
  clamp,
  getViewportSize,
} from "../core/helpers.js";

import {
  DEFAULT_TOUCH_DIAMETER_PX,
  DEFAULT_REQUIRED_OVERLAP,
  VIEWPORT_TARGET_MARGIN_PX,
} from "../core/constants.js";

/* -------------------------------------------------------------------------- */
/* Shape helpers                                                               */
/* -------------------------------------------------------------------------- */

function isHorizontalBand(shape) {
  return shape === "band1d_h";
}

function isVerticalBand(shape) {
  return shape === "band1d_v";
}

/**
 * Apply shape-specific sizing rules.
 */
function applyShapeRules({
  shape,
  x,
  y,
  widthPx,
  heightPx,
  viewport,
}) {
  if (isHorizontalBand(shape)) {
    return {
      x: viewport.width / 2,
      y,
      widthPx: viewport.width,
      heightPx,
    };
  }

  if (isVerticalBand(shape)) {
    return {
      x,
      y: viewport.height / 2,
      widthPx,
      heightPx: viewport.height,
    };
  }

  return {
    x,
    y,
    widthPx,
    heightPx,
  };
}

/* -------------------------------------------------------------------------- */
/* Viewport safety                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Keep the full target bounding box inside the playable viewport.
 */
function applyViewportClamping(target, viewport) {
  const margin = VIEWPORT_TARGET_MARGIN_PX;

  const minX =
    target.widthPx / 2 + margin;

  const maxX =
    viewport.width - target.widthPx / 2 - margin;

  const minY =
    target.heightPx / 2 + margin;

  const maxY =
    viewport.height - target.heightPx / 2 - margin;

  if (isHorizontalBand(target.shape)) {
    target.x = viewport.width / 2;
  } else {
    target.x = clamp(target.x, minX, maxX);
  }

  if (isVerticalBand(target.shape)) {
    target.y = viewport.height / 2;
  } else {
    target.y = clamp(target.y, minY, maxY);
  }

  return target;
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

export class TargetFactory {
  /**
   * Create a viewport-safe Target instance.
   *
   * Coordinates x/y represent the target center.
   */
  static create({
    shape = "circle",
    x,
    y,
    sizePx,
    touchDiameterPx = DEFAULT_TOUCH_DIAMETER_PX,
    requiredOverlap = DEFAULT_REQUIRED_OVERLAP,
  }) {
    const viewport = getViewportSize();

    const safeSize =
      Number.isFinite(sizePx) && sizePx > 0
        ? sizePx
        : DEFAULT_TOUCH_DIAMETER_PX;

    const shaped =
      applyShapeRules({
        shape,
        x,
        y,
        widthPx: safeSize,
        heightPx: safeSize,
        viewport,
      });

    const target = new Target({
      shape,

      x: shaped.x,
      y: shaped.y,

      widthPx: shaped.widthPx,
      heightPx: shaped.heightPx,

      touchDiameterPx,
      requiredOverlap,
    });

    return applyViewportClamping(
      target,
      viewport
    );
  }
}
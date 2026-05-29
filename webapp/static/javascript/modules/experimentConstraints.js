import {
  DEFAULT_TOUCH_DIAMETER_PX,
  MIN_VISIBLE_TARGET_PX,
  TOUCH_SAFETY_FACTOR,
  MAX_TARGET_SIZE_RATIO,
  MIN_AMPLITUDE_MARGIN_PX,
} from "../core/constants.js";

import { loadAdminSettings } from "../core/adminSettings.js";

import { clamp, getViewportSize } from "../core/helpers.js";

/**
 * Return the active touch diameter in CSS pixels.
 */
export function getTouchDiameterPx(state) {
  const value = Number(state?.touchDiameterPx);

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TOUCH_DIAMETER_PX;
}

/**
 * Return the minimum target size required by the application.
 *
 * This combines:
 * - visual visibility
 * - touchability safety factor
 */
export function getMinTargetSizePx(state) {
  const touchDiameterPx = getTouchDiameterPx(state);
  const admin = loadAdminSettings();

  return Math.max(
    admin.minVisibleTargetPx,
    touchDiameterPx * admin.touchSafetyFactor
  );
}

/**
 * Return the maximum target size allowed by the current viewport.
 */
export function getMaxTargetSizePx(overrideViewport = null) {
  const viewport = overrideViewport ?? getViewportSize();
  const admin = loadAdminSettings();

  return viewport.minSide * admin.maxTargetSizeRatio;
}

/**
 * Return target size bounds for the active environment.
 */
export function getTargetSizeBoundsPx(state, overrideViewport = null) {
  return {
    minPx: getMinTargetSizePx(state),
    maxPx: getMaxTargetSizePx(overrideViewport),
  };
}

/**
 * Clamp a target size to the active application bounds.
 */
export function clampTargetSizePx(sizePx, state, overrideViewport = null) {
  const { minPx, maxPx } = getTargetSizeBoundsPx(state, overrideViewport);

  return clamp(sizePx, minPx, maxPx);
}

/**
 * Describe how a target size would be corrected.
 */
export function analyzeTargetSizeClamp(sizePx, state, overrideViewport = null) {
  const { minPx, maxPx } = getTargetSizeBoundsPx(state, overrideViewport);

  const value = Number(sizePx);

  if (!Number.isFinite(value)) {
    return {
      valid: false,
      inputPx: value,
      outputPx: NaN,
      minPx,
      maxPx,
      clampedMin: false,
      clampedMax: false,
    };
  }

  const outputPx = clamp(value, minPx, maxPx);

  return {
    valid: true,
    inputPx: value,
    outputPx,
    minPx,
    maxPx,
    clampedMin: value < minPx,
    clampedMax: value > maxPx,
  };
}

/**
 * Compute the minimum safe center-to-center amplitude.
 *
 * This prevents two consecutive targets from geometrically overlapping.
 */
export function getMinAmplitudePx({
  shape = "circle",
  targetSizePx,
  marginPx = null,
} = {}) {
  if (!Number.isFinite(targetSizePx) || targetSizePx <= 0) {
    return NaN;
  }

  const admin = loadAdminSettings();

  const effectiveMarginPx =
    Number.isFinite(marginPx)
      ? marginPx
      : admin.minAmplitudeMarginPx;

  if (shape === "band1d_h" || shape === "band1d_v") {
    return targetSizePx + effectiveMarginPx;
  }

  const radius =
    shape === "circle"
      ? targetSizePx / 2
      : (targetSizePx * Math.SQRT2) / 2;

  return radius * 2 + effectiveMarginPx;
}

/**
 * Return feasible W bounds in the currently selected input unit.
 *
 * The internal constraint model is expressed in px.
 * This helper converts Wmin/Wmax back into the user-facing unit.
 */
export function getFeasibleWBoundsInUnit(unit, state, overrideViewport = null) {
  const { minPx, maxPx } =
    getTargetSizeBoundsPx(state, overrideViewport);

  if (unit === "px") {
    return {
      min: minPx,
      max: maxPx,
    };
  }

  if (unit === "mm") {
    if (!state?.mmPerPx) {
      return {
        min: null,
        max: null,
      };
    }

    return {
      min: minPx * state.mmPerPx,
      max: maxPx * state.mmPerPx,
    };
  }

  const viewport = overrideViewport ?? getViewportSize();

  return {
    min: minPx / viewport.minSide,
    max: maxPx / viewport.minSide,
  };
}

/**
 * Return feasible A bounds in the currently selected input unit.
 *
 * minApx is computed at trial level because it depends on the final target size
 * and shape. maxApx is the maximum requested/planned amplitude.
 */
export function getFeasibleABoundsInUnit({
  unit,
  state,
  minApx,
  maxApx,
  overrideViewport = null,
} = {}) {
  const viewport = overrideViewport ?? getViewportSize();

  if (!Number.isFinite(minApx)) {
    return {
      min: null,
      max: null,
    };
  }

  const safeMaxApx =
    Number.isFinite(maxApx) && maxApx >= minApx
      ? maxApx
      : minApx;

  if (unit === "px") {
    return {
      min: minApx,
      max: safeMaxApx,
    };
  }

  if (unit === "mm") {
    if (!state?.mmPerPx) {
      return {
        min: null,
        max: null,
      };
    }

    return {
      min: minApx * state.mmPerPx,
      max: safeMaxApx * state.mmPerPx,
    };
  }

  return {
    min: minApx / viewport.minSide,
    max: safeMaxApx / viewport.minSide,
  };
}
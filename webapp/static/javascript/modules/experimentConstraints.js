/**
 * Experiment constraint model
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Constraint System
 * - Monte-Carlo-Simulation
 *   → Constraint Analysis
 * - Admin Settings
 *   → Application Constraints
 *
 * Responsibility:
 * This module defines the physical and ergonomic limits used by the app
 * It is used by:
 * - real experiment generation
 * - target rendering safety
 * - Monte Carlo distortion analysis
 * - protocol validation
 *
 * Important:
 * This file does not decide experiment design.
 * It only answers:
 * - What is the minimum allowed target size?
 * - What is the maximum allowed target size?
 * - Would a planned value be clamped?
 * - What amplitude is needed to avoid target overlap?
 *
 * Extension guide:
 * - To change default constants: edit core/constants.js
 * - To change runtime/admin constraints: edit core/adminSettings.js
 * - To change how trial values are generated: edit modules/trialParameters.js
 * - To change Monte Carlo interpretation: edit modules/monteCarlo/monteCarloDiagnostics.js
 */

import {
  DEFAULT_TOUCH_DIAMETER_PX,
} from "../core/constants.js";

import { loadAdminSettings } from "../core/adminSettings.js";
import { clamp, getViewportSize } from "../core/helpers.js";

/* -------------------------------------------------------------------------- */
/* Admin settings and viewport helpers                                        */
/* -------------------------------------------------------------------------- */

function getActiveAdminSettings() {
  return loadAdminSettings();
}

function getActiveViewport(overrideViewport = null) {
  return overrideViewport ?? getViewportSize();
}

function isBand1D(shape) {
  return shape === "band1d_h" || shape === "band1d_v";
}

/* -------------------------------------------------------------------------- */
/* Touch and target-size constraints                                          */
/* -------------------------------------------------------------------------- */

/**
 * Return the active touch diameter in CSS pixels.
 *
 * If no participant-specific touch size is available, the global fallback is
 * used. This value is important because the target must remain touchable.
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
  const admin = getActiveAdminSettings();

  return Math.max(
    admin.minVisibleTargetPx,
    touchDiameterPx * admin.touchSafetyFactor
  );
}

/**
 * Return the maximum target size allowed by the current viewport.
 *
 * This prevents targets from becoming unrealistically large compared to the
 * available experiment area.
 */
export function getMaxTargetSizePx(overrideViewport = null) {
  const viewport = getActiveViewport(overrideViewport);
  const admin = getActiveAdminSettings();

  return viewport.minSide * admin.maxTargetSizeRatio;
}

/**
 * Return target-size bounds in CSS pixels.
 */
export function getTargetSizeBoundsPx(
  state,
  overrideViewport = null
) {
  return {
    minPx: getMinTargetSizePx(state),
    maxPx: getMaxTargetSizePx(overrideViewport),
  };
}

/**
 * Clamp a target size to the active application bounds.
 */
export function clampTargetSizePx(
  sizePx,
  state,
  overrideViewport = null
) {
  const { minPx, maxPx } =
    getTargetSizeBoundsPx(state, overrideViewport);

  return clamp(sizePx, minPx, maxPx);
}

/**
 * Describe how a planned target size would be corrected.
 *
 * Used by:
 * - Monte Carlo analysis
 * - runtime diagnostics
 */
export function analyzeTargetSizeClamp(
  sizePx,
  state,
  overrideViewport = null
) {
  const { minPx, maxPx } =
    getTargetSizeBoundsPx(state, overrideViewport);

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

/* -------------------------------------------------------------------------- */
/* Amplitude constraints                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Compute the minimum safe center-to-center amplitude.
 *
 * This prevents two consecutive targets from geometrically overlapping.
 *
 * Shape behavior:
 * - circle: diameter + margin
 * - polygon/square: bounding-box diagonal + margin
 * - 1D bands: thickness + margin
 */
export function getMinAmplitudePx({
  shape = "circle",
  targetSizePx,
  marginPx = null,
} = {}) {
  if (!Number.isFinite(targetSizePx) || targetSizePx <= 0) {
    return NaN;
  }

  const admin = getActiveAdminSettings();

  const effectiveMarginPx =
    Number.isFinite(marginPx)
      ? marginPx
      : admin.minAmplitudeMarginPx;

  if (isBand1D(shape)) {
    return targetSizePx + effectiveMarginPx;
  }

  const radius =
    shape === "circle"
      ? targetSizePx / 2
      : (targetSizePx * Math.SQRT2) / 2;

  return radius * 2 + effectiveMarginPx;
}

/* -------------------------------------------------------------------------- */
/* Unit conversion for feasible ranges                                        */
/* -------------------------------------------------------------------------- */

/**
 * Convert a pixel bound into the currently selected user-facing unit.
 *
 * Supported units:
 * - px
 * - mm
 * - relative
 */
function pxToUnit(px, unit, state, viewport) {
  if (unit === "px") {
    return px;
  }

  if (unit === "mm") {
    return state?.mmPerPx
      ? px * state.mmPerPx
      : null;
  }

  return px / viewport.minSide;
}

/**
 * Return feasible W bounds in the currently selected input unit.
 *
 * The internal constraint model is expressed in px. This helper converts
 * Wmin/Wmax back into the unit used by the UI/protocol.
 */
export function getFeasibleWBoundsInUnit(
  unit,
  state,
  overrideViewport = null
) {
  const viewport = getActiveViewport(overrideViewport);

  const { minPx, maxPx } =
    getTargetSizeBoundsPx(state, viewport);

  return {
    min: pxToUnit(minPx, unit, state, viewport),
    max: pxToUnit(maxPx, unit, state, viewport),
  };
}

/**
 * Return feasible A bounds in the currently selected input unit.
 *
 * minApx is computed at trial level because it depends on:
 * - final target size
 * - target shape
 * - anti-overlap margin
 *
 * maxApx is the maximum requested/planned amplitude.
 */
export function getFeasibleABoundsInUnit({
  unit,
  state,
  minApx,
  maxApx,
  overrideViewport = null,
} = {}) {
  const viewport = getActiveViewport(overrideViewport);

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

  return {
    min: pxToUnit(minApx, unit, state, viewport),
    max: pxToUnit(safeMaxApx, unit, state, viewport),
  };
}
/**
 * Experiment constraint model.
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
 * This module defines the physical and ergonomic limits used by the app.
 *
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
 * - To change default constants: edit core/constants.js.
 * - To change runtime/admin constraints: edit core/adminSettings.js.
 * - To change how trial values are generated: edit modules/trialParameters.js.
 * - To change Monte Carlo interpretation: edit modules/monteCarlo/monteCarloDiagnostics.js.
 */

import {
  DEFAULT_TOUCH_DIAMETER_PX,
} from "../core/constants.js";

import { loadAdminSettings } from "../core/adminSettings.js";
import { clamp, getViewportSize } from "../core/helpers.js";

/* -------------------------------------------------------------------------- */
/* Admin settings and viewport helpers                                        */
/* -------------------------------------------------------------------------- */

/**
 * Load the currently active admin constraint settings.
 *
 * Returns:
 *   Admin settings object loaded from persistent runtime settings.
 *
 * Side effects:
 *   Reads admin settings through loadAdminSettings().
 *
 * Purpose:
 *   Centralizes access to user/admin-editable application constraints.
 */
function getActiveAdminSettings() {
  return loadAdminSettings();
}

/**
 * Return the viewport used for constraint calculations.
 *
 * Args:
 *   overrideViewport: Optional viewport object used for simulations/tests.
 *
 * Returns:
 *   overrideViewport when provided, otherwise the current browser viewport.
 *
 * Side effects:
 *   Reads the current viewport size when no override is provided.
 *
 * Related usage:
 *   Monte Carlo simulations can pass an override viewport so calculations do
 *   not depend directly on the live browser window.
 */
function getActiveViewport(overrideViewport = null) {
  return overrideViewport ?? getViewportSize();
}

/**
 * Check whether a shape is a one-dimensional band target.
 *
 * Args:
 *   shape: Target shape identifier.
 *
 * Returns:
 *   true for horizontal or vertical 1D bands, otherwise false.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   1D bands use a different amplitude constraint because their meaningful
 *   thickness is not the same as a normal square/polygon bounding box.
 */
function isBand1D(shape) {
  return shape === "band1d_h" || shape === "band1d_v";
}

/* -------------------------------------------------------------------------- */
/* Touch and target-size constraints                                          */
/* -------------------------------------------------------------------------- */

/**
 * Return the active touch diameter in CSS pixels.
 *
 * Args:
 *   state: Shared application state containing optional participant-specific
 *     touchDiameterPx.
 *
 * Returns:
 *   Valid touch diameter in CSS pixels.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   If no participant-specific touch size is available, the global fallback is
 *   used. This value is important because the target must remain touchable.
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
 * Args:
 *   state: Shared application state containing current touchability values.
 *
 * Returns:
 *   Minimum target size in CSS pixels.
 *
 * Side effects:
 *   Reads active admin settings.
 *
 * Constraint sources:
 *   - visual visibility minimum
 *   - touchability safety factor
 *
 * Behavior:
 *   The final minimum is the larger of:
 *   - admin.minVisibleTargetPx
 *   - touchDiameterPx * admin.touchSafetyFactor
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
 * Args:
 *   overrideViewport: Optional viewport object for simulation or testing.
 *
 * Returns:
 *   Maximum target size in CSS pixels.
 *
 * Side effects:
 *   Reads active admin settings and possibly the current viewport size.
 *
 * Purpose:
 *   Prevents targets from becoming unrealistically large compared to the
 *   available experiment area.
 */
export function getMaxTargetSizePx(overrideViewport = null) {
  const viewport = getActiveViewport(overrideViewport);
  const admin = getActiveAdminSettings();

  return viewport.minSide * admin.maxTargetSizeRatio;
}

/**
 * Return target-size bounds in CSS pixels.
 *
 * Args:
 *   state: Shared application state.
 *   overrideViewport: Optional viewport object for simulation or testing.
 *
 * Returns:
 *   Object containing:
 *   - minPx: minimum allowed target size in CSS pixels
 *   - maxPx: maximum allowed target size in CSS pixels
 *
 * Side effects:
 *   Reads active admin settings and possibly current viewport information.
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
 *
 * Args:
 *   sizePx: Planned target size in CSS pixels.
 *   state: Shared application state.
 *   overrideViewport: Optional viewport object for simulation or testing.
 *
 * Returns:
 *   Target size constrained to [minPx, maxPx].
 *
 * Side effects:
 *   None, except reading settings/viewport through helper functions.
 *
 * Related usage:
 *   Used by runtime trial parameter resolution and Monte Carlo simulation.
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
 * Args:
 *   sizePx: Planned target size in CSS pixels.
 *   state: Shared application state.
 *   overrideViewport: Optional viewport object for simulation or testing.
 *
 * Returns:
 *   Diagnostic object containing:
 *   - valid: whether input size is finite
 *   - inputPx: original size
 *   - outputPx: clamped size
 *   - minPx / maxPx: active bounds
 *   - clampedMin: whether size was below minPx
 *   - clampedMax: whether size was above maxPx
 *
 * Side effects:
 *   None, except reading settings/viewport through helper functions.
 *
 * Used by:
 *   - Monte Carlo analysis
 *   - runtime diagnostics
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
 * Args:
 *   shape: Target shape identifier.
 *   targetSizePx: Target size or thickness in CSS pixels.
 *   marginPx: Optional custom anti-overlap margin in CSS pixels.
 *
 * Returns:
 *   Minimum safe center-to-center amplitude in CSS pixels, or NaN if the target
 *   size is invalid.
 *
 * Side effects:
 *   Reads active admin settings when marginPx is not provided.
 *
 * Purpose:
 *   Prevents two consecutive targets from geometrically overlapping.
 *
 * Shape behavior:
 *   - circle: diameter + margin
 *   - polygon/square: bounding-box diagonal + margin
 *   - 1D bands: thickness + margin
 *
 * Important:
 *   This is a conservative geometric safety rule. It protects placement and
 *   Monte Carlo feasibility checks from impossible or overlapping designs.
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
 * Args:
 *   px: Pixel value to convert.
 *   unit: User-facing unit, usually "px", "mm" or "relative".
 *   state: Shared application state containing optional mmPerPx calibration.
 *   viewport: Viewport object containing minSide.
 *
 * Returns:
 *   Converted value in the selected unit, or null if conversion is impossible.
 *
 * Side effects:
 *   None.
 *
 * Supported units:
 *   - px: returns the value directly
 *   - mm: requires mmPerPx calibration
 *   - relative: returns px / viewport.minSide
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
 * Args:
 *   unit: User-facing unit used by the protocol/UI.
 *   state: Shared application state.
 *   overrideViewport: Optional viewport object for simulation or testing.
 *
 * Returns:
 *   Object containing:
 *   - min: feasible minimum W in the selected unit
 *   - max: feasible maximum W in the selected unit
 *
 * Side effects:
 *   Reads active constraints and possibly viewport information.
 *
 * Behavior:
 *   The internal constraint model is expressed in pixels. This helper converts
 *   Wmin/Wmax back into the unit used by the UI/protocol.
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
 * Args:
 *   unit: User-facing unit used by the protocol/UI.
 *   state: Shared application state.
 *   minApx: Minimum feasible amplitude in CSS pixels.
 *   maxApx: Maximum requested or planned amplitude in CSS pixels.
 *   overrideViewport: Optional viewport object for simulation or testing.
 *
 * Returns:
 *   Object containing:
 *   - min: feasible minimum amplitude in the selected unit
 *   - max: feasible maximum amplitude in the selected unit
 *
 * Side effects:
 *   Reads viewport information when no override is provided.
 *
 * Behavior:
 *   minApx is computed at trial level because it depends on:
 *   - final target size
 *   - target shape
 *   - anti-overlap margin
 *
 *   maxApx is the maximum requested/planned amplitude. If maxApx is missing or
 *   smaller than minApx, the function returns minApx as the safe maximum.
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
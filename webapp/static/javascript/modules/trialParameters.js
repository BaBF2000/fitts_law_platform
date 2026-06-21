/**
 * Trial parameter resolver.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Parameter Resolver
 *
 * Responsibility:
 * This module converts one trial definition into concrete numeric values:
 * - A
 * - W
 * - ID
 *
 * It supports the three experiment parameter modes:
 * - A_W  : A and W are entered directly, ID is computed later
 * - ID_W : ID and W are entered, A is computed
 * - ID_A : ID and A are entered, W is computed
 *
 * Important:
 * This file resolves planned trial values only.
 * It does not place targets on screen.
 * It does not validate touches.
 * It does not write result rows.
 *
 * Extension guide:
 * - To add a new sampling distribution: edit core/distributions.js.
 * - To change parameter parsing: edit modules/parameterSampling.js.
 * - To change touch/size constraints: edit modules/experimentConstraints.js.
 * - To change target placement: edit modules/experiment.js.
 */

import {
  computeID,
  computeWFromID,
  computeAFromWAndID,
  convertToPxAndMm,
  getViewportSize,
} from "../core/helpers.js";

import { sampleParameter } from "./parameterSampling.js";

import {
  clampTargetSizePx,
  getFeasibleWBoundsInUnit,
} from "./experimentConstraints.js";

// Fitts' Law formula used for all resolved trial parameters.
// Currently fixed to Shannon because this is the application's default model.
const SHANNON_FORMULA = "shannon";

/* -------------------------------------------------------------------------- */
/* Unit conversion helpers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Return the shortest side of the current viewport.
 *
 * Returns:
 *   Shortest viewport side in CSS pixels.
 *
 * Side effects:
 *   Reads the current viewport size through getViewportSize().
 *
 * Purpose:
 *   Used when converting pixel values back to relative input units.
 */
function getViewportMinSide() {
  return getViewportSize().minSide;
}

/**
 * Convert planned amplitude from pixels to millimeters when possible.
 *
 * Args:
 *   Apx: Planned amplitude in CSS pixels.
 *   A_in: Original sampled amplitude in the selected input unit.
 *   unit: Current unit mode, for example "relative", "px" or "mm".
 *   state: Shared application state containing optional mmPerPx calibration.
 *
 * Returns:
 *   Planned amplitude in millimeters, or null if no millimeter value can be
 *   derived.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - If calibration exists, pixels are converted to millimeters.
 *   - If the original input unit is already millimeters, A_in is returned.
 *   - Otherwise, null is returned.
 */
function getAmmFromApx(Apx, A_in, unit, state) {
  if (state?.mmPerPx) return Apx * state.mmPerPx;
  if (unit === "mm") return A_in;
  return null;
}

/**
 * Convert planned target width from pixels to millimeters when possible.
 *
 * Args:
 *   Wpx: Planned target width in CSS pixels.
 *   W_in: Original sampled width in the selected input unit.
 *   unit: Current unit mode, for example "relative", "px" or "mm".
 *   state: Shared application state containing optional mmPerPx calibration.
 *
 * Returns:
 *   Planned target width in millimeters, or null if no millimeter value can be
 *   derived.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   - If calibration exists, pixels are converted to millimeters.
 *   - If the original input unit is already millimeters, W_in is returned.
 *   - Otherwise, null is returned.
 */
function getWmmFromWpx(Wpx, W_in, unit, state) {
  if (state?.mmPerPx) return Wpx * state.mmPerPx;
  if (unit === "mm") return W_in;
  return null;
}

/**
 * Convert a pixel value back into the currently selected input unit.
 *
 * Args:
 *   px: Value in CSS pixels.
 *   unit: Current unit mode, for example "relative", "px" or "mm".
 *   state: Shared application state containing optional mmPerPx calibration.
 *
 * Returns:
 *   Converted value in the selected input unit, or null if conversion is not
 *   possible.
 *
 * Side effects:
 *   Reads the viewport size when converting to relative units.
 *
 * Behavior:
 *   - "px": returns the pixel value directly.
 *   - "mm": requires calibration and returns px * mmPerPx.
 *   - any other mode is treated as relative and returns px / minSide.
 */
function pxToInputUnit(px, unit, state) {
  if (!Number.isFinite(px)) return null;

  if (unit === "px") {
    return px;
  }

  if (unit === "mm") {
    return state?.mmPerPx
      ? px * state.mmPerPx
      : null;
  }

  return px / getViewportMinSide();
}

/* -------------------------------------------------------------------------- */
/* Sampling helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Sample or parse the planned amplitude value A from a trial definition.
 *
 * Args:
 *   t: Trial definition object.
 *
 * Returns:
 *   Numeric amplitude value in the trial's selected input unit.
 *
 * Side effects:
 *   May use stochastic sampling through sampleParameter().
 *
 * Related fields:
 *   - t.dist_entered
 *   - t.random_A
 *   - t.a_sampling
 */
function sampleA(t) {
  return sampleParameter({
    input: t.dist_entered,
    random: !!t.random_A,
    distribution: t.a_sampling ?? "uniform",
  });
}

/**
 * Sample or parse the planned target width W from a trial definition.
 *
 * Args:
 *   t: Trial definition object.
 *   feasibleW: Feasible width bounds in the current input unit.
 *
 * Returns:
 *   Numeric width value in the trial's selected input unit.
 *
 * Side effects:
 *   May use stochastic sampling through sampleParameter().
 *
 * Behavior:
 *   Feasible width bounds are passed as overrides so random width sampling does
 *   not intentionally generate values outside active target-size constraints.
 *
 * Related fields:
 *   - t.width_entered
 *   - t.random_W
 *   - t.w_sampling
 */
function sampleW(t, feasibleW) {
  return sampleParameter({
    input: t.width_entered,
    random: !!t.random_W,
    distribution: t.w_sampling ?? "uniform",
    minOverride: feasibleW.min,
    maxOverride: feasibleW.max,
  });
}

/**
 * Sample or parse the planned index of difficulty ID from a trial definition.
 *
 * Args:
 *   t: Trial definition object.
 *
 * Returns:
 *   Numeric ID value.
 *
 * Side effects:
 *   May use stochastic sampling through sampleParameter().
 *
 * Related fields:
 *   - t.id_entered
 *   - t.random_ID
 *   - t.id_sampling
 */
function sampleID(t) {
  return sampleParameter({
    input: t.id_entered,
    random: !!t.random_ID,
    distribution: t.id_sampling ?? "uniform",
  });
}

/* -------------------------------------------------------------------------- */
/* Constraint helper                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Ensure W respects the active target-size constraints.
 *
 * Args:
 *   Wpx: Planned target width in CSS pixels.
 *   W_in: Planned target width in the selected input unit.
 *   unit: Current unit mode.
 *   state: Shared application state containing calibration and admin settings.
 *
 * Returns:
 *   Object with adjusted Wpx and W_in values.
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   Wpx is clamped through clampTargetSizePx(). If the pixel value changes,
 *   W_in is recomputed so the input-unit representation stays consistent with
 *   the constrained pixel value.
 *
 * Important:
 *   If W is increased or decreased by constraints, the effective planned ID may
 *   differ from the originally requested ID.
 */
function enforceTargetSizeConstraints(Wpx, W_in, unit, state) {
  if (!Number.isFinite(Wpx)) {
    return { Wpx, W_in };
  }

  const adjustedWpx =
    clampTargetSizePx(Wpx, state);

  if (adjustedWpx === Wpx) {
    return { Wpx, W_in };
  }

  return {
    Wpx: adjustedWpx,
    W_in: pxToInputUnit(adjustedWpx, unit, state) ?? W_in,
  };
}

/* -------------------------------------------------------------------------- */
/* Mode resolvers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolve trial parameters for A_W mode.
 *
 * Args:
 *   t: Trial definition object.
 *   state: Shared application state.
 *   unit: Current unit mode.
 *   feasibleW: Feasible width bounds in the current input unit.
 *
 * Returns:
 *   Object containing A_in, W_in, ID_in, Apx and Wpx.
 *
 * Side effects:
 *   May use stochastic sampling through sampleA() and sampleW().
 *
 * Behavior:
 *   A and W are sampled directly from user-entered values. ID is not taken from
 *   input in this mode and is therefore returned as null. W is constrained after
 *   conversion to pixels.
 */
function resolveModeAW(t, state, unit, feasibleW) {
  let A_in = sampleA(t);
  let W_in = sampleW(t, feasibleW);

  const Aconv =
    convertToPxAndMm(A_in, unit, state?.mmPerPx);

  const Wconv =
    convertToPxAndMm(W_in, unit, state?.mmPerPx);

  let Apx = Aconv.px;
  let Wpx = Wconv.px;

  // Ensure that the planned target width remains compatible with the active
  // touchability and viewport constraints.
  ({ Wpx, W_in } =
    enforceTargetSizeConstraints(Wpx, W_in, unit, state));

  return {
    A_in,
    W_in,
    ID_in: null,
    Apx,
    Wpx,
  };
}

/**
 * Resolve trial parameters for ID_A mode.
 *
 * Args:
 *   t: Trial definition object.
 *   state: Shared application state.
 *   unit: Current unit mode.
 *   formula: Fitts' Law formula identifier.
 *
 * Returns:
 *   Object containing A_in, W_in, ID_in, Apx and Wpx.
 *
 * Side effects:
 *   May use stochastic sampling through sampleID() and sampleA().
 *
 * Behavior:
 *   ID and A are sampled directly. W is computed from A and ID using the active
 *   Fitts' Law formula. W is then clamped to target-size constraints.
 *
 * Notes:
 *   When unit is "mm", the equation is solved in millimeters first and then
 *   converted to pixels if calibration is available.
 */
function resolveModeIDA(t, state, unit, formula) {
  const ID_in = sampleID(t);
  const A_in = sampleA(t);

  const Aconv =
    convertToPxAndMm(A_in, unit, state?.mmPerPx);

  let Apx = Aconv.px;
  let Wpx = NaN;
  let W_in = null;

  if (unit === "mm") {
    W_in = computeWFromID(Aconv.mm, ID_in, formula);
    Wpx = state?.mmPerPx ? W_in / state.mmPerPx : NaN;
  } else {
    Wpx = computeWFromID(Apx, ID_in, formula);
    W_in = pxToInputUnit(Wpx, unit, state);
  }

  // Constraints may modify W, which can change the effective planned ID.
  ({ Wpx, W_in } =
    enforceTargetSizeConstraints(Wpx, W_in, unit, state));

  return {
    A_in,
    W_in,
    ID_in,
    Apx,
    Wpx,
  };
}

/**
 * Resolve trial parameters for ID_W mode.
 *
 * Args:
 *   t: Trial definition object.
 *   state: Shared application state.
 *   unit: Current unit mode.
 *   formula: Fitts' Law formula identifier.
 *   feasibleW: Feasible width bounds in the current input unit.
 *
 * Returns:
 *   Object containing A_in, W_in, ID_in, Apx and Wpx.
 *
 * Side effects:
 *   May use stochastic sampling through sampleID() and sampleW().
 *
 * Behavior:
 *   ID and W are sampled directly. W is constrained first, then A is computed
 *   from W and ID using the active Fitts' Law formula.
 *
 * Notes:
 *   When unit is "mm", the equation is solved in millimeters first and then
 *   converted to pixels if calibration is available.
 */
function resolveModeIDW(t, state, unit, formula, feasibleW) {
  const ID_in = sampleID(t);
  let W_in = sampleW(t, feasibleW);

  const Wconv =
    convertToPxAndMm(W_in, unit, state?.mmPerPx);

  let Wpx = Wconv.px;

  // W must respect target-size constraints before A is computed.
  ({ Wpx, W_in } =
    enforceTargetSizeConstraints(Wpx, W_in, unit, state));

  let Apx = NaN;
  let A_in = null;

  if (unit === "mm") {
    A_in = computeAFromWAndID(W_in, ID_in, formula);
    Apx = state?.mmPerPx ? A_in / state.mmPerPx : NaN;
  } else {
    Apx = computeAFromWAndID(Wpx, ID_in, formula);
    A_in = pxToInputUnit(Apx, unit, state);
  }

  return {
    A_in,
    W_in,
    ID_in,
    Apx,
    Wpx,
  };
}

/* -------------------------------------------------------------------------- */
/* Planned values                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Compute planned millimeter values and planned index of difficulty.
 *
 * Args:
 *   Apx: Resolved amplitude in CSS pixels.
 *   Wpx: Resolved target width in CSS pixels.
 *   A_in: Resolved amplitude in the selected input unit.
 *   W_in: Resolved target width in the selected input unit.
 *   unit: Current unit mode.
 *   state: Shared application state containing optional calibration.
 *   formula: Fitts' Law formula identifier.
 *
 * Returns:
 *   Object containing:
 *   - A_mm_planned: planned amplitude in millimeters or null
 *   - W_mm_planned: planned width in millimeters or null
 *   - ID_planned: planned index of difficulty or null
 *
 * Side effects:
 *   None.
 *
 * Behavior:
 *   ID_planned is computed only when both A and W can be represented in
 *   millimeters. Without calibration in non-mm unit modes, millimeter values
 *   and ID_planned may be null.
 */
function computePlannedValues({
  Apx,
  Wpx,
  A_in,
  W_in,
  unit,
  state,
  formula,
}) {
  const A_mm_planned =
    getAmmFromApx(Apx, A_in, unit, state);

  const W_mm_planned =
    getWmmFromWpx(Wpx, W_in, unit, state);

  const ID_planned =
    Number.isFinite(A_mm_planned) &&
    Number.isFinite(W_mm_planned)
      ? computeID(A_mm_planned, W_mm_planned, formula)
      : null;

  return {
    A_mm_planned,
    W_mm_planned,
    ID_planned,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Resolve one trial definition into concrete A, W and ID values.
 *
 * Args:
 *   t: Trial definition object created by the session/protocol generator.
 *   state: Shared application state containing calibration, touchability and
 *     constraint settings.
 *
 * Returns:
 *   Object containing:
 *   - formula: Fitts' Law formula identifier
 *   - paramMode: resolved parameter mode
 *   - A_in, W_in, ID_in: sampled/input-unit values
 *   - Apx, Wpx: resolved pixel values used by runtime placement
 *   - A_mm_planned, W_mm_planned: planned physical values when available
 *   - ID_planned: planned index of difficulty when available
 *
 * Side effects:
 *   May use stochastic sampling through parameterSampling.js.
 *
 * Behavior:
 *   Selects the appropriate resolver based on t.param_mode:
 *   - "A_W": sample A and W directly
 *   - "ID_A": sample ID and A, compute W
 *   - "ID_W": sample ID and W, compute A
 *
 * Important:
 *   This function resolves planned parameters only. Later modules may still
 *   adjust placement or effective target geometry during runtime.
 */
export function resolveTrialParameters(t, state) {
  const paramMode = t.param_mode ?? "A_W";
  const unit = t.unit;
  const formula = SHANNON_FORMULA;

  // Compute feasible W bounds once so W sampling can respect the active
  // target-size constraints.
  const feasibleW =
    getFeasibleWBoundsInUnit(unit, state);

  let resolved;

  if (paramMode === "ID_A") {
    resolved =
      resolveModeIDA(t, state, unit, formula);
  } else if (paramMode === "ID_W") {
    resolved =
      resolveModeIDW(t, state, unit, formula, feasibleW);
  } else {
    resolved =
      resolveModeAW(t, state, unit, feasibleW);
  }

  const planned =
    computePlannedValues({
      ...resolved,
      unit,
      state,
      formula,
    });

  return {
    formula,
    paramMode,

    A_in: resolved.A_in,
    W_in: resolved.W_in,
    ID_in: resolved.ID_in,

    Apx: resolved.Apx,
    Wpx: resolved.Wpx,

    A_mm_planned: planned.A_mm_planned,
    W_mm_planned: planned.W_mm_planned,
    ID_planned: planned.ID_planned,
  };
}
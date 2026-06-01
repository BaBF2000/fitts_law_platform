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
} from "../core/helpers.js";

import { sampleParameter } from "./parameterSampling.js";

import {
  clampTargetSizePx,
  getFeasibleWBoundsInUnit,
} from "./experimentConstraints.js";

const SHANNON_FORMULA = "shannon";

/* -------------------------------------------------------------------------- */
/* Unit conversion helpers                                                     */
/* -------------------------------------------------------------------------- */

function getViewportMinSide() {
  return Math.min(window.innerWidth, window.innerHeight);
}

/**
 * Convert planned amplitude from px to mm when calibration is available.
 */
function getAmmFromApx(Apx, A_in, unit, state) {
  if (state.mmPerPx) return Apx * state.mmPerPx;
  if (unit === "mm") return A_in;
  return null;
}

/**
 * Convert planned target width from px to mm when calibration is available.
 */
function getWmmFromWpx(Wpx, W_in, unit, state) {
  if (state.mmPerPx) return Wpx * state.mmPerPx;
  if (unit === "mm") return W_in;
  return null;
}

/**
 * Convert px back into the currently selected input unit.
 */
function pxToInputUnit(px, unit, state) {
  if (!Number.isFinite(px)) return null;

  if (unit === "px") {
    return px;
  }

  if (unit === "mm") {
    return state.mmPerPx
      ? px * state.mmPerPx
      : null;
  }

  return px / getViewportMinSide();
}

/* -------------------------------------------------------------------------- */
/* Sampling helpers                                                            */
/* -------------------------------------------------------------------------- */

function sampleA(t) {
  return sampleParameter({
    input: t.dist_entered,
    random: !!t.random_A,
    distribution: t.a_sampling ?? "uniform",
  });
}

function sampleW(t, feasibleW) {
  return sampleParameter({
    input: t.width_entered,
    random: !!t.random_W,
    distribution: t.w_sampling ?? "uniform",
    minOverride: feasibleW.min,
    maxOverride: feasibleW.max,
  });
}

function sampleID(t) {
  return sampleParameter({
    input: t.id_entered,
    random: !!t.random_ID,
    distribution: t.id_sampling ?? "uniform",
  });
}

/* -------------------------------------------------------------------------- */
/* Constraint helper                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Ensure W respects the active target-size constraints.
 *
 * This prevents impossible 100% overlap validation for very small targets.
 *
 * Important:
 * If W is increased or decreased by constraints, the effective planned ID may
 * differ from the originally requested ID.
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
/* Mode resolvers                                                              */
/* -------------------------------------------------------------------------- */

function resolveModeAW(t, state, unit, feasibleW) {
  let A_in = sampleA(t);
  let W_in = sampleW(t, feasibleW);

  const Aconv = convertToPxAndMm(A_in, unit, state.mmPerPx);
  const Wconv = convertToPxAndMm(W_in, unit, state.mmPerPx);

  let Apx = Aconv.px;
  let Wpx = Wconv.px;

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

function resolveModeIDA(t, state, unit, formula) {
  const ID_in = sampleID(t);
  const A_in = sampleA(t);

  const Aconv = convertToPxAndMm(A_in, unit, state.mmPerPx);

  let Apx = Aconv.px;
  let Wpx = NaN;
  let W_in = null;

  if (unit === "mm") {
    W_in = computeWFromID(Aconv.mm, ID_in, formula);
    Wpx = state.mmPerPx ? W_in / state.mmPerPx : NaN;
  } else {
    Wpx = computeWFromID(Apx, ID_in, formula);
    W_in = pxToInputUnit(Wpx, unit, state);
  }

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

function resolveModeIDW(t, state, unit, formula, feasibleW) {
  const ID_in = sampleID(t);
  let W_in = sampleW(t, feasibleW);

  const Wconv = convertToPxAndMm(W_in, unit, state.mmPerPx);

  let Wpx = Wconv.px;

  ({ Wpx, W_in } =
    enforceTargetSizeConstraints(Wpx, W_in, unit, state));

  let Apx = NaN;
  let A_in = null;

  if (unit === "mm") {
    A_in = computeAFromWAndID(W_in, ID_in, formula);
    Apx = state.mmPerPx ? A_in / state.mmPerPx : NaN;
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
/* Planned values                                                              */
/* -------------------------------------------------------------------------- */

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
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolve one trial definition into concrete A, W and ID values.
 */
export function resolveTrialParameters(t, state) {
  const paramMode = t.param_mode ?? "A_W";
  const unit = t.unit;
  const formula = SHANNON_FORMULA;

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
import {
  computeID,
  computeWFromID,
  computeAFromWAndID,
  convertToPxAndMm,
} from "../core/helpers.js";

import { sampleParameter } from "./parameterSampling.js";

import { clampTargetSizePx, getFeasibleWBoundsInUnit} from "./experimentConstraints.js";


const SHANNON_FORMULA = "shannon";

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
 * Ensure W is at least as large as the measured/default touch diameter.
 *
 * This prevents impossible 100% overlap validation for very small targets.
 * The correction is applied in the currently selected input unit.
 * 
 * Important:
 * If W is increased, the effective planned ID may differ from the requested ID.
 */
function enforceMinTouchableW(Wpx, W_in, unit, state) {
  if (!Number.isFinite(Wpx)) {
    return { Wpx, W_in };
  }

  const adjustedWpx = clampTargetSizePx(Wpx, state);
  let adjustedW_in = W_in;

  if (adjustedWpx === Wpx) {
    return { Wpx, W_in };
  }

  if (unit === "mm") {
    adjustedW_in = state.mmPerPx
      ? adjustedWpx * state.mmPerPx
      : W_in;
  } else if (unit === "px") {
    adjustedW_in = adjustedWpx;
  } else {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    adjustedW_in = adjustedWpx / minSide;
  }

  return {
    Wpx: adjustedWpx,
    W_in: adjustedW_in,
  };
}

/**
 * Resolve one trial definition into concrete A, W and ID values.
 *
 * Supported modes:
 * - A_W  : amplitude and width are entered directly
 * - ID_A : ID and amplitude are entered, width is computed
 * - ID_W : ID and width are entered, amplitude is computed
 */
export function resolveTrialParameters(t, state) {
  const paramMode = t.param_mode ?? "A_W";
  const unit = t.unit;
  const formula = SHANNON_FORMULA;
  const feasibleW = getFeasibleWBoundsInUnit(unit, state);

  let A_in = null;
  let W_in = null;
  let ID_in = null;

  let Apx = NaN;
  let Wpx = NaN;

  // --------------------------------------------------------
  // A + W
  // --------------------------------------------------------

  if (paramMode === "A_W") {
    A_in = sampleParameter({ input: t.dist_entered, random: !!t.random_A, distribution: t.a_sampling ?? "uniform", });
    W_in = sampleParameter({ input: t.width_entered, random: !!t.random_W, distribution: t.w_sampling ?? "uniform", 
      minOverride: feasibleW.min, maxOverride: feasibleW.max,
    });

    const Aconv = convertToPxAndMm(A_in, unit, state.mmPerPx);
    const Wconv = convertToPxAndMm(W_in, unit, state.mmPerPx);

    Apx = Aconv.px;
    Wpx = Wconv.px;

    // Keep directly entered/sampled W touchable.
    ({ Wpx, W_in } = enforceMinTouchableW(Wpx, W_in, unit, state));
  }

  // --------------------------------------------------------
  // ID + A
  // --------------------------------------------------------

  if (paramMode === "ID_A") {
    ID_in = sampleParameter({ input: t.id_entered, random: !!t.random_ID, distribution: t.id_sampling ?? "uniform", });
    A_in = sampleParameter({ input: t.dist_entered, random: !!t.random_A, distribution: t.a_sampling ?? "uniform", });

    const Aconv = convertToPxAndMm(A_in, unit, state.mmPerPx);
    Apx = Aconv.px;

    // Compute W from A and ID.
    if (unit === "mm") {
      W_in = computeWFromID(Aconv.mm, ID_in, formula);
      Wpx = state.mmPerPx ? W_in / state.mmPerPx : NaN;
    } else if (unit === "px") {
      W_in = computeWFromID(Apx, ID_in, formula);
      Wpx = W_in;
    } else {
      Wpx = computeWFromID(Apx, ID_in, formula);
      const minSide = Math.min(window.innerWidth, window.innerHeight);
      W_in = Number.isFinite(Wpx) ? Wpx / minSide : null;
    }

    // Keep computed W touchable.
    ({ Wpx, W_in } = enforceMinTouchableW(Wpx, W_in, unit, state));
  }

  // --------------------------------------------------------
  // ID + W
  // --------------------------------------------------------

  if (paramMode === "ID_W") {
    ID_in = sampleParameter({ input: t.id_entered, random: !!t.random_ID, distribution: t.id_sampling ?? "uniform", });
    W_in = sampleParameter({ input: t.width_entered, random: !!t.random_W, distribution: t.w_sampling ?? "uniform", 
       minOverride: feasibleW.min, maxOverride: feasibleW.max,
    });

    const Wconv = convertToPxAndMm(W_in, unit, state.mmPerPx);
    Wpx = Wconv.px;

    // Keep directly entered/sampled W touchable before computing A.
    ({ Wpx, W_in } = enforceMinTouchableW(Wpx, W_in, unit, state));

    // Compute A from W and ID.
    if (unit === "mm") {
      A_in = computeAFromWAndID(W_in, ID_in, formula);
      Apx = state.mmPerPx ? A_in / state.mmPerPx : NaN;
    } else if (unit === "px") {
      Apx = computeAFromWAndID(Wpx, ID_in, formula);
      A_in = Apx;
    } else {
      Apx = computeAFromWAndID(Wpx, ID_in, formula);
      const minSide = Math.min(window.innerWidth, window.innerHeight);
      A_in = Number.isFinite(Apx) ? Apx / minSide : null;
    }
  }

  // --------------------------------------------------------
  // Planned values
  // --------------------------------------------------------

  const A_mm_planned = getAmmFromApx(Apx, A_in, unit, state);
  const W_mm_planned = getWmmFromWpx(Wpx, W_in, unit, state);

  const ID_planned =
    Number.isFinite(A_mm_planned) &&
    Number.isFinite(W_mm_planned)
      ? computeID(A_mm_planned, W_mm_planned, formula)
      : null;

  return {
    formula,
    paramMode,

    A_in,
    W_in,
    ID_in,

    Apx,
    Wpx,

    A_mm_planned,
    W_mm_planned,
    ID_planned,
  };
}
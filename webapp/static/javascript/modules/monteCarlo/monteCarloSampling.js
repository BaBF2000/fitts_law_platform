/**
 * Monte Carlo sampling helpers.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Parameter Generator
 *
 * Responsibility:
 * Generates planned A/W/ID values for one virtual trial.
 *
 * Important:
 * This module only generates planned values.
 * It does not apply target-size clamping.
 * It does not build histograms or diagnostics.
 *
 * Extension guide:
 * - To add a new distribution: edit core/distributions.js.
 * - To change feasible W bounds: edit modules/experimentConstraints.js.
 * - To change Fitts equations: edit core/utils/fitts_equations.js.
 *
 * Related modules:
 * - monteCarloEngine.js calls samplePlannedW() during simulation.
 * - experimentConstraints.js provides feasible W bounds for truncated sampling.
 * - core/distributions.js implements the actual random distributions.
 */

import {
  computeWFromID,
  computeAFromWAndID,
  convertToPxAndMm,
} from "../../core/helpers.js";

import { sampleDistribution } from "../../core/distributions.js";

import {
  getFeasibleWBoundsInUnit,
} from "../experimentConstraints.js";

/**
 * Sample one value from the selected distribution.
 *
 * Args:
 *   distribution: Distribution identifier, for example "uniform",
 *     "truncated_uniform", "normal" or "truncated_normal".
 *   min: Lower requested sampling bound.
 *   max: Upper requested sampling bound.
 *   extra: Optional distribution-specific options such as truncateMin and
 *     truncateMax.
 *
 * Returns:
 *   One sampled numeric value.
 *
 * Side effects:
 *   Uses Math.random() indirectly through sampleDistribution().
 *
 * Purpose:
 *   Small wrapper that keeps sampling calls compact inside samplePlannedW().
 */
function sampleValue(distribution, min, max, extra = {}) {
  return sampleDistribution({
    distribution,
    min,
    max,
    ...extra,
  });
}

/**
 * Convert one user-facing input value to CSS pixels.
 *
 * Args:
 *   value: Input value in the selected unit.
 *   unit: Input unit, for example "relative", "px" or "mm".
 *   state: Shared application state containing optional mmPerPx calibration.
 *
 * Returns:
 *   Converted value in CSS pixels.
 *
 * Side effects:
 *   None.
 *
 * Important:
 *   The conversion logic itself lives in convertToPxAndMm(). This helper keeps
 *   the Monte Carlo sampling code focused on parameter generation.
 */
function convertInputToPx(value, unit, state) {
  return convertToPxAndMm(
    value,
    unit,
    state?.mmPerPx
  ).px;
}

/**
 * Sample one planned trial configuration.
 *
 * Args:
 *   mode: Parameter mode. Supported values are "A_W", "ID_W" and "ID_A".
 *   unit: Input unit used for A and W values.
 *   ARange: Requested amplitude range in the selected unit.
 *   WRange: Requested width range in the selected unit.
 *   IDRange: Requested index-of-difficulty range.
 *   minSide: Minimum viewport side in CSS pixels, used for relative units.
 *   state: Shared application state containing calibration/touchability.
 *   viewport: Viewport object used for feasible range calculations.
 *   aSampling: Sampling distribution used for amplitude A.
 *   wSampling: Sampling distribution used for width W.
 *   idSampling: Sampling distribution used for ID.
 *
 * Returns:
 *   Object containing:
 *   - A_in: sampled or derived A value in the selected input unit
 *   - W_in: sampled or derived W value in the selected input unit
 *   - ID_in: sampled ID value, if applicable
 *   - Apx: planned amplitude in CSS pixels
 *   - WpxRaw: planned target width in CSS pixels before constraint clamping
 *
 * Side effects:
 *   Uses random sampling through sampleDistribution().
 *
 * Supported modes:
 *   - A_W:
 *       sample A and W directly.
 *   - ID_W:
 *       sample ID and W, then compute A.
 *   - ID_A:
 *       sample ID and A, then compute W.
 *
 * Important:
 *   WpxRaw is intentionally not clamped here. The Monte Carlo engine later
 *   compares WpxRaw with the effective clamped W to measure distribution
 *   distortion.
 */
export function samplePlannedW({
  mode,
  unit,
  ARange,
  WRange,
  IDRange,
  minSide,
  state,
  viewport,
  aSampling = "uniform",
  wSampling = "uniform",
  idSampling = "uniform",
}) {
  let A_in = null;
  let W_in = null;
  let ID_in = null;

  let Apx = NaN;
  let WpxRaw = NaN;

  // Feasible W bounds are expressed in the current input unit so truncated
  // distributions can avoid technically impossible W values when requested.
  const feasibleW =
    getFeasibleWBoundsInUnit(
      unit,
      state,
      viewport
    );

  if (mode === "A_W") {
    A_in = sampleValue(
      aSampling,
      ARange[0],
      ARange[1]
    );

    W_in = sampleValue(
      wSampling,
      WRange[0],
      WRange[1],
      {
        truncateMin: feasibleW.min,
        truncateMax: feasibleW.max,
      }
    );

    Apx = convertInputToPx(A_in, unit, state);
    WpxRaw = convertInputToPx(W_in, unit, state);
  }

  if (mode === "ID_W") {
    ID_in = sampleValue(
      idSampling,
      IDRange[0],
      IDRange[1]
    );

    W_in = sampleValue(
      wSampling,
      WRange[0],
      WRange[1],
      {
        truncateMin: feasibleW.min,
        truncateMax: feasibleW.max,
      }
    );

    WpxRaw = convertInputToPx(W_in, unit, state);

    // Derive amplitude from sampled W and ID using the selected Fitts equation.
    Apx = computeAFromWAndID(
      WpxRaw,
      ID_in,
      "shannon"
    );

    A_in =
      unit === "relative"
        ? Apx / minSide
        : Apx;
  }

  if (mode === "ID_A") {
    ID_in = sampleValue(
      idSampling,
      IDRange[0],
      IDRange[1]
    );

    A_in = sampleValue(
      aSampling,
      ARange[0],
      ARange[1]
    );

    Apx = convertInputToPx(A_in, unit, state);

    // Derive W from sampled A and ID using the selected Fitts equation.
    WpxRaw = computeWFromID(
      Apx,
      ID_in,
      "shannon"
    );

    W_in =
      unit === "relative"
        ? WpxRaw / minSide
        : WpxRaw;
  }

  return {
    A_in,
    W_in,
    ID_in,
    Apx,
    WpxRaw,
  };
}
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

function sampleValue(distribution, min, max, extra = {}) {
  return sampleDistribution({
    distribution,
    min,
    max,
    ...extra,
  });
}

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
 * Supported modes:
 * - A_W  : sample A and W directly
 * - ID_W : sample ID and W, then compute A
 * - ID_A : sample ID and A, then compute W
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
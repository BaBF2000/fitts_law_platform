/**
 * Trial preparation helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Trial Preparation
 *
 * Responsibility:
 * Resolves one trial into prepared runtime values before placement:
 * - sampled A/W/ID
 * - viewport dimensions
 * - target shape
 * - required overlap
 * - touch diameter
 * - final W after size constraints and TargetFactory preview
 *
 * Important:
 * This module does not place the next target.
 * Placement is handled by experimentTrialPlacement.js.
 *
 * Related modules:
 * - trialParameters.js resolves A/W/ID according to the parameter mode.
 * - experimentConstraints.js clamps target size to application constraints.
 * - experimentTargets.js selects the concrete target shape.
 * - TargetFactory.js creates a preview target to verify rendered geometry.
 * - experiment.js consumes the prepared values before target placement.
 */

import {
  getViewportSize,
} from "../../core/helpers.js";

import {
  clampTargetSizePx,
} from "../experimentConstraints.js";

import {
  resolveTrialParameters,
} from "../trialParameters.js";

import {
  TargetFactory,
} from "../../targets/TargetFactory.js";

import {
  DEFAULT_TOUCH_DIAMETER_PX,
  DEFAULT_REQUIRED_OVERLAP,
} from "../../core/constants.js";

import {
  pickTrialShape,
  isBand1D,
} from "./experimentTargets.js";

/**
 * Prepare one generated trial for runtime placement and execution.
 *
 * Args:
 *   trial: Trial definition generated from the current protocol/session blocks.
 *   state: Shared application state containing calibration and touchability data.
 *
 * Returns:
 *   Prepared trial object containing:
 *   - resolved parameter information
 *   - A/W/ID input values
 *   - A and W in CSS pixels
 *   - viewport dimensions
 *   - concrete runtime target shape
 *   - required overlap
 *   - touch diameter
 *
 * Side effects:
 *   None. This function only reads state, viewport information and creates a
 *   temporary preview target object.
 *
 * Workflow:
 *   1. Resolve trial parameters into A/W/ID and pixel values.
 *   2. Read current viewport dimensions.
 *   3. Select the concrete target shape.
 *   4. Resolve required overlap and touch diameter.
 *   5. Clamp W to application target-size constraints.
 *   6. Create a preview target to obtain final rendered dimensions.
 *
 * Important:
 *   Target placement happens later in experimentTrialPlacement.js.
 */
export function prepareTrial({
  trial,
  state,
}) {
  // Resolve A/W/ID according to the trial's parameter mode.
  // This may include random sampling or deriving A/W from Fitts' Law.
  const resolved =
    resolveTrialParameters(trial, state);

  const paramMode =
    resolved.paramMode;

  const A_in =
    resolved.A_in;

  const W_in =
    resolved.W_in;

  const ID_in =
    resolved.ID_in;

  // Planned amplitude and width in CSS pixels before placement.
  let Apx =
    resolved.Apx;

  let Wpx =
    resolved.Wpx;

  // Read the live viewport used for runtime target placement.
  const {
    width: viewportW,
    height: viewportH,
    minSide,
  } = getViewportSize();

  const viewport = {
    width: viewportW,
    height: viewportH,
    minSide,
  };

  // Convert protocol-level shape into the concrete runtime shape.
  // For example, "shuffle" becomes one actual target shape.
  const trialShape =
    pickTrialShape(trial);

  // Required overlap controls how much of the finger/touch area must intersect
  // the target for a hit to count as valid.
  const requiredOverlap =
    Number(
      trial.required_overlap ??
      DEFAULT_REQUIRED_OVERLAP
    );

  // Use participant-specific touchability when available, otherwise use the
  // global fallback diameter.
  const touchDiameterPx =
    state.touchDiameterPx ??
    DEFAULT_TOUCH_DIAMETER_PX;

  // Apply application constraints to the planned target width.
  // This prevents targets from becoming too small or too large for the current
  // viewport and touchability settings.
  Wpx =
    clampTargetSizePx(
      Wpx,
      state,
      viewport
    );

  // Preview target used to get the final rendered size after shape-specific
  // target construction. This does not render the target on screen.
  const targetPreview =
    TargetFactory.create({
      shape: trialShape,
      x: viewportW / 2,
      y: viewportH / 2,
      sizePx: Wpx,
      touchDiameterPx,
      requiredOverlap,
    });

  // For 1D bands, the relevant target width is the band thickness.
  // For normal 2D targets, widthPx is used as the effective target width.
  Wpx =
    isBand1D(trialShape)
      ? Math.min(
          targetPreview.widthPx,
          targetPreview.heightPx
        )
      : targetPreview.widthPx;

  return {
    resolved,
    paramMode,

    A_in,
    W_in,
    ID_in,

    Apx,
    Wpx,

    viewport,
    viewportW,
    viewportH,
    minSide,

    trialShape,

    requiredOverlap,
    touchDiameterPx,
  };
}
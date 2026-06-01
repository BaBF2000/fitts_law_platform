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

export function prepareTrial({
  trial,
  state,
}) {
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

  let Apx =
    resolved.Apx;

  let Wpx =
    resolved.Wpx;

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

  const trialShape =
    pickTrialShape(trial);

  const requiredOverlap =
    Number(
      trial.required_overlap ??
      DEFAULT_REQUIRED_OVERLAP
    );

  const touchDiameterPx =
    state.touchDiameterPx ??
    DEFAULT_TOUCH_DIAMETER_PX;

  Wpx =
    clampTargetSizePx(
      Wpx,
      state,
      viewport
    );

  // Preview target to get final rendered size after all constraints.
  const targetPreview =
    TargetFactory.create({
      shape: trialShape,
      x: viewportW / 2,
      y: viewportH / 2,
      sizePx: Wpx,
      touchDiameterPx,
      requiredOverlap,
    });

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
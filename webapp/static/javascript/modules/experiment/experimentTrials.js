/**
 * Experiment trial builder.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Trial Generator
 *   → Trial Pool Builder
 *
 * Responsibility:
 * Builds the executable trial list from session blocks and protocol settings.
 *
 * Important:
 * This module does not resolve A/W/ID into pixels.
 * It only expands protocol blocks into trial definitions.
 */

import {
  clamp,
} from "../../core/helpers.js";

import {
  buildBalancedConditions,
  shuffleArray,
} from "./experimentConditions.js";

function buildTrialObject({
  block,
  condition,
  unit,
  formula,
  protocol,
  repetition,
}) {
  return {
    unit,
    formula,

    shape: block.shape ?? "circle",
    param_mode: block.param_mode ?? "A_W",

    dist_entered: condition.dist_entered,
    width_entered: condition.width_entered,
    id_entered: condition.id_entered,

    random_A: !!block.random_A,
    random_W: !!block.random_W,
    random_ID: !!block.random_ID,

    required_overlap: block.required_overlap ?? "1.0",

    w_sampling: protocol?.w_sampling ?? "uniform",
    a_sampling: protocol?.a_sampling ?? "uniform",
    id_sampling: protocol?.id_sampling ?? "uniform",

    repetition,
    demo: false,
  };
}

function buildBlockTrialPool({
  block,
  unit,
  formula,
  protocol,
  repetitionsPerCondition,
}) {
  const conditions =
    buildBalancedConditions(block);

  if (!conditions.length) {
    return [];
  }

  const pool = [];

  for (let rep = 0; rep < repetitionsPerCondition; rep++) {
    for (const condition of conditions) {
      pool.push(
        buildTrialObject({
          block,
          condition,
          unit,
          formula,
          protocol,
          repetition: rep + 1,
        })
      );
    }
  }

  return pool;
}

export function buildExperimentTrials({
  blocks,
  protocol,
  unit = "relative",
  formula = "shannon",
}) {
  if (!blocks?.length) {
    return {
      ok: false,
      error: "missing_blocks",
      message:
        'Bitte zuerst "Experiment Design" erstellen oder ein Protokoll laden.',
      trials: [],
    };
  }

  const trials = [];
  let trialNo = 1;

  for (const block of blocks) {
    const nTrialsWanted =
      clamp(
        Number(protocol?.trialCount ?? 10),
        5,
        25
      );

    const repetitionsPerCondition =
      Math.max(10, nTrialsWanted);

    const pool =
      buildBlockTrialPool({
        block,
        unit,
        formula,
        protocol,
        repetitionsPerCondition,
      });

    if (!pool.length) {
      return {
        ok: false,
        error: "invalid_block",
        message:
          "Ungültiger Block: Bitte A, W oder ID korrekt eingeben.",
        trials: [],
      };
    }

    const selectedTrials =
      shuffleArray(pool).slice(0, nTrialsWanted);

    for (const trial of selectedTrials) {
      trials.push({
        ...trial,
        trial_no: trialNo++,
      });
    }
  }

  return {
    ok: true,
    error: null,
    message: "",
    trials,
  };
}
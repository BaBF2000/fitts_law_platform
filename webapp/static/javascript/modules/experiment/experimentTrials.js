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
 *
 * Related modules:
 * - experimentConditions.js expands parameter lists into balanced conditions.
 * - experiment.js calls buildExperimentTrials() before starting a run.
 * - experimentTrialPreparation.js later resolves each trial into runtime values.
 * - trialParameters.js later handles sampling, conversion and Fitts calculations.
 */

import {
  clamp,
} from "../../core/helpers.js";

import {
  buildBalancedConditions,
  shuffleArray,
} from "./experimentConditions.js";

/**
 * Build one executable trial object from a block condition.
 *
 * Args:
 *   block: Original session block from the protocol/session editor.
 *   condition: One balanced condition generated from the block.
 *   unit: Current distance unit, for example "relative", "px" or "mm".
 *   formula: Fitts' Law formula identifier, for example "shannon".
 *   protocol: Parent protocol object containing sampling settings.
 *   repetition: Repetition number for this condition.
 *
 * Returns:
 *   Trial object used later by the experiment runtime.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Merges block-level settings, condition-specific A/W/ID values and protocol
 *   sampling settings into one trial definition.
 *
 * Important:
 *   This object still stores values as entered/generated strings. Pixel
 *   conversion and final runtime resolution happen later.
 */
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

/**
 * Build a randomized trial pool for one session block.
 *
 * Args:
 *   block: Session block from the protocol/session editor.
 *   unit: Current distance unit.
 *   formula: Fitts' Law formula identifier.
 *   protocol: Parent protocol object containing sampling settings.
 *   repetitionsPerCondition: Number of repeated trials created for each
 *     balanced condition.
 *
 * Returns:
 *   Array of trial objects for this block.
 *   Returns an empty array if the block contains no valid conditions.
 *
 * Side effects:
 *   None.
 *
 * Workflow:
 *   1. Expand the block into balanced A/W/ID conditions.
 *   2. Repeat each condition repetitionsPerCondition times.
 *   3. Convert each condition into an executable trial object.
 *
 * Important:
 *   This function builds a pool. The final number of trials is selected later
 *   by shuffling and slicing the pool.
 */
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

/**
 * Build the final executable trial list for the experiment run.
 *
 * Args:
 *   blocks: Array of session blocks.
 *   protocol: Current protocol object containing trial count and sampling
 *     settings.
 *   unit: Current distance unit. Defaults to "relative".
 *   formula: Fitts' Law formula identifier. Defaults to "shannon".
 *
 * Returns:
 *   Result object containing:
 *   - ok: whether trial generation succeeded
 *   - error: machine-readable error code or null
 *   - message: German user-facing message
 *   - trials: final executable trial list
 *
 * Side effects:
 *   Uses Math.random() indirectly through shuffleArray().
 *
 * Workflow:
 *   1. Validate that at least one block exists.
 *   2. Build a repeated trial pool for each block.
 *   3. Shuffle the pool.
 *   4. Select the requested number of trials.
 *   5. Assign global trial numbers.
 *
 * Important:
 *   The requested trial count is clamped to the allowed range [5, 25].
 *   The count is applied per block, so multiple blocks increase the total
 *   number of generated trials.
 */
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
    // Clamp requested trial count to a safe range for one block.
    const nTrialsWanted =
      clamp(
        Number(protocol?.trialCount ?? 10),
        5,
        25
      );

    // Create a sufficiently large pool before random selection.
    // This increases the chance that balanced conditions are represented even
    // after shuffling and slicing.
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

    // Randomize the pool and keep only the requested number of trials for this
    // block.
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
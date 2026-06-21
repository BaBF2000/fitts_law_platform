/**
 * Experiment result row helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Interaction Recording
 *   → Trial Summary Row
 *   → Result Export
 *
 * Responsibility:
 * Builds final trial-summary rows from interaction rows and planned trial data.
 *
 * Important:
 * Interaction-level rows are produced by trialPairEngine.js.
 * This module only builds the final summarized row stored in state.results.
 *
 * Related modules:
 * - trialPairEngine.js records interaction-level rows.
 * - experiment.js calls buildTrialSummaryRow() when one trial is finished.
 * - experimentExport.js exports state.results as CSV.
 * - server.js / backend routes save the final result table when requested.
 */

/**
 * Build one trial-summary row from the last interaction row and trial metadata.
 *
 * Args:
 *   lastInteractionRow: Last recorded interaction row for the finished trial.
 *     This row already contains common session, device and interaction fields.
 *
 *   summary: Aggregated trial-level summary computed by the trial pair engine.
 *     Expected fields include:
 *     - mt_ms_mean
 *     - ID_effective_mean
 *     - interactions
 *
 *   current: Current trial context stored in state.current. It contains planned
 *     parameter values, effective geometry, randomization flags and error data.
 *
 * Returns:
 *   A new result row object marked with trial_summary: true.
 *
 * Side effects:
 *   None. This function only builds and returns a plain object.
 *
 * Behavior:
 *   The function copies all fields from the last interaction row and overwrites
 *   or appends trial-level summary fields. This keeps the summary row compatible
 *   with the same CSV/export structure as interaction rows.
 *
 * Important:
 *   The summary row is not a raw click/touch interaction. It is an additional
 *   row that summarizes the complete trial.
 */
export function buildTrialSummaryRow({
  lastInteractionRow,
  summary,
  current,
}) {
  return {
    // Start from the last interaction row so the summary row inherits shared
    // session, participant, device and trial identifiers.
    ...lastInteractionRow,

    // Mean movement time for the completed trial.
    mt_ms:
      summary.mt_ms_mean,

    // Mean effective index of difficulty for the completed trial.
    ID_effective:
      summary.ID_effective_mean,

    // Number of recorded interactions used to finish this trial.
    interactions_per_trial:
      summary.interactions,

    // Marks this row as a trial-level summary instead of a raw interaction row.
    trial_summary: true,

    // Original user-entered or sampled parameter values.
    A_in:
      current.A_in,

    W_in:
      current.W_in,

    ID_in:
      current.ID_in,

    // Planned amplitude and width in CSS pixels.
    A_px_planned:
      current.A_px_planned,

    W_px:
      current.W_px,

    // Planned amplitude and width in millimeters when calibration exists.
    A_mm_planned:
      current.A_mm_planned,

    W_mm:
      current.W_mm,

    // Planned Fitts' Law index of difficulty.
    ID_planned:
      current.ID_planned,

    // Planned target width along the movement axis.
    W_axis_planned_px:
      current.W_axis_planned_px,

    W_axis_planned_mm:
      current.W_axis_planned_mm,

    // Planned axis edge points C and D used for debug/geometry analysis.
    axis_planned_c_x:
      current.axis_planned_c_x,

    axis_planned_c_y:
      current.axis_planned_c_y,

    axis_planned_d_x:
      current.axis_planned_d_x,

    axis_planned_d_y:
      current.axis_planned_d_y,

    // Parameter-generation mode used for this trial.
    param_mode:
      current.param_mode,

    // Randomization flags used during trial generation.
    random_A:
      current.random_A,

    random_W:
      current.random_W,

    random_ID:
      current.random_ID,

    // Error count and encoded error reasons for the completed trial.
    errors:
      current.errors,

    error_reasons:
      current.error_reasons.join("|"),

    // Number of clicks/touches before the successful hit.
    clicks_before_hit:
      current.clicks_before_hit,
  };
}
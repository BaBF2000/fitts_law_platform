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
 */

export function buildTrialSummaryRow({
  lastInteractionRow,
  summary,
  current,
}) {
  return {
    ...lastInteractionRow,

    mt_ms:
      summary.mt_ms_mean,

    ID_effective:
      summary.ID_effective_mean,

    interactions_per_trial:
      summary.interactions,

    trial_summary: true,

    A_in:
      current.A_in,

    W_in:
      current.W_in,

    ID_in:
      current.ID_in,

    A_px_planned:
      current.A_px_planned,

    W_px:
      current.W_px,

    A_mm_planned:
      current.A_mm_planned,

    W_mm:
      current.W_mm,

    ID_planned:
      current.ID_planned,

    W_axis_planned_px:
      current.W_axis_planned_px,

    W_axis_planned_mm:
      current.W_axis_planned_mm,

    axis_planned_c_x:
      current.axis_planned_c_x,

    axis_planned_c_y:
      current.axis_planned_c_y,

    axis_planned_d_x:
      current.axis_planned_d_x,

    axis_planned_d_y:
      current.axis_planned_d_y,

    param_mode:
      current.param_mode,

    random_A:
      current.random_A,

    random_W:
      current.random_W,

    random_ID:
      current.random_ID,

    errors:
      current.errors,

    error_reasons:
      current.error_reasons.join("|"),

    clicks_before_hit:
      current.clicks_before_hit,
  };
}
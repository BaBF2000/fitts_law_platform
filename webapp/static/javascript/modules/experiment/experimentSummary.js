/**
 * Experiment summary helpers.
 *
 * Organigram reference:
 * - Experiment Engine
 *   → Result Summary
 *   → End Screen
 *
 * Responsibility:
 * Computes and renders the final experiment summary.
 *
 * Important:
 * This module only renders the compact end-screen summary.
 * Detailed result rows are still stored in state.results and exported/saved
 * separately.
 *
 * Related modules:
 * - experiment.js calls renderExperimentSummary() when the run finishes.
 * - experimentResultRows.js creates trial-level summary rows.
 * - experimentExport.js exports the full result table as CSV.
 */

/**
 * Compute the arithmetic mean of a numeric array.
 *
 * Args:
 *   values: Array of numeric values.
 *
 * Returns:
 *   Arithmetic mean, or NaN if the array is empty.
 *
 * Side effects:
 *   None.
 *
 * Purpose:
 *   Used to summarize movement time and index of difficulty values for the end
 *   screen.
 */
function mean(values) {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : NaN;
}

/**
 * Render the final experiment summary on the end screen.
 *
 * Args:
 *   state: Shared application state containing collected experiment results and
 *     runtime error count.
 *
 * Returns:
 *   undefined.
 *
 * Side effects:
 *   Updates summary DOM elements on the end screen.
 *
 * Rendered values:
 *   - number of completed trials
 *   - total error count
 *   - mean movement time
 *   - mean effective or planned ID
 *
 * Behavior:
 *   Movement times are read from result rows through mt_ms.
 *   ID values prefer ID_effective when available and fall back to ID_planned.
 *
 * Important:
 *   This function reads all rows in state.results. Because state.results
 *   contains both interaction rows and trial summary rows, the meaning of the
 *   mean depends on which rows contain finite mt_ms and ID values.
 */
export function renderExperimentSummary({
  state,
}) {
  // Collect all finite movement times from result rows.
  const mts = state.results
    .map((r) => r.mt_ms)
    .filter(Number.isFinite);

  // Prefer effective ID values when available, otherwise use planned ID.
  const ids = state.results
    .map((r) => r.ID_effective ?? r.ID_planned)
    .filter(Number.isFinite);

  // Count only explicit trial-summary rows as completed trials.
  const completedTrials =
    state.results.filter((r) => r.trial_summary).length;

  document.getElementById("sumTrials").textContent =
    String(completedTrials);

  document.getElementById("sumErrors").textContent =
    String(state.errorCount);

  document.getElementById("sumMT").textContent =
    Number.isFinite(mean(mts))
      ? mean(mts).toFixed(1) + " ms"
      : "—";

  document.getElementById("sumID").textContent =
    Number.isFinite(mean(ids))
      ? mean(ids).toFixed(3)
      : "—";
}
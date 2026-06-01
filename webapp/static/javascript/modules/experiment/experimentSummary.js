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
 */

function mean(values) {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : NaN;
}

export function renderExperimentSummary({
  state,
}) {
  const mts = state.results
    .map((r) => r.mt_ms)
    .filter(Number.isFinite);

  const ids = state.results
    .map((r) => r.ID_effective ?? r.ID_planned)
    .filter(Number.isFinite);

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
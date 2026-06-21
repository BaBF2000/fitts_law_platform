/**
 * Session design warning helpers.
 *
 * Organigram reference:
 * - Experiment Design
 *   → Session Block Editor
 *   → Monte Carlo Warnings
 *
 * Responsibility:
 * Runs a lightweight Monte Carlo check before applying session block changes.
 *
 * Important:
 * This module only warns the experiment designer.
 * It does not modify protocol blocks or enforce constraints.
 *
 * Related modules:
 * - monteCarlo.js runs the protocol-level simulation.
 * - monteCarloDiagnostics.js creates warnings from constraint distortion.
 * - sessionDesign.js calls this helper before accepting edited blocks.
 */

import {
  runMonteCarloProtocol,
} from "../monteCarlo.js";

/**
 * Run a lightweight Monte Carlo check and ask the user for confirmation if
 * warnings are detected.
 *
 * Args:
 *   state: Shared application state containing current session blocks and
 *     calibration/touchability values.
 *   distanceMode: Current unit mode selected in the UI, for example "relative",
 *     "px" or "mm".
 *   aSampling: Sampling distribution/mode for amplitude A.
 *   wSampling: Sampling distribution/mode for width W.
 *   idSampling: Sampling distribution/mode for index of difficulty ID.
 *
 * Returns:
 *   true if no warnings exist or if the user confirms the warning dialog.
 *   false if the user cancels the warning dialog.
 *
 * Side effects:
 *   Runs a lightweight Monte Carlo simulation and may show a browser confirm()
 *   dialog.
 *
 * Behavior:
 *   The function builds a temporary protocol object from the current session
 *   design state. It then runs a smaller Monte Carlo simulation than the full
 *   dashboard simulation to keep the editor interaction responsive.
 *
 * Important:
 *   This function does not change state.sessionBlocks. It only decides whether
 *   the caller should continue applying the edited session design.
 */
export function confirmMonteCarloWarnings({
  state,
  distanceMode,
  aSampling,
  wSampling,
  idSampling,
}) {
  /**
   * Temporary protocol object used only for warning analysis.
   *
   * This mirrors the fields expected by runMonteCarloProtocol().
   */
  const protocol = {
    distanceMode,
    a_sampling: aSampling,
    w_sampling: wSampling,
    id_sampling: idSampling,
    sessionBlocks: state.sessionBlocks ?? [],
  };

  /**
   * Lightweight simulation result.
   *
   * n=1000 and histogramBins=50 are intentionally lower than the full Monte
   * Carlo dashboard settings because this check runs directly in the editor
   * workflow.
   */
  const simulation =
    runMonteCarloProtocol({
      protocol,
      state,
      n: 1000,
      histogramBins: 50,
    });

  // Protocol-level warning list produced by the Monte Carlo diagnostic layer.
  const warnings =
    simulation.meta?.warnings ?? [];

  if (!warnings.length) {
    return true;
  }

  // Build a compact German confirmation message for the experiment designer.
  const message =
    "Monte-Carlo-Warnung:\n\n" +
    warnings
      .map((warning) => `Block ${warning.block_no}: ${warning.message}`)
      .join("\n\n") +
    "\n\nTrotzdem übernehmen?";

  return confirm(message);
}
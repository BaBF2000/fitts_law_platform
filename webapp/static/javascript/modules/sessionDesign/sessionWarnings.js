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
 */

import {
  runMonteCarloProtocol,
} from "../monteCarlo.js";

export function confirmMonteCarloWarnings({
  state,
  distanceMode,
  aSampling,
  wSampling,
  idSampling,
}) {
  const protocol = {
    distanceMode,
    a_sampling: aSampling,
    w_sampling: wSampling,
    id_sampling: idSampling,
    sessionBlocks: state.sessionBlocks ?? [],
  };

  const simulation =
    runMonteCarloProtocol({
      protocol,
      state,
      n: 1000,
      histogramBins: 50,
    });

  const warnings =
    simulation.meta?.warnings ?? [];

  if (!warnings.length) {
    return true;
  }

  const message =
    "Monte-Carlo-Warnung:\n\n" +
    warnings
      .map((warning) => `Block ${warning.block_no}: ${warning.message}`)
      .join("\n\n") +
    "\n\nTrotzdem übernehmen?";

  return confirm(message);
}
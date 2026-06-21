/**
 * Monte Carlo constants.
 *
 * Organigram reference:
 * - Monte-Carlo-Simulation
 *   → Configuration
 *
 * Responsibility:
 * Defines default simulation parameters and display limits for the Monte Carlo
 * module.
 *
 * Important:
 * This file contains configuration values only.
 * It does not run simulations, analyze results or render charts.
 *
 * Related modules:
 * - monteCarloEngine.js uses these values as defaults for simulation input.
 * - monteCarloDashboard.js may expose or display these values in the UI.
 * - monteCarloPreviewRows.js uses MAX_PREVIEW_ROWS to limit preview output.
 */

/**
 * Default Monte Carlo simulation configuration.
 *
 * Fields:
 *   n:
 *     Default number of simulated samples.
 *
 *   histogramBins:
 *     Default number of bins used for histogram visualization.
 *
 *   unit:
 *     Default input unit for A, W and ID range interpretation.
 *
 *   mode:
 *     Default parameter mode. "A_W" means amplitude and width are sampled
 *     directly, while ID is derived from them.
 *
 *   ARange:
 *     Default amplitude range in the selected unit.
 *
 *   WRange:
 *     Default target-width range in the selected unit.
 *
 *   IDRange:
 *     Default index-of-difficulty range.
 *
 * Important:
 *   These defaults are used as baseline values only. The user interface or a
 *   saved protocol can override them at runtime.
 */
export const DEFAULT_MONTE_CARLO = {
  n: 50000,
  histogramBins: 100,

  unit: "relative",
  mode: "A_W",

  ARange: [0.05, 0.8],
  WRange: [0.02, 0.3],
  IDRange: [1, 7],
};

/**
 * Maximum number of simulation rows shown in preview tables.
 *
 * Purpose:
 *   Keeps the UI responsive and prevents the browser from rendering thousands
 *   of preview rows after a large simulation.
 *
 * Important:
 *   This does not limit the simulation size itself. It only limits the number
 *   of rows displayed in the preview output.
 */
export const MAX_PREVIEW_ROWS = 500;